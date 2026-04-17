package com.neosquare.mentor;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

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
    private MentorCourseScheduleItemRepository mentorCourseScheduleItemRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void userCanApplyToPublishedCourseAndMentorCanApprove() throws Exception {
        User mentor = saveMentor("mentor@neo.square", "Mentor");
        User applicant = saveUser("applicant@neo.square", "Applicant");
        MentorCourse course = savePublishedCourse(mentor, "실전 코드 리뷰", 2);
        MentorCourseScheduleItem preferredScheduleItem = saveScheduleItem(course, 1, "1회차");

        mockMvc.perform(post("/api/mentor-courses/{courseId}/applications", course.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(applicant))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "preferredScheduleItemId": %d,
                                  "message": "실무 코드 리뷰를 받고 싶습니다."
                                }
                                """.formatted(preferredScheduleItem.getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.courseTitle").value("실전 코드 리뷰"))
                .andExpect(jsonPath("$.data.applicantNickname").value("Applicant"))
                .andExpect(jsonPath("$.data.preferredScheduleItemId").value(preferredScheduleItem.getId()))
                .andExpect(jsonPath("$.data.preferredScheduleTitle").value("1회차"))
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
                                  "assignedScheduleItemId": %d,
                                  "reviewNote": "다음 주부터 시작해 봅시다."
                                }
                                """.formatted(preferredScheduleItem.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andExpect(jsonPath("$.data.assignedScheduleItemId").value(preferredScheduleItem.getId()))
                .andExpect(jsonPath("$.data.assignedScheduleTitle").value("1회차"))
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

    @Test
    void approvedParticipantCanLoadCourseSessionEntry() throws Exception {
        User mentor = saveMentor("mentor-session@neo.square", "MentorSession");
        User applicant = saveUser("applicant-session@neo.square", "ApplicantSession");
        MentorCourse course = savePublishedCourse(mentor, "세션 입장 테스트", 2);
        MentorCourseScheduleItem scheduleItem = mentorCourseScheduleItemRepository.save(
                MentorCourseScheduleItem.create(
                        course,
                        1,
                        "실시간 1회차",
                        "세션 입장 검증용 회차",
                        Instant.now().minusSeconds(300L),
                        Instant.now().plusSeconds(3300L)
                )
        );

        mockMvc.perform(post("/api/mentor-courses/{courseId}/applications", course.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(applicant))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "preferredScheduleItemId": %d,
                                  "message": "세션 입장 테스트를 진행합니다."
                                }
                                """.formatted(scheduleItem.getId())))
                .andExpect(status().isCreated());

        Long applicationId = mentorCourseApplicationRepository.findAll().stream()
                .filter(application -> "ApplicantSession".equals(application.getApplicant().getNickname()))
                .findFirst()
                .orElseThrow()
                .getId();

        mockMvc.perform(patch("/api/mentor-courses/applications/{applicationId}/approve", applicationId)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "assignedScheduleItemId": %d,
                                  "reviewNote": "지금 바로 입장 가능합니다."
                                }
                                """.formatted(scheduleItem.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sessionEntryOpenAt").isNotEmpty())
                .andExpect(jsonPath("$.data.sessionEntryCloseAt").isNotEmpty());

        mockMvc.perform(get("/api/mentor-courses/applications/{applicationId}/session-entry", applicationId)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(applicant)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andExpect(jsonPath("$.data.assignedScheduleItemId").value(scheduleItem.getId()))
                .andExpect(jsonPath("$.data.sessionEntryOpenAt").isNotEmpty())
                .andExpect(jsonPath("$.data.sessionEntryCloseAt").isNotEmpty());
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

    private MentorCourseScheduleItem saveScheduleItem(MentorCourse course, int sequence, String title) {
        Instant startsAt = Instant.parse("2026-05-01T10:00:00Z").plusSeconds(sequence * 86400L);
        return mentorCourseScheduleItemRepository.save(MentorCourseScheduleItem.create(
                course,
                sequence,
                title,
                title + " 설명",
                startsAt,
                startsAt.plusSeconds(5400L)
        ));
    }

    private String bearerToken(User user) {
        return "Bearer " + jwtTokenProvider.generateAccessToken(user);
    }
}
