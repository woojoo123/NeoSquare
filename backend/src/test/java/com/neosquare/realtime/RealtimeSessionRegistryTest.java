package com.neosquare.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

class RealtimeSessionRegistryTest {

    private final RealtimeSessionRegistry realtimeSessionRegistry = new RealtimeSessionRegistry();

    @Test
    void updateSessionPresenceTracksSpaceAndPosition() {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-1");
        when(session.isOpen()).thenReturn(true);

        realtimeSessionRegistry.bindSession(session, 11L);
        realtimeSessionRegistry.updateSessionPresence(session, 3L, 120.0, 260.0, "sky-runner");

        assertThat(realtimeSessionRegistry.findUserId(session)).contains(11L);
        assertThat(realtimeSessionRegistry.findSpaceId(session)).contains(3L);
        assertThat(realtimeSessionRegistry.findPosition(session))
                .contains(new SessionPosition(120.0, 260.0));
        assertThat(realtimeSessionRegistry.findAvatarPresetId(session)).contains("sky-runner");
        assertThat(realtimeSessionRegistry.findOpenSessions(11L)).containsExactly(session);
        assertThat(realtimeSessionRegistry.findOpenSessionsInSpace(3L)).containsExactly(session);
    }

    @Test
    void clearSessionSpaceRemovesSpaceMembershipButKeepsUserBinding() {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-2");
        when(session.isOpen()).thenReturn(true);

        realtimeSessionRegistry.bindSession(session, 12L);
        realtimeSessionRegistry.updateSessionPresence(session, 4L, 88.0, 144.0, "forest-maker");

        realtimeSessionRegistry.clearSessionSpace(session);

        assertThat(realtimeSessionRegistry.findUserId(session)).contains(12L);
        assertThat(realtimeSessionRegistry.findSpaceId(session)).isEmpty();
        assertThat(realtimeSessionRegistry.findPosition(session)).isEmpty();
        assertThat(realtimeSessionRegistry.findAvatarPresetId(session)).isEmpty();
        assertThat(realtimeSessionRegistry.findOpenSessionsInSpace(4L)).isEmpty();
    }

    @Test
    void removeSessionCleansUpBoundMappings() {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-3");
        when(session.isOpen()).thenReturn(true);

        realtimeSessionRegistry.bindSession(session, 13L);
        realtimeSessionRegistry.updateSessionPresence(session, 5L, 32.0, 64.0, "sunset-guide");

        realtimeSessionRegistry.removeSession(session);

        assertThat(realtimeSessionRegistry.findUserId(session)).isEmpty();
        assertThat(realtimeSessionRegistry.findSpaceId(session)).isEmpty();
        assertThat(realtimeSessionRegistry.findPosition(session)).isEmpty();
        assertThat(realtimeSessionRegistry.findAvatarPresetId(session)).isEmpty();
        assertThat(realtimeSessionRegistry.findOpenSessions(13L)).isEmpty();
        assertThat(realtimeSessionRegistry.findOpenSessionsInSpace(5L)).isEmpty();
    }

    @Test
    void findOpenSessionsPrunesClosedSessions() {
        WebSocketSession closedSession = mock(WebSocketSession.class);
        when(closedSession.getId()).thenReturn("session-closed");
        when(closedSession.isOpen()).thenReturn(false);

        realtimeSessionRegistry.bindSession(closedSession, 14L);
        realtimeSessionRegistry.updateSessionPresence(closedSession, 7L, 30.0, 40.0, null);

        assertThat(realtimeSessionRegistry.findOpenSessions(14L)).isEmpty();
        assertThat(realtimeSessionRegistry.findOpenSessionsInSpace(7L)).isEmpty();
    }

    @Test
    void updateSessionPresenceRequiresBoundSession() {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-4");

        assertThatThrownBy(() -> realtimeSessionRegistry.updateSessionPresence(session, 6L, 10.0, 20.0, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("WebSocket session must be bound before presence is updated.");
    }
}
