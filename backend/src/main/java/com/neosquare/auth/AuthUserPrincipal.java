package com.neosquare.auth;

import java.util.List;

import com.neosquare.user.User;
import com.neosquare.user.UserRole;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

public record AuthUserPrincipal(
        Long id,
        String email,
        String nickname,
        UserRole role
) {

    public static AuthUserPrincipal from(User user) {
        return new AuthUserPrincipal(
                user.getId(),
                user.getEmail(),
                user.getNickname(),
                user.getRole()
        );
    }

    public List<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }
}
