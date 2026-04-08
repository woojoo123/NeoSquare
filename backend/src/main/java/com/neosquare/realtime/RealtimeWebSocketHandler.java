package com.neosquare.realtime;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class RealtimeWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(RealtimeWebSocketHandler.class);

    private final ObjectMapper objectMapper;
    private final MentoringSessionSignalingService mentoringSessionSignalingService;
    private final RealtimeSessionRegistry realtimeSessionRegistry;

    public RealtimeWebSocketHandler(
            ObjectMapper objectMapper,
            MentoringSessionSignalingService mentoringSessionSignalingService,
            RealtimeSessionRegistry realtimeSessionRegistry
    ) {
        this.objectMapper = objectMapper;
        this.mentoringSessionSignalingService = mentoringSessionSignalingService;
        this.realtimeSessionRegistry = realtimeSessionRegistry;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        try {
            Long authenticatedUserId = extractAuthenticatedUserId(session);
            realtimeSessionRegistry.bindSession(session, authenticatedUserId);
            log.info(
                    "WebSocket connected. sessionId={}, userId={}",
                    session.getId(),
                    authenticatedUserId
            );
        } catch (IllegalStateException exception) {
            log.warn("Closing unauthenticated WebSocket session. sessionId={}", session.getId(), exception);
            session.close(new CloseStatus(
                    CloseStatus.POLICY_VIOLATION.getCode(),
                    "WebSocket authentication required."
            ));
            return;
        }

        sendMessage(session, WebSocketMessage.connected(session.getId()));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        realtimeSessionRegistry.removeSession(session);
        log.info(
                "WebSocket disconnected. sessionId={}, code={}, reason={}",
                session.getId(),
                status.getCode(),
                status.getReason()
        );
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("WebSocket transport error. sessionId={}", session.getId(), exception);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        WebSocketEventType incomingType = null;

        try {
            WebSocketMessage incomingMessage = objectMapper.readValue(message.getPayload(), WebSocketMessage.class);

            if (incomingMessage.type() == null) {
                throw new IllegalArgumentException("WebSocket message type is required.");
            }

            incomingType = incomingMessage.type();
            WebSocketMessage normalizedMessage = normalizeIncomingMessage(session, incomingMessage);

            log.info(
                    "WebSocket message received. sessionId={}, type={}, senderId={}",
                    session.getId(),
                    normalizedMessage.type().getValue(),
                    normalizedMessage.senderId()
            );

            if (mentoringSessionSignalingService.supports(normalizedMessage.type())) {
                SignalRouteResult routeResult = mentoringSessionSignalingService.routeSignal(normalizedMessage);

                for (WebSocketSession targetSession : routeResult.targetSessions()) {
                    sendMessage(targetSession, routeResult.outboundMessage());
                }
            }

            sendMessage(session, WebSocketMessage.ack(normalizedMessage.type(), session.getId()));
        } catch (JsonProcessingException exception) {
            log.warn("Invalid WebSocket message. sessionId={}", session.getId(), exception);
            sendMessage(session, WebSocketMessage.error("Invalid WebSocket message."));
        } catch (IllegalArgumentException | IllegalStateException exception) {
            log.warn("WebSocket message rejected. sessionId={}", session.getId(), exception);
            if (incomingType == null) {
                sendMessage(session, WebSocketMessage.error("Invalid WebSocket message."));
            } else {
                sendMessage(session, WebSocketMessage.error(exception.getMessage(), incomingType));
            }
        }
    }

    private void sendMessage(WebSocketSession session, WebSocketMessage message) throws Exception {
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
    }

    private WebSocketMessage normalizeIncomingMessage(WebSocketSession session, WebSocketMessage incomingMessage) {
        Long authenticatedUserId = extractAuthenticatedUserId(session);

        if (incomingMessage.senderId() != null && !incomingMessage.senderId().equals(authenticatedUserId)) {
            log.warn(
                    "Ignoring spoofed WebSocket senderId. sessionId={}, clientSenderId={}, authenticatedUserId={}",
                    session.getId(),
                    incomingMessage.senderId(),
                    authenticatedUserId
            );
        }

        return new WebSocketMessage(
                incomingMessage.type(),
                normalizePayload(session, incomingMessage.type(), incomingMessage.payload(), authenticatedUserId),
                authenticatedUserId,
                incomingMessage.timestamp()
        );
    }

    private JsonNode normalizePayload(
            WebSocketSession session,
            WebSocketEventType eventType,
            JsonNode payload,
            Long authenticatedUserId
    ) {
        if (!(payload instanceof ObjectNode objectPayload)) {
            return payload;
        }

        ObjectNode normalizedPayload = objectPayload.deepCopy();

        switch (eventType) {
            case USER_ENTER, USER_LEAVE, USER_MOVE, CHAT_SEND -> {
                normalizedPayload.put("userId", authenticatedUserId);
                String nickname = extractAuthenticatedNickname(session);

                if (nickname != null && (eventType == WebSocketEventType.USER_ENTER || eventType == WebSocketEventType.CHAT_SEND)) {
                    normalizedPayload.put("nickname", nickname);
                }
            }
            default -> {
            }
        }

        return normalizedPayload;
    }

    private Long extractAuthenticatedUserId(WebSocketSession session) {
        Object rawUserId = session.getAttributes().get(WebSocketSessionAttributes.USER_ID);

        if (rawUserId instanceof Long userId) {
            return userId;
        }

        if (rawUserId instanceof Number number) {
            return number.longValue();
        }

        if (rawUserId instanceof String userIdText && !userIdText.isBlank()) {
            try {
                return Long.parseLong(userIdText);
            } catch (NumberFormatException exception) {
                throw new IllegalStateException("WebSocket session authenticated userId must be numeric.");
            }
        }

        throw new IllegalStateException("WebSocket session is not authenticated.");
    }

    private String extractAuthenticatedNickname(WebSocketSession session) {
        Object rawNickname = session.getAttributes().get(WebSocketSessionAttributes.USER_NICKNAME);

        if (rawNickname instanceof String nickname && !nickname.isBlank()) {
            return nickname;
        }

        return null;
    }
}
