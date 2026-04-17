package com.neosquare.auth;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

import javax.crypto.SecretKey;

import com.neosquare.user.User;
import com.neosquare.user.UserRole;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import org.springframework.stereotype.Component;

@Component
public class JwtTokenProvider {

    private static final String CLAIM_EMAIL = "email";
    private static final String CLAIM_ROLE = "role";
    private static final String CLAIM_NICKNAME = "nickname";
    private static final String CLAIM_TOKEN_TYPE = "tokenType";
    private static final String TOKEN_TYPE_ACCESS = "access";
    private static final String TOKEN_TYPE_WS_TICKET = "ws_ticket";
    private static final long WEB_SOCKET_TICKET_EXPIRATION_MILLIS = 60_000L;

    private final JwtProperties jwtProperties;
    private final SecretKey secretKey;

    public JwtTokenProvider(JwtProperties jwtProperties) {
        this.jwtProperties = jwtProperties;
        this.secretKey = Keys.hmacShaKeyFor(jwtProperties.secret().getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(User user) {
        Instant now = Instant.now();
        Instant expiration = now.plusMillis(jwtProperties.accessTokenExpirationMillis());

        return Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim(CLAIM_EMAIL, user.getEmail())
                .claim(CLAIM_ROLE, user.getRole().name())
                .claim(CLAIM_TOKEN_TYPE, TOKEN_TYPE_ACCESS)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiration))
                .signWith(secretKey)
                .compact();
    }

    public String generateWebSocketTicket(AuthUserPrincipal authUser) {
        Instant now = Instant.now();
        Instant expiration = now.plusMillis(WEB_SOCKET_TICKET_EXPIRATION_MILLIS);

        return Jwts.builder()
                .subject(String.valueOf(authUser.id()))
                .claim(CLAIM_EMAIL, authUser.email())
                .claim(CLAIM_ROLE, authUser.role().name())
                .claim(CLAIM_NICKNAME, authUser.nickname())
                .claim(CLAIM_TOKEN_TYPE, TOKEN_TYPE_WS_TICKET)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiration))
                .signWith(secretKey)
                .compact();
    }

    public boolean isValid(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException exception) {
            return false;
        }
    }

    public Long getUserId(String token) {
        return Long.valueOf(parseClaims(token).getSubject());
    }

    public boolean isWebSocketTicket(String token) {
        try {
            return TOKEN_TYPE_WS_TICKET.equals(parseClaims(token).get(CLAIM_TOKEN_TYPE, String.class));
        } catch (JwtException | IllegalArgumentException exception) {
            return false;
        }
    }

    public WebSocketTicketClaims getWebSocketTicketClaims(String token) {
        Claims claims = parseClaims(token);
        String tokenType = claims.get(CLAIM_TOKEN_TYPE, String.class);

        if (!TOKEN_TYPE_WS_TICKET.equals(tokenType)) {
            throw new JwtException("Token is not a WebSocket ticket.");
        }

        return new WebSocketTicketClaims(
                Long.valueOf(claims.getSubject()),
                claims.get(CLAIM_EMAIL, String.class),
                claims.get(CLAIM_NICKNAME, String.class),
                UserRole.valueOf(claims.get(CLAIM_ROLE, String.class))
        );
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
