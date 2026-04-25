package com.neosquare.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

class RealtimeWebSocketHandlerTest {

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private RealtimeWebSocketHandler realtimeWebSocketHandler;
    private MentoringSessionSignalingService mentoringSessionSignalingService;
    private RealtimeSessionRegistry realtimeSessionRegistry;
    private SessionChatRoutingService sessionChatRoutingService;

    @BeforeEach
    void setUp() {
        mentoringSessionSignalingService = mock(MentoringSessionSignalingService.class);
        realtimeSessionRegistry = new RealtimeSessionRegistry();
        sessionChatRoutingService = mock(SessionChatRoutingService.class);
        realtimeWebSocketHandler = new RealtimeWebSocketHandler(
                objectMapper,
                mentoringSessionSignalingService,
                realtimeSessionRegistry,
                sessionChatRoutingService
        );
    }

    @Test
    void afterConnectionEstablishedBindsAuthenticatedUserAndSendsConnectedMessage() throws Exception {
        WebSocketSession session = createSession("session-1", 7L, "Alice");

        realtimeWebSocketHandler.afterConnectionEstablished(session);

        assertThat(realtimeSessionRegistry.findUserId(session)).contains(7L);
        JsonNode response = captureSingleResponse(session);

        assertThat(response.get("type").asText()).isEqualTo("ws_connected");
        assertThat(response.get("payload").get("sessionId").asText()).isEqualTo("session-1");
        assertThat(response.get("payload").get("message").asText()).isEqualTo("WebSocket connected.");
    }

    @Test
    void afterConnectionEstablishedWithoutAuthenticatedUserClosesSession() throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-missing-user");
        when(session.getAttributes()).thenReturn(Map.of());

        realtimeWebSocketHandler.afterConnectionEstablished(session);

