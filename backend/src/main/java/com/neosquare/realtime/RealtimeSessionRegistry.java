package com.neosquare.realtime;

import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

@Component
public class RealtimeSessionRegistry {

    private final Map<Long, Set<WebSocketSession>> sessionsByUserId = new ConcurrentHashMap<>();
    private final Map<Long, Set<WebSocketSession>> sessionsBySpaceId = new ConcurrentHashMap<>();
    private final Map<String, Long> userIdBySessionId = new ConcurrentHashMap<>();
    private final Map<String, Long> spaceIdBySessionId = new ConcurrentHashMap<>();
    private final Map<String, SessionPosition> positionBySessionId = new ConcurrentHashMap<>();
    private final Map<String, String> avatarPresetIdBySessionId = new ConcurrentHashMap<>();

    public void bindSession(WebSocketSession session, Long userId) {
        Long existingUserId = userIdBySessionId.get(session.getId());

        if (existingUserId != null && !existingUserId.equals(userId)) {
            throw new IllegalStateException("WebSocket session is already bound to a different user.");
        }

        userIdBySessionId.put(session.getId(), userId);
        sessionsByUserId.computeIfAbsent(userId, ignored -> ConcurrentHashMap.newKeySet()).add(session);
    }

    public void updateSessionPresence(
            WebSocketSession session,
            Long spaceId,
            Double x,
            Double y,
            String avatarPresetId
    ) {
        assertSessionBound(session);

        Long previousSpaceId = spaceIdBySessionId.put(session.getId(), spaceId);

        if (previousSpaceId != null && !previousSpaceId.equals(spaceId)) {
            removeSessionFromSpace(session, previousSpaceId);
        }

        sessionsBySpaceId.computeIfAbsent(spaceId, ignored -> ConcurrentHashMap.newKeySet()).add(session);

        if (x != null && y != null) {
            positionBySessionId.put(session.getId(), new SessionPosition(x, y));
        }

        if (avatarPresetId != null && !avatarPresetId.isBlank()) {
            avatarPresetIdBySessionId.put(session.getId(), avatarPresetId);
        }
    }

    public void clearSessionSpace(WebSocketSession session) {
        Long spaceId = spaceIdBySessionId.remove(session.getId());

        if (spaceId == null) {
            return;
        }

        removeSessionFromSpace(session, spaceId);
        positionBySessionId.remove(session.getId());
        avatarPresetIdBySessionId.remove(session.getId());
    }

    public Set<WebSocketSession> findOpenSessions(Long userId) {
        return findOpenSessionsFromMap(sessionsByUserId, userId);
    }

    public Set<WebSocketSession> findOpenSessionsInSpace(Long spaceId) {
        return findOpenSessionsFromMap(sessionsBySpaceId, spaceId);
    }

    public Set<WebSocketSession> findOpenSessionsInSpaceByUserId(Long spaceId, Long userId) {
        Set<WebSocketSession> userSessions = findOpenSessions(userId);

        if (userSessions.isEmpty()) {
            return Set.of();
        }

        return userSessions.stream()
                .filter(session -> findSpaceId(session).map(spaceId::equals).orElse(false))
                .collect(Collectors.toUnmodifiableSet());
    }

    public Optional<Long> findUserId(WebSocketSession session) {
        return Optional.ofNullable(userIdBySessionId.get(session.getId()));
    }

    public Optional<Long> findSpaceId(WebSocketSession session) {
        return Optional.ofNullable(spaceIdBySessionId.get(session.getId()));
    }

    public Optional<SessionPosition> findPosition(WebSocketSession session) {
        return Optional.ofNullable(positionBySessionId.get(session.getId()));
    }

    public Optional<String> findAvatarPresetId(WebSocketSession session) {
        return Optional.ofNullable(avatarPresetIdBySessionId.get(session.getId()));
    }

    public void removeSession(WebSocketSession session) {
        clearSessionSpace(session);

        Long userId = userIdBySessionId.remove(session.getId());
        avatarPresetIdBySessionId.remove(session.getId());

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

    private void assertSessionBound(WebSocketSession session) {
        if (!userIdBySessionId.containsKey(session.getId())) {
            throw new IllegalStateException("WebSocket session must be bound before presence is updated.");
        }
    }

    private Set<WebSocketSession> findOpenSessionsFromMap(
            Map<Long, Set<WebSocketSession>> sessionMap,
            Long key
    ) {
        Set<WebSocketSession> sessions = sessionMap.get(key);

        if (sessions == null || sessions.isEmpty()) {
            return Set.of();
        }

        Set<WebSocketSession> openSessions = sessions.stream()
                .filter(WebSocketSession::isOpen)
                .collect(Collectors.toSet());

        sessions.retainAll(openSessions);

        if (sessions.isEmpty()) {
            sessionMap.remove(key);
        }

        return Set.copyOf(openSessions);
    }

    private void removeSessionFromSpace(WebSocketSession session, Long spaceId) {
        Set<WebSocketSession> sessions = sessionsBySpaceId.get(spaceId);

        if (sessions == null) {
            return;
        }

        sessions.remove(session);

        if (sessions.isEmpty()) {
            sessionsBySpaceId.remove(spaceId);
        }
    }
}
