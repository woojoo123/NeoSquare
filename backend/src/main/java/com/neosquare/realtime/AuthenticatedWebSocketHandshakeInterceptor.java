package com.neosquare.realtime;

import java.util.Map;

import com.neosquare.auth.JwtTokenProvider;
import com.neosquare.auth.WebSocketTicketClaims;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class AuthenticatedWebSocketHandshakeInterceptor implements HandshakeInterceptor {

    private static final Logger log = LoggerFactory.getLogger(AuthenticatedWebSocketHandshakeInterceptor.class);

    private final JwtTokenProvider jwtTokenProvider;

    public AuthenticatedWebSocketHandshakeInterceptor(
            JwtTokenProvider jwtTokenProvider
    ) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        String ticket = extractTicket(request);

        if (ticket == null || ticket.isBlank()) {
            log.warn("Rejecting WebSocket handshake without ticket. path={}", request.getURI().getPath());
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        if (!jwtTokenProvider.isWebSocketTicket(ticket)) {
            log.warn("Rejecting WebSocket handshake with invalid ticket. path={}", request.getURI().getPath());
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        WebSocketTicketClaims ticketClaims = jwtTokenProvider.getWebSocketTicketClaims(ticket);

        attributes.put(WebSocketSessionAttributes.USER_ID, ticketClaims.userId());
        attributes.put(WebSocketSessionAttributes.USER_EMAIL, ticketClaims.email());
        attributes.put(WebSocketSessionAttributes.USER_NICKNAME, ticketClaims.nickname());
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception
    ) {
    }

    private String extractTicket(ServerHttpRequest request) {
        return UriComponentsBuilder.fromUri(request.getURI())
                .build()
                .getQueryParams()
                .getFirst("ticket");
    }
}
