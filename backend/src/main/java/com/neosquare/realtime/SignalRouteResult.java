package com.neosquare.realtime;

import java.util.Objects;
import java.util.Set;

import org.springframework.web.socket.WebSocketSession;

public record SignalRouteResult(
        Set<WebSocketSession> targetSessions,
        WebSocketMessage outboundMessage
) {
    public SignalRouteResult {
        targetSessions = Set.copyOf(targetSessions);
        Objects.requireNonNull(outboundMessage);
    }
}
