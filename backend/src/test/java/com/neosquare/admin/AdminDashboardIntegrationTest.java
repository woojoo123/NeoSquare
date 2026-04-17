package com.neosquare.admin;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.neosquare.auth.JwtTokenProvider;
import com.neosquare.mentor.MentorCourse;
import com.neosquare.mentor.MentorCourseRepository;
import com.neosquare.mentor.MentorCourseStatus;
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
class AdminDashboardIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MentorCourseRepository mentorCourseRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void adminCanViewDashboardAndControlMentorVisibilityAndCourseStatus() throws Exception {
        User admin = saveUser("admin@neo.square", "Admin", UserRole.ADMIN, true);
        User mentor = saveUser("mentor@neo.square", "Mentor", UserRole.MENTOR, true);
        MentorCourse course = mentorCourseRepository.save(MentorCourse.create(
                mentor,
                "운영 대상 수업",
                "요약",
                "설명",
                "ONLINE",
                0,
                5,
                MentorCourseStatus.PUBLISHED
        ));

        mockMvc.perform(get("/api/admin/dashboard")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mentorCount").value(2))
                .andExpect(jsonPath("$.data.courses.length()").value(1))
                .andExpect(jsonPath("$.data.mentors.length()").value(2));

        mockMvc.perform(patch("/api/admin/mentors/{mentorId}/visibility", mentor.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "mentorEnabled": false
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mentorEnabled").value(false));

        mockMvc.perform(patch("/api/admin/courses/{courseId}/status", course.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "status": "ARCHIVED"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"));
    }

    private User saveUser(String email, String nickname, UserRole role, boolean mentorEnabled) {
        User user = User.create(
                email,
                passwordEncoder.encode("password123"),
                nickname,
                role
        );

        if (mentorEnabled) {
            user.getProfile().enableMentoring();
        }

        return userRepository.save(user);
    }

    private String bearerToken(User user) {
        return "Bearer " + jwtTokenProvider.generateAccessToken(user);
    }
}
