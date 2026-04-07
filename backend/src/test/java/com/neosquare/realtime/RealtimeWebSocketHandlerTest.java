package com.neosquare.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

class RealtimeWebSocketHandlerTest {

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private RealtimeWebSocketHandler realtimeWebSocketHandler;
    private MentoringSessionSignalingService mentoringSessionSignalingService;
    private RealtimeSessionRegistry realtimeSessionRegistry;

    @BeforeEach
    void setUp() {
        mentoringSessionSignalingService = mock(MentoringSessionSignalingService.class);
        realtimeSessionRegistry = mock(RealtimeSessionRegistry.class);
        realtimeWebSocketHandler = new RealtimeWebSocketHandler(
                objectMapper,
                mentoringSessionSignalingService,
                realtimeSessionRegistry
        );
    }

    @Test
    void afterConnectionEstablishedSendsConnectedMessage() throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-1");

        realtimeWebSocketHandler.afterConnectionEstablished(session);

        JsonNode response = captureResponse(session);

        assertThat(response.get("type").asText()).isEqualTo("ws_connected");
        assertThat(response.get("payload").get("sessionId").asText()).isEqualTo("session-1");
        assertThat(response.get("payload").get("message").asText()).isEqualTo("WebSocket connected.");
        assertThat(response.get("timestamp").asText()).isNotBlank();
    }

    @Test
    void handleTextMessageWithValidPayloadSendsAck() throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-2");

        realtimeWebSocketHandler.handleTextMessage(
                session,
                new TextMessage("""
                        {
                          "type": "user_enter",
                          "senderId": 1,
                          "payload": {
                            "spaceId": 1
                          }
                        }
                        """)
        );

        JsonNode response = captureResponse(session);

        assertThat(response.get("type").asText()).isEqualTo("ws_ack");
        assertThat(response.get("payload").get("receivedType").asText()).isEqualTo("user_enter");
        assertThat(response.get("payload").get("sessionId").asText()).isEqualTo("session-2");
        assertThat(response.get("payload").get("message").asText()).isEqualTo("Message received.");
    }

    @Test
    void handleTextMessageWithWebrtcOfferRoutesSignalToTargetSession() throws Exception {
        WebSocketSession sourceSession = mock(WebSocketSession.class);
        WebSocketSession targetSession = mock(WebSocketSession.class);
        when(sourceSession.getId()).thenReturn("session-source");

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
                1L,
                null
        );

        when(mentoringSessionSignalingService.supports(WebSocketEventType.WEBRTC_OFFER)).thenReturn(true);
        when(mentoringSessionSignalingService.routeSignal(org.mockito.ArgumentMatchers.any()))
                .thenReturn(new SignalRouteResult(Set.of(targetSession), routedMessage));

        realtimeWebSocketHandler.handleTextMessage(
                sourceSession,
                new TextMessage("""
                        {
                          "type": "webrtc_offer",
                          "senderId": 1,
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

        JsonNode ackResponse = captureResponse(sourceSession);
        JsonNode routedResponse = captureResponse(targetSession);

        assertThat(ackResponse.get("type").asText()).isEqualTo("ws_ack");
        assertThat(ackResponse.get("payload").get("receivedType").asText()).isEqualTo("webrtc_offer");
        assertThat(routedResponse.get("type").asText()).isEqualTo("webrtc_offer");
        assertThat(routedResponse.get("senderId").asLong()).isEqualTo(1L);
        assertThat(routedResponse.get("payload").get("requestId").asLong()).isEqualTo(10L);
        assertThat(routedResponse.get("payload").get("scope").asText()).isEqualTo("mentoring_session");
    }

    @Test
    void handleTextMessageWithRejectedSignalSendsError() throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-4");

        when(mentoringSessionSignalingService.supports(WebSocketEventType.WEBRTC_OFFER)).thenReturn(true);
        when(mentoringSessionSignalingService.routeSignal(org.mockito.ArgumentMatchers.any()))
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

        JsonNode response = captureResponse(session);

        assertThat(response.get("type").asText()).isEqualTo("ws_error");
        assertThat(response.get("payload").get("message").asText()).isEqualTo("Target participant is not connected.");
        assertThat(response.get("payload").get("receivedType").asText()).isEqualTo("webrtc_offer");
    }

    @Test
    void handleTextMessageWithInvalidPayloadSendsError() throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-3");

        realtimeWebSocketHandler.handleTextMessage(
                session,
                new TextMessage("""
                        {
                          "payload": {
                            "spaceId": 1
                          }
                        }
                        """)
        );

        JsonNode response = captureResponse(session);

        assertThat(response.get("type").asText()).isEqualTo("ws_error");
        assertThat(response.get("payload").get("message").asText()).isEqualTo("Invalid WebSocket message.");
    }

    private JsonNode captureResponse(WebSocketSession session) throws Exception {
        ArgumentCaptor<TextMessage> captor = ArgumentCaptor.forClass(TextMessage.class);

        verify(session).sendMessage(captor.capture());

        return objectMapper.readTree(captor.getValue().getPayload());
    }
}
