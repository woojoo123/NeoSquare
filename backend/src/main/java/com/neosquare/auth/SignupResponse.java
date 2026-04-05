package com.neosquare.auth;

import com.neosquare.user.User;
import com.neosquare.user.UserRole;

public record SignupResponse(
        Long id,
        String email,
        String nickname,
        UserRole role
) {

    public static SignupResponse from(User user) {
        return new SignupResponse(
                user.getId(),
                user.getEmail(),
                user.getNickname(),
                user.getRole()
        );
    }
}
