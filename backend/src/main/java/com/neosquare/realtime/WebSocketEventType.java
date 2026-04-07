package com.neosquare.realtime;

import java.util.Arrays;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum WebSocketEventType {
    USER_ENTER("user_enter"),
    USER_LEAVE("user_leave"),
    USER_MOVE("user_move"),
    CHAT_SEND("chat_send"),
    WEBRTC_OFFER("webrtc_offer"),
    WEBRTC_ANSWER("webrtc_answer"),
    WEBRTC_ICE_CANDIDATE("webrtc_ice_candidate"),
    WS_CONNECTED("ws_connected"),
    WS_ACK("ws_ack"),
    WS_ERROR("ws_error");

    private final String value;

    WebSocketEventType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static WebSocketEventType fromValue(String value) {
        return Arrays.stream(values())
                .filter(eventType -> eventType.value.equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported WebSocket event type: " + value));
    }
}