        verify(session).close(ArgumentMatchers.argThat(closeStatus ->
                closeStatus.getCode() == 1008
                        && "WebSocket authentication required.".equals(closeStatus.getReason())
        ));
    }

    @Test
    void handleTextMessageWithUserEnterBroadcastsToPeersAndReturnsExistingParticipants() throws Exception {
        WebSocketSession existingSession = createSession("session-existing", 11L, "Jisu");
        WebSocketSession sourceSession = createSession("session-source", 7L, "Alice");

        realtimeSessionRegistry.bindSession(existingSession, 11L);
        realtimeSessionRegistry.updateSessionPresence(existingSession, 3L, 120.0, 220.0, "forest-maker");
        realtimeSessionRegistry.bindSession(sourceSession, 7L);

        realtimeWebSocketHandler.handleTextMessage(
                sourceSession,
                new TextMessage("""
                        {
                          "type": "user_enter",
                          "senderId": 99,
                          "payload": {
                            "spaceId": 3,
                            "x": 180,
                            "y": 260,
                            "avatarPresetId": "sky-runner"
                          }
                        }
                        """)
        );

        List<JsonNode> sourceResponses = captureResponses(sourceSession, 2);
        List<JsonNode> peerResponses = captureResponses(existingSession, 1);

        assertThat(realtimeSessionRegistry.findSpaceId(sourceSession)).contains(3L);
        assertThat(realtimeSessionRegistry.findPosition(sourceSession))
                .contains(new SessionPosition(180.0, 260.0));
        assertThat(realtimeSessionRegistry.findAvatarPresetId(sourceSession)).contains("sky-runner");

        assertThat(sourceResponses.stream()
                .map(response -> response.get("type").asText())
                .collect(Collectors.toList()))
                .containsExactly("user_enter", "ws_ack");
        assertThat(sourceResponses.get(0).get("senderId").asLong()).isEqualTo(11L);
        assertThat(sourceResponses.get(0).get("payload").get("nickname").asText()).isEqualTo("Jisu");
        assertThat(sourceResponses.get(0).get("payload").get("avatarPresetId").asText())
                .isEqualTo("forest-maker");

        assertThat(peerResponses.get(0).get("type").asText()).isEqualTo("user_enter");
        assertThat(peerResponses.get(0).get("senderId").asLong()).isEqualTo(7L);
        assertThat(peerResponses.get(0).get("payload").get("userId").asLong()).isEqualTo(7L);
        assertThat(peerResponses.get(0).get("payload").get("nickname").asText()).isEqualTo("Alice");
        assertThat(peerResponses.get(0).get("payload").get("avatarPresetId").asText())
                .isEqualTo("sky-runner");
    }

    @Test
    void handleTextMessageWithChatSendBroadcastsOnlyToSameSpace() throws Exception {
        WebSocketSession sourceSession = createSession("session-source", 7L, "Alice");
        WebSocketSession sameSpaceSession = createSession("session-peer", 11L, "Jisu");
        WebSocketSession otherSpaceSession = createSession("session-other", 21L, "Mina");

        realtimeSessionRegistry.bindSession(sourceSession, 7L);
        realtimeSessionRegistry.updateSessionPresence(sourceSession, 3L, 180.0, 260.0, null);
        realtimeSessionRegistry.bindSession(sameSpaceSession, 11L);
        realtimeSessionRegistry.updateSessionPresence(sameSpaceSession, 3L, 200.0, 280.0, null);
        realtimeSessionRegistry.bindSession(otherSpaceSession, 21L);
        realtimeSessionRegistry.updateSessionPresence(otherSpaceSession, 5L, 320.0, 380.0, null);

        realtimeWebSocketHandler.handleTextMessage(
                sourceSession,
                new TextMessage("""
                        {
                          "type": "chat_send",
                          "senderId": 999,
                          "payload": {
                            "spaceId": 3,
                            "content": "스터디 같이 하실 분 계신가요?"
                          }
                        }
                        """)
        );

        List<JsonNode> sourceResponses = captureResponses(sourceSession, 1);
        List<JsonNode> peerResponses = captureResponses(sameSpaceSession, 1);

        assertThat(sourceResponses.get(0).get("type").asText()).isEqualTo("ws_ack");
        assertThat(peerResponses.get(0).get("type").asText()).isEqualTo("chat_send");
        assertThat(peerResponses.get(0).get("senderId").asLong()).isEqualTo(7L);
        assertThat(peerResponses.get(0).get("payload").get("nickname").asText()).isEqualTo("Alice");
        assertThat(peerResponses.get(0).get("payload").get("content").asText())
                .isEqualTo("스터디 같이 하실 분 계신가요?");
        verify(otherSpaceSession, never()).sendMessage(ArgumentMatchers.any(TextMessage.class));
    }

    @Test
    void handleTextMessageWithUserMoveIncludesNicknameForSameSpacePeers() throws Exception {
        WebSocketSession sourceSession = createSession("session-source", 7L, "Alice");
        WebSocketSession sameSpaceSession = createSession("session-peer", 11L, "Jisu");

        realtimeSessionRegistry.bindSession(sourceSession, 7L);
        realtimeSessionRegistry.updateSessionPresence(sourceSession, 3L, 180.0, 260.0, "sky-runner");
        realtimeSessionRegistry.bindSession(sameSpaceSession, 11L);
        realtimeSessionRegistry.updateSessionPresence(sameSpaceSession, 3L, 200.0, 280.0, "forest-maker");

        realtimeWebSocketHandler.handleTextMessage(
                sourceSession,
                new TextMessage("""
                        {
                          "type": "user_move",
                          "senderId": 999,
                          "payload": {
                            "spaceId": 3,
                            "x": 220,
                            "y": 320,
                            "avatarPresetId": "sky-runner"
                          }
                        }
                        """)
        );

        List<JsonNode> sourceResponses = captureResponses(sourceSession, 1);
        List<JsonNode> peerResponses = captureResponses(sameSpaceSession, 1);

        assertThat(sourceResponses.get(0).get("type").asText()).isEqualTo("ws_ack");
        assertThat(peerResponses.get(0).get("type").asText()).isEqualTo("user_move");
        assertThat(peerResponses.get(0).get("senderId").asLong()).isEqualTo(7L);
        assertThat(peerResponses.get(0).get("payload").get("nickname").asText()).isEqualTo("Alice");
        assertThat(peerResponses.get(0).get("payload").get("x").asDouble()).isEqualTo(220.0);
        assertThat(peerResponses.get(0).get("payload").get("y").asDouble()).isEqualTo(320.0);
    }

    @Test
    void handleTextMessageWithWebrtcOfferRoutesSignalToTargetSession() throws Exception {
        WebSocketSession sourceSession = createSession("session-source", 7L, "Alice");
        WebSocketSession targetSession = createSession("session-target", 11L, "Jisu");

        WebSocketMessage routedMessage = new WebSocketMessage(
                WebSocketEventType.WEBRTC_OFFER,
                objectMapper.readTree("""
                        {
                          "requestId": 10,
                          "scope": "mentoring_session",
                          "sdp": {
                            "type": "offer",
                            "sdp": "sample-offer"
                          }
                        }
                        """),
                7L,
                null
        );

        when(mentoringSessionSignalingService.supports(WebSocketEventType.WEBRTC_OFFER)).thenReturn(true);
        when(mentoringSessionSignalingService.routeSignal(ArgumentMatchers.any()))
                .thenReturn(new SignalRouteResult(Set.of(targetSession), routedMessage));

        realtimeWebSocketHandler.handleTextMessage(
                sourceSession,
                new TextMessage("""
                        {
                          "type": "webrtc_offer",
                          "senderId": 999,
                          "payload": {
                            "requestId": 10,
                            "scope": "mentoring_session",
                            "sdp": {
                              "type": "offer",
                              "sdp": "sample-offer"
                            }
                          }
                        }
                        """)
        );

        ArgumentCaptor<WebSocketMessage> routedMessageCaptor = ArgumentCaptor.forClass(WebSocketMessage.class);
        verify(mentoringSessionSignalingService).routeSignal(routedMessageCaptor.capture());

        assertThat(routedMessageCaptor.getValue().senderId()).isEqualTo(7L);
        List<JsonNode> sourceResponses = captureResponses(sourceSession, 1);
        List<JsonNode> targetResponses = captureResponses(targetSession, 1);

        assertThat(sourceResponses.get(0).get("type").asText()).isEqualTo("ws_ack");
        assertThat(targetResponses.get(0).get("type").asText()).isEqualTo("webrtc_offer");
        assertThat(targetResponses.get(0).get("senderId").asLong()).isEqualTo(7L);
    }

    @Test
    void handleTextMessageWithRejectedSignalSendsError() throws Exception {
        WebSocketSession session = createSession("session-4", 7L, "Alice");

        when(mentoringSessionSignalingService.supports(WebSocketEventType.WEBRTC_OFFER)).thenReturn(true);
        when(mentoringSessionSignalingService.routeSignal(ArgumentMatchers.any()))
                .thenThrow(new IllegalStateException("Target participant is not connected."));

        realtimeWebSocketHandler.handleTextMessage(
                session,
                new TextMessage("""
                        {
                          "type": "webrtc_offer",
                          "senderId": 1,
                          "payload": {
                            "requestId": 10,
                            "scope": "mentoring_session"
                          }
                        }
                        """)
        );

        JsonNode response = captureSingleResponse(session);

        assertThat(response.get("type").asText()).isEqualTo("ws_error");
        assertThat(response.get("payload").get("message").asText()).isEqualTo("Target participant is not connected.");
        assertThat(response.get("payload").get("receivedType").asText()).isEqualTo("webrtc_offer");
    }

    @Test
    void handleTextMessageWithoutAuthenticatedUserSendsError() throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-unauthenticated");
        when(session.getAttributes()).thenReturn(Map.of());

        realtimeWebSocketHandler.handleTextMessage(
                session,
                new TextMessage("""
                        {
                          "type": "chat_send",
                          "senderId": 999,
                          "payload": {
                            "spaceId": 1,
                            "content": "hello"
                          }
                        }
                        """)
        );

        JsonNode response = captureSingleResponse(session);

        assertThat(response.get("type").asText()).isEqualTo("ws_error");
        assertThat(response.get("payload").get("message").asText()).isEqualTo("WebSocket session is not authenticated.");
        assertThat(response.get("payload").get("receivedType").asText()).isEqualTo("chat_send");
    }

    @Test
    void afterConnectionClosedBroadcastsLeaveAndRemovesBoundSession() throws Exception {
        WebSocketSession sourceSession = createSession("session-source", 7L, "Alice");
        WebSocketSession peerSession = createSession("session-peer", 11L, "Jisu");

        realtimeSessionRegistry.bindSession(sourceSession, 7L);
        realtimeSessionRegistry.updateSessionPresence(sourceSession, 3L, 180.0, 260.0, null);
        realtimeSessionRegistry.bindSession(peerSession, 11L);
        realtimeSessionRegistry.updateSessionPresence(peerSession, 3L, 200.0, 280.0, null);

        realtimeWebSocketHandler.afterConnectionClosed(sourceSession, CloseStatus.NORMAL);

        List<JsonNode> peerResponses = captureResponses(peerSession, 1);

        assertThat(peerResponses.get(0).get("type").asText()).isEqualTo("user_leave");
        assertThat(peerResponses.get(0).get("senderId").asLong()).isEqualTo(7L);
        assertThat(realtimeSessionRegistry.findUserId(sourceSession)).isEmpty();
        assertThat(realtimeSessionRegistry.findSpaceId(sourceSession)).isEmpty();
    }

    private WebSocketSession createSession(String sessionId, Long userId, String nickname) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(sessionId);
        when(session.isOpen()).thenReturn(true);
        when(session.getAttributes()).thenReturn(Map.of(
                WebSocketSessionAttributes.USER_ID, userId,
                WebSocketSessionAttributes.USER_NICKNAME, nickname
        ));
        return session;
    }

    private JsonNode captureSingleResponse(WebSocketSession session) throws Exception {
        return captureResponses(session, 1).get(0);
    }

    private List<JsonNode> captureResponses(WebSocketSession session, int expectedCount) throws Exception {
        ArgumentCaptor<TextMessage> captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(session, times(expectedCount)).sendMessage(captor.capture());

        return captor.getAllValues().stream()
                .map(message -> {
                    try {
                        return objectMapper.readTree(message.getPayload());
                    } catch (JsonProcessingException exception) {
                        throw new IllegalStateException(exception);
                    }
                })
                .collect(Collectors.toList());
    }
}
