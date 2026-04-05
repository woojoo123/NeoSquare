package com.neosquare.auth;

import com.neosquare.user.UserRole;

public record CurrentUserResponse(
        Long id,
        String email,
        String nickname,
        UserRole role
) {

    public static CurrentUserResponse from(AuthUserPrincipal authUser) {
        return new CurrentUserResponse(
                authUser.id(),
                authUser.email(),
                authUser.nickname(),
                authUser.role()
        );
    }
}
