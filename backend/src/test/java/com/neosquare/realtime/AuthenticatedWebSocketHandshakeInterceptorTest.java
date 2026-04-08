package com.neosquare.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import com.neosquare.auth.JwtTokenProvider;
import com.neosquare.user.User;
import com.neosquare.user.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.socket.WebSocketHandler;

class AuthenticatedWebSocketHandshakeInterceptorTest {

    private JwtTokenProvider jwtTokenProvider;
    private UserRepository userRepository;
    private AuthenticatedWebSocketHandshakeInterceptor authenticatedWebSocketHandshakeInterceptor;

    @BeforeEach
    void setUp() {
        jwtTokenProvider = mock(JwtTokenProvider.class);
        userRepository = mock(UserRepository.class);
        authenticatedWebSocketHandshakeInterceptor = new AuthenticatedWebSocketHandshakeInterceptor(
                jwtTokenProvider,
                userRepository
        );
    }

    @Test
    void beforeHandshakeWithValidQueryTokenStoresAuthenticatedUserAttributes() {
        User user = createUser(7L, "alice@neo.square", "Alice");
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("GET", "/ws");
        servletRequest.setQueryString("token=valid-token");
        MockHttpServletResponse servletResponse = new MockHttpServletResponse();
        Map<String, Object> attributes = new HashMap<>();

        when(jwtTokenProvider.isValid("valid-token")).thenReturn(true);
        when(jwtTokenProvider.getUserId("valid-token")).thenReturn(7L);
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));

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

    private User createUser(Long id, String email, String nickname) {
        User user = User.create(email, "encoded-password", nickname);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }
}
