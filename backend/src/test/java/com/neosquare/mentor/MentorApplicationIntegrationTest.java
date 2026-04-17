package com.neosquare.mentor;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.neosquare.auth.JwtTokenProvider;
import com.neosquare.user.User;
import com.neosquare.user.UserRepository;
import com.neosquare.user.UserRole;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import jakarta.transaction.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MentorApplicationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MentorApplicationRepository mentorApplicationRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void userCanSubmitMentorApplication() throws Exception {
        User user = saveUser("user@neo.square", "neo", UserRole.USER);

        mockMvc.perform(post("/api/mentor-applications")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "bio": "백엔드와 API 설계를 중심으로 멘토링하고 싶습니다.",
                                  "specialties": "Spring Boot, JPA, API Design",
                                  "interests": "백엔드 아키텍처, 테스트 코드",
                                  "reason": "실무에서 겪은 설계 경험을 공유하고 싶습니다."
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Mentor application submitted."))
                .andExpect(jsonPath("$.data.userId").value(user.getId()))
                .andExpect(jsonPath("$.data.status").value(MentorApplicationStatus.PENDING.name()))
                .andExpect(jsonPath("$.data.reviewedAt").doesNotExist());
    }

    @Test
    void pendingApplicationCannotBeSubmittedTwice() throws Exception {
        User user = saveUser("user@neo.square", "neo", UserRole.USER);

        mockMvc.perform(post("/api/mentor-applications")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validApplicationPayload()))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/mentor-applications")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validApplicationPayload()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Your mentor application is already pending review."))
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void adminCanApproveMentorApplicationAndMentorAppearsInMentorList() throws Exception {
        User applicant = saveUser("user@neo.square", "neo", UserRole.USER);
        User admin = saveUser("admin@neo.square", "admin", UserRole.ADMIN);

        mockMvc.perform(post("/api/mentor-applications")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(applicant))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validApplicationPayload()))
                .andExpect(status().isCreated());

        Long applicationId = mentorApplicationRepository.findByUser_Id(applicant.getId())
                .orElseThrow()
                .getId();

        mockMvc.perform(patch("/api/mentor-applications/{mentorApplicationId}/approve", applicationId)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "reviewNote": "승인합니다."
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Mentor application approved."))
                .andExpect(jsonPath("$.data.status").value(MentorApplicationStatus.APPROVED.name()))
                .andExpect(jsonPath("$.data.reviewNote").value("승인합니다."));

        mockMvc.perform(get("/api/users/mentors"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].nickname").value("neo"))
                .andExpect(jsonPath("$.data[0].mentorEnabled").value(true));

        mockMvc.perform(get("/api/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(applicant)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value(UserRole.MENTOR.name()))
                .andExpect(jsonPath("$.data.mentorEnabled").value(true));
    }

    @Test
    void nonAdminCannotApproveMentorApplication() throws Exception {
        User applicant = saveUser("user@neo.square", "neo", UserRole.USER);
        User reviewer = saveUser("reviewer@neo.square", "reviewer", UserRole.USER);

        mockMvc.perform(post("/api/mentor-applications")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(applicant))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validApplicationPayload()))
                .andExpect(status().isCreated());

        Long applicationId = mentorApplicationRepository.findByUser_Id(applicant.getId())
                .orElseThrow()
                .getId();

        mockMvc.perform(patch("/api/mentor-applications/{mentorApplicationId}/approve", applicationId)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(reviewer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "reviewNote": "권한 없음"
                                }
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Only admins can review mentor applications."))
                .andExpect(jsonPath("$.status").value(403));
    }

    private User saveUser(String email, String nickname, UserRole role) {
        return userRepository.save(User.create(
                email,
                passwordEncoder.encode("password123"),
                nickname,
                role
        ));
    }

    private String bearerToken(User user) {
        return "Bearer " + jwtTokenProvider.generateAccessToken(user);
    }

    private String validApplicationPayload() {
        return """
                {
                  "bio": "백엔드와 API 설계를 중심으로 멘토링하고 싶습니다.",
                  "specialties": "Spring Boot, JPA, API Design",
                  "interests": "백엔드 아키텍처, 테스트 코드",
                  "reason": "실무에서 겪은 설계 경험을 공유하고 싶습니다."
                }
                """;
    }
}
