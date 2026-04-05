package com.neosquare.auth;

import com.neosquare.user.User;
import com.neosquare.user.UserRole;

public record LoginResponse(
        String accessToken,
        String tokenType,
        Long userId,
        String email,
        String nickname,
        UserRole role
) {

    public static LoginResponse of(User user, String accessToken) {
        return new LoginResponse(
                accessToken,
                "Bearer",
                user.getId(),
                user.getEmail(),
                user.getNickname(),
                user.getRole()
        );
    }
}
