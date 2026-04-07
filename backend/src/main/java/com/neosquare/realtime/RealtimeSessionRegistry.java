package com.neosquare.realtime;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

@Component
public class RealtimeSessionRegistry {

    private final Map<Long, Set<WebSocketSession>> sessionsByUserId = new ConcurrentHashMap<>();
    private final Map<String, Long> userIdBySessionId = new ConcurrentHashMap<>();

    public void bindSession(WebSocketSession session, Long userId) {
        Long existingUserId = userIdBySessionId.get(session.getId());

        if (existingUserId != null && !existingUserId.equals(userId)) {
            throw new IllegalStateException("WebSocket session is already bound to a different user.");
        }

        userIdBySessionId.put(session.getId(), userId);
        sessionsByUserId.computeIfAbsent(userId, ignored -> ConcurrentHashMap.newKeySet()).add(session);
    }

    public Set<WebSocketSession> findOpenSessions(Long userId) {
        Set<WebSocketSession> sessions = sessionsByUserId.get(userId);

        if (sessions == null || sessions.isEmpty()) {
            return Set.of();
        }

        Set<WebSocketSession> openSessions = sessions.stream()
                .filter(WebSocketSession::isOpen)
                .collect(Collectors.toSet());

        sessions.retainAll(openSessions);

        if (sessions.isEmpty()) {
            sessionsByUserId.remove(userId);
        }

        return Set.copyOf(openSessions);
    }

    public void removeSession(WebSocketSession session) {
        Long userId = userIdBySessionId.remove(session.getId());

        if (userId == null) {
            return;
        }

        Set<WebSocketSession> sessions = sessionsByUserId.get(userId);

        if (sessions == null) {
            return;
        }

        sessions.remove(session);

        if (sessions.isEmpty()) {
            sessionsByUserId.remove(userId);
        }
    }
}
