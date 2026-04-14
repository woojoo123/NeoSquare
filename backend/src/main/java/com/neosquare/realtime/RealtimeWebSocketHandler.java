package com.neosquare.realtime;

import java.util.Set;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
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
    private static final String CHAT_SCOPE_PUBLIC = "PUBLIC";
    private static final String CHAT_SCOPE_WHISPER = "WHISPER";

    private final ObjectMapper objectMapper;
    private final MentoringSessionSignalingService mentoringSessionSignalingService;
    private final RealtimeSessionRegistry realtimeSessionRegistry;
    private final SessionChatRoutingService sessionChatRoutingService;

    public RealtimeWebSocketHandler(
            ObjectMapper objectMapper,
            MentoringSessionSignalingService mentoringSessionSignalingService,
            RealtimeSessionRegistry realtimeSessionRegistry,
            SessionChatRoutingService sessionChatRoutingService
    ) {
        this.objectMapper = objectMapper;
        this.mentoringSessionSignalingService = mentoringSessionSignalingService;
        this.realtimeSessionRegistry = realtimeSessionRegistry;
        this.sessionChatRoutingService = sessionChatRoutingService;
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
        try {
            broadcastSessionLeave(session);
        } catch (Exception exception) {
            log.warn("Failed to broadcast WebSocket leave message. sessionId={}", session.getId(), exception);
        }

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

            if (sessionChatRoutingService.supports(normalizedMessage)) {
                SignalRouteResult routeResult = sessionChatRoutingService.routeChatMessage(normalizedMessage);

                for (WebSocketSession targetSession : routeResult.targetSessions()) {
                    if (targetSession.getId().equals(session.getId())) {
                        continue;
                    }

                    sendMessage(targetSession, routeResult.outboundMessage());
                }
            } else if (sessionChatRoutingService.hasScopedChat(normalizedMessage)) {
                throw new IllegalArgumentException("Unsupported chat scope.");
            } else if (isSpaceRealtimeEvent(normalizedMessage.type())) {
                handleSpaceRealtimeMessage(session, normalizedMessage);
            }

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

    private void handleSpaceRealtimeMessage(WebSocketSession session, WebSocketMessage normalizedMessage) throws Exception {
        Long spaceId = resolveSpaceId(session, normalizedMessage.payload(), normalizedMessage.type());
        Long previousSpaceId = realtimeSessionRegistry.findSpaceId(session).orElse(null);
        Double x = extractCoordinate(normalizedMessage.payload(), "x");
        Double y = extractCoordinate(normalizedMessage.payload(), "y");
        String avatarPresetId = extractStringPayloadValue(normalizedMessage.payload(), "avatarPresetId");

        if (normalizedMessage.type() != WebSocketEventType.USER_LEAVE) {
            if (previousSpaceId != null && !previousSpaceId.equals(spaceId)) {
                broadcastLeaveToSpace(previousSpaceId, normalizedMessage.senderId(), session);
            }

            realtimeSessionRegistry.updateSessionPresence(session, spaceId, x, y, avatarPresetId);
        }

        switch (normalizedMessage.type()) {
            case USER_ENTER -> {
                sendCurrentSpaceParticipants(session, spaceId);
                broadcastToSpace(spaceId, normalizedMessage, session);
            }
            case USER_MOVE -> broadcastToSpace(spaceId, normalizedMessage, session);
            case CHAT_SEND -> handleSpaceChatMessage(session, normalizedMessage, spaceId);
            case USER_LEAVE -> {
                broadcastToSpace(spaceId, normalizedMessage, session);
                realtimeSessionRegistry.clearSessionSpace(session);
            }
            default -> {
            }
        }
    }

    private void sendCurrentSpaceParticipants(WebSocketSession session, Long spaceId) throws Exception {
        Set<WebSocketSession> sessionsInSpace = realtimeSessionRegistry.findOpenSessionsInSpace(spaceId);

        for (WebSocketSession peerSession : sessionsInSpace) {
            if (peerSession.getId().equals(session.getId())) {
                continue;
            }

            WebSocketMessage snapshotMessage = buildPresenceSnapshot(peerSession, spaceId);

            if (snapshotMessage != null) {
                sendMessage(session, snapshotMessage);
            }
        }
    }

    private WebSocketMessage buildPresenceSnapshot(WebSocketSession session, Long spaceId) {
        Long userId = realtimeSessionRegistry.findUserId(session).orElse(null);

        if (userId == null) {
            return null;
        }

        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.put("spaceId", spaceId);
        payload.put("userId", userId);

        realtimeSessionRegistry.findPosition(session).ifPresent(position -> {
            payload.put("x", position.x());
            payload.put("y", position.y());
        });

        String nickname = extractAuthenticatedNickname(session);

        if (nickname != null) {
            payload.put("nickname", nickname);
        }

        realtimeSessionRegistry.findAvatarPresetId(session)
                .filter(avatarId -> !avatarId.isBlank())
                .ifPresent(avatarId -> payload.put("avatarPresetId", avatarId));

        return WebSocketMessage.relay(WebSocketEventType.USER_ENTER, payload, userId);
    }

    private void broadcastSessionLeave(WebSocketSession session) throws Exception {
        Long userId = realtimeSessionRegistry.findUserId(session).orElse(null);
        Long spaceId = realtimeSessionRegistry.findSpaceId(session).orElse(null);

        if (userId == null || spaceId == null) {
            return;
        }

        broadcastLeaveToSpace(spaceId, userId, session);
    }

    private void broadcastLeaveToSpace(Long spaceId, Long userId, WebSocketSession sourceSession) throws Exception {
        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.put("spaceId", spaceId);
        payload.put("userId", userId);

        broadcastToSpace(
                spaceId,
                WebSocketMessage.relay(WebSocketEventType.USER_LEAVE, payload, userId),
                sourceSession
        );
    }

    private void broadcastToSpace(
            Long spaceId,
            WebSocketMessage outboundMessage,
            WebSocketSession sourceSession
    ) throws Exception {
        Set<WebSocketSession> targetSessions = realtimeSessionRegistry.findOpenSessionsInSpace(spaceId);

        for (WebSocketSession targetSession : targetSessions) {
            if (sourceSession != null && targetSession.getId().equals(sourceSession.getId())) {
                continue;
            }

            sendMessage(targetSession, outboundMessage);
        }
    }

    private void handleSpaceChatMessage(
            WebSocketSession session,
            WebSocketMessage normalizedMessage,
            Long spaceId
    ) throws Exception {
        String chatScope = extractChatScope(normalizedMessage.payload());

        if (CHAT_SCOPE_WHISPER.equals(chatScope)) {
            Long recipientUserId = extractRequiredLongPayloadValue(normalizedMessage.payload(), "recipientUserId");

            if (recipientUserId.equals(normalizedMessage.senderId())) {
                throw new IllegalArgumentException("귓속말 대상은 다른 참가자여야 합니다.");
            }

            broadcastWhisperToUserInSpace(spaceId, recipientUserId, normalizedMessage, session);
            return;
        }

        broadcastToSpace(spaceId, normalizedMessage, session);
    }

    private void broadcastWhisperToUserInSpace(
            Long spaceId,
            Long recipientUserId,
            WebSocketMessage outboundMessage,
            WebSocketSession sourceSession
    ) throws Exception {
        Set<WebSocketSession> targetSessions =
                realtimeSessionRegistry.findOpenSessionsInSpaceByUserId(spaceId, recipientUserId);

        for (WebSocketSession targetSession : targetSessions) {
            if (sourceSession != null && targetSession.getId().equals(sourceSession.getId())) {
                continue;
            }

            sendMessage(targetSession, outboundMessage);
        }
    }

    private boolean isSpaceRealtimeEvent(WebSocketEventType eventType) {
        return eventType == WebSocketEventType.USER_ENTER
                || eventType == WebSocketEventType.USER_LEAVE
                || eventType == WebSocketEventType.USER_MOVE
                || eventType == WebSocketEventType.CHAT_SEND;
    }

    private Long resolveSpaceId(
            WebSocketSession session,
            JsonNode payload,
            WebSocketEventType eventType
    ) {
        Long payloadSpaceId = extractSpaceId(payload);

        if (payloadSpaceId != null) {
            return payloadSpaceId;
        }

        return realtimeSessionRegistry.findSpaceId(session)
                .orElseThrow(() -> new IllegalStateException(
                        "WebSocket " + eventType.getValue() + " message requires a spaceId."
                ));
    }

    private Long extractSpaceId(JsonNode payload) {
        if (payload == null || payload.get("spaceId") == null || payload.get("spaceId").isNull()) {
            return null;
        }

        JsonNode spaceIdNode = payload.get("spaceId");

        if (spaceIdNode.canConvertToLong()) {
            return spaceIdNode.asLong();
        }

        if (spaceIdNode.isTextual()) {
            try {
                return Long.parseLong(spaceIdNode.asText());
            } catch (NumberFormatException exception) {
                throw new IllegalArgumentException("WebSocket spaceId must be numeric.");
            }
        }

        throw new IllegalArgumentException("WebSocket spaceId must be numeric.");
    }

    private Double extractCoordinate(JsonNode payload, String fieldName) {
        if (payload == null || payload.get(fieldName) == null || payload.get(fieldName).isNull()) {
            return null;
        }

        JsonNode coordinateNode = payload.get(fieldName);

        if (coordinateNode.isNumber()) {
            return coordinateNode.asDouble();
        }

        if (coordinateNode.isTextual()) {
            try {
                return Double.parseDouble(coordinateNode.asText());
            } catch (NumberFormatException exception) {
                throw new IllegalArgumentException("WebSocket " + fieldName + " must be numeric.");
            }
        }

        throw new IllegalArgumentException("WebSocket " + fieldName + " must be numeric.");
    }

    private String extractStringPayloadValue(JsonNode payload, String fieldName) {
        if (payload == null || payload.get(fieldName) == null || payload.get(fieldName).isNull()) {
            return null;
        }

        JsonNode valueNode = payload.get(fieldName);

        if (!valueNode.isTextual()) {
            throw new IllegalArgumentException("WebSocket " + fieldName + " must be text.");
        }

        String value = valueNode.asText();
        return value.isBlank() ? null : value;
    }

    private Long extractRequiredLongPayloadValue(JsonNode payload, String fieldName) {
        String value = extractStringPayloadValue(payload, fieldName);

        if (value == null) {
            JsonNode valueNode = payload == null ? null : payload.get(fieldName);

            if (valueNode != null && valueNode.isNumber()) {
                return valueNode.longValue();
            }

            throw new IllegalArgumentException("WebSocket " + fieldName + " is required.");
        }

        try {
            return Long.parseLong(value);
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("WebSocket " + fieldName + " must be numeric.");
        }
    }

    private String extractChatScope(JsonNode payload) {
        String chatScope = extractStringPayloadValue(payload, "scope");

        if (chatScope == null) {
            return CHAT_SCOPE_PUBLIC;
        }

        String normalizedScope = chatScope.trim().toUpperCase();

        if (CHAT_SCOPE_PUBLIC.equals(normalizedScope) || CHAT_SCOPE_WHISPER.equals(normalizedScope)) {
            return normalizedScope;
        }

        throw new IllegalArgumentException("Unsupported chat scope.");
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
