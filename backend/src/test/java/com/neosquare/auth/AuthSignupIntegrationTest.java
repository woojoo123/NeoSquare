package com.neosquare.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.neosquare.user.User;
import com.neosquare.user.UserRepository;
import com.neosquare.user.UserRole;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import jakarta.transaction.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthSignupIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void signupCreatesUserAndProfile() throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "neo@example.com",
                                  "password": "password123",
                                  "nickname": "neo"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Signup succeeded."))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.email").value("neo@example.com"))
                .andExpect(jsonPath("$.data.nickname").value("neo"))
                .andExpect(jsonPath("$.data.role").value(UserRole.USER.name()));

        User savedUser = userRepository.findByEmail("neo@example.com").orElseThrow();

        assertThat(savedUser.getNickname()).isEqualTo("neo");
        assertThat(savedUser.getRole()).isEqualTo(UserRole.USER);
        assertThat(savedUser.getProfile()).isNotNull();
        assertThat(savedUser.getProfile().getUser()).isSameAs(savedUser);
        assertThat(savedUser.getPassword()).isNotEqualTo("password123");
        assertThat(passwordEncoder.matches("password123", savedUser.getPassword())).isTrue();
    }

    @Test
    void signupWithDuplicateEmailReturnsConflict() throws Exception {
        userRepository.save(User.create(
                "neo@example.com",
                passwordEncoder.encode("password123"),
                "existing-user"
        ));

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "neo@example.com",
                                  "password": "password123",
                                  "nickname": "neo"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Validation failed."))
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.errors.email").value("Email already exists."))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void signupWithInvalidRequestReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "invalid-email",
                                  "password": "",
                                  "nickname": ""
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Validation failed."))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.errors.email").value("올바른 이메일 주소를 입력해 주세요."))
                .andExpect(jsonPath("$.errors.password").value("비밀번호를 입력해 주세요."))
                .andExpect(jsonPath("$.errors.nickname").value("닉네임은 2자 이상 20자 이하로 입력해 주세요."));
    }

    @Test
    void signupWithDuplicateNicknameReturnsConflict() throws Exception {
        userRepository.save(User.create(
                "existing@example.com",
                passwordEncoder.encode("password123"),
                "neo"
        ));

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "neo@example.com",
                                  "password": "password123",
                                  "nickname": "neo"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Validation failed."))
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.errors.nickname").value("Nickname already exists."))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void signupNormalizesEmailBeforeSaving() throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "  Neo@Example.com ",
                                  "password": "password123",
                                  "nickname": "neo"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.email").value("neo@example.com"));

        assertThat(userRepository.findByEmail("neo@example.com")).isPresent();
    }
}
