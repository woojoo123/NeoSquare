package com.neosquare.auth;

import com.neosquare.user.UserRole;

public record WebSocketTicketClaims(
        Long userId,
        String email,
        String nickname,
        UserRole role
) {
}
