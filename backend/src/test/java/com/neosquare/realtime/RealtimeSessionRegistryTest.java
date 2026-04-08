package com.neosquare.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

class RealtimeSessionRegistryTest {

    private final RealtimeSessionRegistry realtimeSessionRegistry = new RealtimeSessionRegistry();

    @Test
    void removeSessionCleansUpBoundUserMapping() {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-1");
        when(session.isOpen()).thenReturn(true);

        realtimeSessionRegistry.bindSession(session, 11L);

        assertThat(realtimeSessionRegistry.findUserId(session)).contains(11L);
        assertThat(realtimeSessionRegistry.findOpenSessions(11L)).containsExactly(session);

        realtimeSessionRegistry.removeSession(session);

        assertThat(realtimeSessionRegistry.findUserId(session)).isEmpty();
        assertThat(realtimeSessionRegistry.findOpenSessions(11L)).isEmpty();
    }
}
