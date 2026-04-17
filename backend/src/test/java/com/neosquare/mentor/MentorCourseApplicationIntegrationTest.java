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
class MentorCourseApplicationIntegrationTest {

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
    void userCanApplyToPublishedCourseAndMentorCanApprove() throws Exception {
        User mentor = saveMentor("mentor@neo.square", "Mentor");
        User applicant = saveUser("applicant@neo.square", "Applicant");
        MentorCourse course = savePublishedCourse(mentor, "실전 코드 리뷰", 2);

        mockMvc.perform(post("/api/mentor-courses/{courseId}/applications", course.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(applicant))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "message": "실무 코드 리뷰를 받고 싶습니다."
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.courseTitle").value("실전 코드 리뷰"))
                .andExpect(jsonPath("$.data.applicantNickname").value("Applicant"))
                .andExpect(jsonPath("$.data.status").value("PENDING"));

        mockMvc.perform(get("/api/mentor-courses/applications/me")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(applicant)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].courseTitle").value("실전 코드 리뷰"));

        mockMvc.perform(get("/api/mentor-courses/applications/received")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].applicantNickname").value("Applicant"));

        Long applicationId = mentorCourseApplicationRepository.findAll().get(0).getId();

        mockMvc.perform(patch("/api/mentor-courses/applications/{applicationId}/approve", applicationId)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "reviewNote": "다음 주부터 시작해 봅시다."
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andExpect(jsonPath("$.data.reviewNote").value("다음 주부터 시작해 봅시다."));
    }

    @Test
    void capacityLimitBlocksAdditionalApprovals() throws Exception {
        User mentor = saveMentor("mentor@neo.square", "Mentor");
        User firstApplicant = saveUser("first@neo.square", "First");
        User secondApplicant = saveUser("second@neo.square", "Second");
        MentorCourse course = savePublishedCourse(mentor, "정원 한 명 수업", 1);

        mockMvc.perform(post("/api/mentor-courses/{courseId}/applications", course.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(firstApplicant))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "message": "첫 번째 신청입니다."
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/mentor-courses/{courseId}/applications", course.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(secondApplicant))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "message": "두 번째 신청입니다."
                                }
                                """))
                .andExpect(status().isCreated());

        Long firstApplicationId = mentorCourseApplicationRepository.findAll().stream()
                .filter(application -> "First".equals(application.getApplicant().getNickname()))
                .findFirst()
                .orElseThrow()
                .getId();
        Long secondApplicationId = mentorCourseApplicationRepository.findAll().stream()
                .filter(application -> "Second".equals(application.getApplicant().getNickname()))
                .findFirst()
                .orElseThrow()
                .getId();

        mockMvc.perform(patch("/api/mentor-courses/applications/{applicationId}/approve", firstApplicationId)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));

        mockMvc.perform(patch("/api/mentor-courses/applications/{applicationId}/approve", secondApplicationId)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("This course is already full."));
    }

    @Autowired
    private MentorCourseApplicationRepository mentorCourseApplicationRepository;

    private User saveUser(String email, String nickname) {
        return userRepository.save(User.create(
                email,
                passwordEncoder.encode("password123"),
                nickname,
                UserRole.USER
        ));
    }

    private User saveMentor(String email, String nickname) {
        User mentor = User.create(
                email,
                passwordEncoder.encode("password123"),
                nickname,
                UserRole.MENTOR
        );
        mentor.getProfile().enableMentoring();
        return userRepository.save(mentor);
    }

    private MentorCourse savePublishedCourse(User mentor, String title, int capacity) {
        return mentorCourseRepository.save(MentorCourse.create(
                mentor,
                title,
                "요약",
                "설명",
                "ONLINE",
                0,
                capacity,
                MentorCourseStatus.PUBLISHED
        ));
    }

    private String bearerToken(User user) {
        return "Bearer " + jwtTokenProvider.generateAccessToken(user);
    }
}
