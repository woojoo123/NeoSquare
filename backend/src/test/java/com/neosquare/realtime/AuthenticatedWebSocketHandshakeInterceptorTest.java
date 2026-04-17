package com.neosquare.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.Map;

import com.neosquare.auth.AuthUserPrincipal;
import com.neosquare.auth.JwtTokenProvider;
import com.neosquare.user.UserRole;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.socket.WebSocketHandler;

class AuthenticatedWebSocketHandshakeInterceptorTest {

    private JwtTokenProvider jwtTokenProvider;
    private AuthenticatedWebSocketHandshakeInterceptor authenticatedWebSocketHandshakeInterceptor;

    @BeforeEach
    void setUp() {
        jwtTokenProvider = mock(JwtTokenProvider.class);
        authenticatedWebSocketHandshakeInterceptor = new AuthenticatedWebSocketHandshakeInterceptor(
                jwtTokenProvider
        );
    }

    @Test
    void beforeHandshakeWithValidTicketStoresAuthenticatedUserAttributes() {
        AuthUserPrincipal user = new AuthUserPrincipal(7L, "alice@neo.square", "Alice", UserRole.USER);
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("GET", "/ws");
        servletRequest.setQueryString("ticket=valid-ticket");
        MockHttpServletResponse servletResponse = new MockHttpServletResponse();
        Map<String, Object> attributes = new HashMap<>();

        when(jwtTokenProvider.isWebSocketTicket("valid-ticket")).thenReturn(true);
        when(jwtTokenProvider.getWebSocketTicketClaims("valid-ticket"))
                .thenReturn(new com.neosquare.auth.WebSocketTicketClaims(
                        user.id(),
                        user.email(),
                        user.nickname(),
                        user.role()
                ));

        boolean handshakeAccepted = authenticatedWebSocketHandshakeInterceptor.beforeHandshake(
                new ServletServerHttpRequest(servletRequest),
                new ServletServerHttpResponse(servletResponse),
                mock(WebSocketHandler.class),
                attributes
        );

        assertThat(handshakeAccepted).isTrue();
        assertThat(attributes.get(WebSocketSessionAttributes.USER_ID)).isEqualTo(7L);
        assertThat(attributes.get(WebSocketSessionAttributes.USER_EMAIL)).isEqualTo("alice@neo.square");
        assertThat(attributes.get(WebSocketSessionAttributes.USER_NICKNAME)).isEqualTo("Alice");
    }

    @Test
    void beforeHandshakeWithoutTokenRejectsConnection() {
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("GET", "/ws");
        MockHttpServletResponse servletResponse = new MockHttpServletResponse();

        boolean handshakeAccepted = authenticatedWebSocketHandshakeInterceptor.beforeHandshake(
                new ServletServerHttpRequest(servletRequest),
                new ServletServerHttpResponse(servletResponse),
                mock(WebSocketHandler.class),
                new HashMap<>()
        );

        assertThat(handshakeAccepted).isFalse();
        assertThat(servletResponse.getStatus()).isEqualTo(401);
    }
}
