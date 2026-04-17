package com.neosquare.mentor;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;

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
class MentorManagementIntegrationTest {

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
    void mentorCanManageProfileAvailabilityAndCourses() throws Exception {
        User mentor = saveMentor("mentor@neo.square", "Mentor");
        Instant firstSessionStart = nextDayAt(DayOfWeek.FRIDAY, 20, 0);
        Instant secondSessionStart = nextDayAt(DayOfWeek.SATURDAY, 20, 0);

        mockMvc.perform(patch("/api/mentor-management/profile")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "bio": "백엔드 설계와 실무 코드 리뷰를 돕는 멘토입니다.",
                                  "interests": "아키텍처, 테스트, 커리어",
                                  "specialties": "Spring Boot, JPA, API Design",
                                  "avatarUrl": "https://example.com/avatar.png",
                                  "mentorEnabled": true
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bio").value("백엔드 설계와 실무 코드 리뷰를 돕는 멘토입니다."))
                .andExpect(jsonPath("$.data.mentorEnabled").value(true));

        mockMvc.perform(put("/api/mentor-management/availability")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slots": [
                                    {
                                      "dayOfWeek": "MONDAY",
                                      "startTime": "19:00:00",
                                      "endTime": "22:00:00"
                                    },
                                    {
                                      "dayOfWeek": "WEDNESDAY",
                                      "startTime": "20:00:00",
                                      "endTime": "23:00:00"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].dayOfWeek").value("MONDAY"))
                .andExpect(jsonPath("$.data[0].startTime").value("19:00:00"));

        mockMvc.perform(post("/api/mentor-management/courses")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "실전 백엔드 코드 리뷰",
                                  "summary": "스프링 부트 코드 구조와 예외 처리 패턴을 함께 점검합니다.",
                                  "description": "실제 프로젝트 코드를 기준으로 API 구조, 테스트 전략, 리팩터링 포인트를 같이 봅니다.",
                                  "meetingType": "ONLINE",
                                  "price": 0,
                                  "capacity": 5,
                                  "curriculumItems": [
                                    {
                                      "title": "코드 구조 진단",
                                      "description": "현재 프로젝트 구조를 빠르게 진단합니다."
                                    },
                                    {
                                      "title": "개선 우선순위 설정",
                                      "description": "리팩터링 우선순위를 함께 정리합니다."
                                    }
                                  ],
                                  "scheduleItems": [
                                    {
                                      "title": "1회차 코드 진단",
                                      "description": "현재 프로젝트 구조를 함께 진단합니다.",
                                      "startsAt": "%s",
                                      "endsAt": "%s"
                                    },
                                    {
                                      "title": "2회차 개선안 점검",
                                      "description": "정리된 리팩터링 계획을 검토합니다.",
                                      "startsAt": "%s",
                                      "endsAt": "%s"
                                    }
                                  ],
                                  "status": "PUBLISHED"
                                }
                                """.formatted(
                                        firstSessionStart,
                                        firstSessionStart.plusSeconds(90 * 60L),
                                        secondSessionStart,
                                        secondSessionStart.plusSeconds(90 * 60L)
                                )))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.title").value("실전 백엔드 코드 리뷰"))
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.curriculumItems.length()").value(2))
                .andExpect(jsonPath("$.data.scheduleItems.length()").value(2));

        mockMvc.perform(get("/api/mentor-management/profile")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.availabilitySlots.length()").value(2))
                .andExpect(jsonPath("$.data.courses.length()").value(1))
                .andExpect(jsonPath("$.data.courses[0].title").value("실전 백엔드 코드 리뷰"))
                .andExpect(jsonPath("$.data.courses[0].curriculumItems.length()").value(2))
                .andExpect(jsonPath("$.data.courses[0].scheduleItems.length()").value(2));

        mockMvc.perform(get("/api/users/mentors"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].nickname").value("Mentor"))
                .andExpect(jsonPath("$.data[0].availabilitySlots.length()").value(2))
                .andExpect(jsonPath("$.data[0].courses.length()").value(1))
                .andExpect(jsonPath("$.data[0].courses[0].title").value("실전 백엔드 코드 리뷰"))
                .andExpect(jsonPath("$.data[0].courses[0].curriculumItems.length()").value(2))
                .andExpect(jsonPath("$.data[0].courses[0].scheduleItems.length()").value(2));

        Long courseId = mentorCourseRepository.findAll().stream()
                .filter(course -> "실전 백엔드 코드 리뷰".equals(course.getTitle()))
                .findFirst()
                .orElseThrow()
                .getId();

        mockMvc.perform(get("/api/mentor-courses/{courseId}", courseId)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("실전 백엔드 코드 리뷰"))
                .andExpect(jsonPath("$.data.mentorNickname").value("Mentor"))
                .andExpect(jsonPath("$.data.curriculumItems.length()").value(2))
                .andExpect(jsonPath("$.data.scheduleItems.length()").value(2));
    }

    @Test
    void reservationMustMatchConfiguredAvailability() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveMentor("mentor@neo.square", "Mentor");

        mockMvc.perform(put("/api/mentor-management/availability")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slots": [
                                    {
                                      "dayOfWeek": "MONDAY",
                                      "startTime": "19:00:00",
                                      "endTime": "22:00:00"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isOk());

        Instant unavailableTime = nextDayAt(DayOfWeek.MONDAY, 16, 0);
        Instant availableTime = nextDayAt(DayOfWeek.MONDAY, 19, 30);

        mockMvc.perform(post("/api/mentoring/reservations")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "mentorId": %d,
                                  "reservedAt": "%s",
                                  "message": "가능한지 확인하고 싶습니다."
                                }
                                """.formatted(mentor.getId(), unavailableTime)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("This mentor is not available at the requested time."));

        mockMvc.perform(post("/api/mentoring/reservations")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "mentorId": %d,
                                  "reservedAt": "%s",
                                  "message": "가능 시간에 예약합니다."
                                }
                                """.formatted(mentor.getId(), availableTime)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.reservedAt").value(availableTime.toString()));
    }

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

    private String bearerToken(User user) {
        return "Bearer " + jwtTokenProvider.generateAccessToken(user);
    }

    private Instant nextDayAt(DayOfWeek dayOfWeek, int hour, int minute) {
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault()).plusDays(1);
        ZonedDateTime nextDateTime = now
                .with(TemporalAdjusters.nextOrSame(dayOfWeek))
                .with(LocalTime.of(hour, minute, 0))
                .withSecond(0)
                .withNano(0);

        return nextDateTime.toInstant();
    }
}
