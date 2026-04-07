package com.neosquare.realtime;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record WebSocketMessage(
        WebSocketEventType type,
        JsonNode payload,
        Long senderId,
        Instant timestamp
) {

    public static WebSocketMessage connected(String sessionId) {
        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.put("sessionId", sessionId);
        payload.put("message", "WebSocket connected.");

        return new WebSocketMessage(
                WebSocketEventType.WS_CONNECTED,
                payload,
                null,
                Instant.now()
        );
    }

    public static WebSocketMessage ack(WebSocketEventType receivedType, String sessionId) {
        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.put("receivedType", receivedType.getValue());
        payload.put("sessionId", sessionId);
        payload.put("message", "Message received.");

        return new WebSocketMessage(
                WebSocketEventType.WS_ACK,
                payload,
                null,
                Instant.now()
        );
    }

    public static WebSocketMessage error(String message) {
        return error(message, null);
    }

    public static WebSocketMessage error(String message, WebSocketEventType receivedType) {
        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.put("message", message);
        if (receivedType != null) {
            payload.put("receivedType", receivedType.getValue());
        }

        return new WebSocketMessage(
                WebSocketEventType.WS_ERROR,
                payload,
                null,
                Instant.now()
        );
    }

    public static WebSocketMessage relay(WebSocketEventType type, JsonNode payload, Long senderId) {
        return new WebSocketMessage(type, payload, senderId, Instant.now());
    }
}
