package com.neosquare.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank(message = "이메일을 입력해 주세요.")
        @Email(message = "올바른 이메일 주소를 입력해 주세요.")
        String email,

        @NotBlank(message = "비밀번호를 입력해 주세요.")
        @Size(max = 64, message = "비밀번호는 64자 이하로 입력해 주세요.")
        String password,

        @NotBlank(message = "닉네임을 입력해 주세요.")
        @Size(min = 2, max = 20, message = "닉네임은 2자 이상 20자 이하로 입력해 주세요.")
        String nickname
) {

    public SignupRequest {
        email = email == null ? null : email.trim().toLowerCase();
        nickname = nickname == null ? null : nickname.trim();
    }
}
