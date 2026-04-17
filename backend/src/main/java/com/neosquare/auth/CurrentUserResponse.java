package com.neosquare.auth;

import com.neosquare.user.User;
import com.neosquare.user.UserRole;

public record CurrentUserResponse(
        Long id,
        String email,
        String nickname,
        UserRole role,
        boolean mentorEnabled
) {

    public static CurrentUserResponse from(AuthUserPrincipal authUser) {
        return new CurrentUserResponse(
                authUser.id(),
                authUser.email(),
                authUser.nickname(),
                authUser.role(),
                authUser.role() == UserRole.MENTOR || authUser.role() == UserRole.ADMIN
        );
    }

    public static CurrentUserResponse from(User user) {
        return new CurrentUserResponse(
                user.getId(),
                user.getEmail(),
                user.getNickname(),
                user.getRole(),
                user.getProfile().isMentorEnabled()
        );
    }
}
