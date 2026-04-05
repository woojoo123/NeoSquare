package com.neosquare.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record SignupRequest(
        @NotBlank(message = "email must not be blank")
        @Email(message = "email must be a valid email address")
        String email,

        @NotBlank(message = "password must not be blank")
        String password,

        @NotBlank(message = "nickname must not be blank")
        String nickname
) {
}
