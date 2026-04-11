package com.neosquare.auth;

public record AuthSessionResult(
        LoginResponse loginResponse,
        String refreshToken
) {
}
