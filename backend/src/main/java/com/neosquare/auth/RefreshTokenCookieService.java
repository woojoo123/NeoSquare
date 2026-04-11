package com.neosquare.auth;

import java.time.Duration;

import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class RefreshTokenCookieService {

    public static final String REFRESH_TOKEN_COOKIE_NAME = "neosquare_refresh_token";
    private static final String REFRESH_TOKEN_COOKIE_PATH = "/api/auth";

    private final JwtProperties jwtProperties;

    public RefreshTokenCookieService(JwtProperties jwtProperties) {
        this.jwtProperties = jwtProperties;
    }

    public String buildRefreshTokenCookieHeader(String refreshToken) {
        return ResponseCookie.from(REFRESH_TOKEN_COOKIE_NAME, refreshToken)
                .httpOnly(true)
                .secure(jwtProperties.refreshTokenCookieSecure())
                .sameSite("Lax")
                .path(REFRESH_TOKEN_COOKIE_PATH)
                .maxAge(Duration.ofMillis(jwtProperties.refreshTokenExpirationMillis()))
                .build()
                .toString();
    }

    public String buildClearRefreshTokenCookieHeader() {
        return ResponseCookie.from(REFRESH_TOKEN_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(jwtProperties.refreshTokenCookieSecure())
                .sameSite("Lax")
                .path(REFRESH_TOKEN_COOKIE_PATH)
                .maxAge(Duration.ZERO)
                .build()
                .toString();
    }

    public String extractRefreshToken(String cookieHeader) {
        if (!StringUtils.hasText(cookieHeader)) {
            return null;
        }

        String[] cookies = cookieHeader.split(";");

        for (String cookie : cookies) {
            String[] parts = cookie.trim().split("=", 2);

            if (parts.length == 2 && REFRESH_TOKEN_COOKIE_NAME.equals(parts[0])) {
                return parts[1];
            }
        }

        return null;
    }
}
