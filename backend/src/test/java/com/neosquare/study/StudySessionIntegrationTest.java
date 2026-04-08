package com.neosquare.study;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.neosquare.auth.JwtTokenProvider;
import com.neosquare.space.Space;
import com.neosquare.space.SpaceRepository;
import com.neosquare.space.SpaceType;
import com.neosquare.user.User;
import com.neosquare.user.UserRepository;

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
class StudySessionIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StudySessionRepository studySessionRepository;

    @Autowired
    private SpaceRepository spaceRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void createStudySessionReturnsCreatedSession() throws Exception {
        User host = saveUser("host@neo.square", "Host");
        Space studySpace = saveSpace("Study Lounge", SpaceType.STUDY);

        mockMvc.perform(post("/api/study/sessions")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(host))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "spaceId": %d,
                                  "title": "React 상태관리 같이 보기",
                                  "description": "zustand와 컴포넌트 분리를 같이 정리해요."
                                }
                                """.formatted(studySpace.getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Study session created."))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.spaceId").value(studySpace.getId()))
                .andExpect(jsonPath("$.data.hostId").value(host.getId()))
                .andExpect(jsonPath("$.data.title").value("React 상태관리 같이 보기"))
                .andExpect(jsonPath("$.data.status").value(StudySessionStatus.ACTIVE.name()))
                .andExpect(jsonPath("$.data.participantCount").value(1))
                .andExpect(jsonPath("$.data.joined").value(true))
                .andExpect(jsonPath("$.data.participants[0].userId").value(host.getId()))
                .andExpect(jsonPath("$.data.participants[0].role").value(StudySessionParticipantRole.HOST.name()));
    }

    @Test
    void getStudySessionsBySpaceReturnsActiveSessions() throws Exception {
        User host = saveUser("host@neo.square", "Host");
        User member = saveUser("member@neo.square", "Member");
        Space studySpace = saveSpace("Study Lounge", SpaceType.STUDY);

        StudySession firstSession = saveStudySession(host, studySpace, "알고리즘 스터디", "그래프 문제");
        StudySession secondSession = saveStudySession(member, studySpace, "포트폴리오 리뷰", "발표 피드백");

        mockMvc.perform(get("/api/study/sessions/space/{spaceId}", studySpace.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(host)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Study sessions retrieved."))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].id").value(secondSession.getId()))
                .andExpect(jsonPath("$.data[1].id").value(firstSession.getId()));
    }

    @Test
    void getMyStudySessionsReturnsJoinedSessions() throws Exception {
        User host = saveUser("host@neo.square", "Host");
        User member = saveUser("member@neo.square", "Member");
        Space studySpace = saveSpace("Study Lounge", SpaceType.STUDY);

        StudySession joinedSession = saveStudySession(host, studySpace, "네트워크 스터디", "TCP/IP");
        joinedSession.join(member);

        StudySession hostOnlySession = saveStudySession(member, studySpace, "CS 면접 스터디", "운영체제");

        mockMvc.perform(get("/api/study/sessions/me")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("My study sessions retrieved."))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].id").value(hostOnlySession.getId()))
                .andExpect(jsonPath("$.data[1].id").value(joinedSession.getId()));
    }

    @Test
    void participantCanJoinActiveStudySession() throws Exception {
        User host = saveUser("host@neo.square", "Host");
        User member = saveUser("member@neo.square", "Member");
        Space studySpace = saveSpace("Study Lounge", SpaceType.STUDY);
        StudySession studySession = saveStudySession(host, studySpace, "코딩테스트 스터디", "DP");

        mockMvc.perform(post("/api/study/sessions/{studySessionId}/join", studySession.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Study session joined."))
                .andExpect(jsonPath("$.data.participantCount").value(2))
                .andExpect(jsonPath("$.data.joined").value(true))
                .andExpect(jsonPath("$.data.participants[1].userId").value(member.getId()));
    }

    @Test
    void getStudySessionRejectsNonParticipants() throws Exception {
        User host = saveUser("host@neo.square", "Host");
        User outsider = saveUser("outsider@neo.square", "Outsider");
        Space studySpace = saveSpace("Study Lounge", SpaceType.STUDY);
        StudySession studySession = saveStudySession(host, studySpace, "데이터베이스 스터디", "인덱스");

        mockMvc.perform(get("/api/study/sessions/{studySessionId}", studySession.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(outsider)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message")
                        .value("Only study session participants can view this study session."));
    }

    @Test
    void hostCanCompleteStudySession() throws Exception {
        User host = saveUser("host@neo.square", "Host");
        Space studySpace = saveSpace("Study Lounge", SpaceType.STUDY);
        StudySession studySession = saveStudySession(host, studySpace, "면접 대비 스터디", "시스템 설계");

        mockMvc.perform(patch("/api/study/sessions/{studySessionId}/complete", studySession.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(host)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Study session completed."))
                .andExpect(jsonPath("$.data.status").value(StudySessionStatus.COMPLETED.name()))
                .andExpect(jsonPath("$.data.completedAt").exists());
    }

    @Test
    void memberCannotCompleteStudySession() throws Exception {
        User host = saveUser("host@neo.square", "Host");
        User member = saveUser("member@neo.square", "Member");
        Space studySpace = saveSpace("Study Lounge", SpaceType.STUDY);
        StudySession studySession = saveStudySession(host, studySpace, "운영체제 스터디", "스케줄링");
        studySession.join(member);

        mockMvc.perform(patch("/api/study/sessions/{studySessionId}/complete", studySession.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(member)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Only the host can complete this study session."));
    }

    @Test
    void createStudySessionFailsForNonStudySpace() throws Exception {
        User host = saveUser("host@neo.square", "Host");
        Space mentoringSpace = saveSpace("Mentoring Room", SpaceType.MENTORING);

        mockMvc.perform(post("/api/study/sessions")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(host))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "spaceId": %d,
                                  "title": "잘못된 공간",
                                  "description": "여기는 스터디 공간이 아닙니다."
                                }
                                """.formatted(mentoringSpace.getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message")
                        .value("Study sessions can only be created in study spaces."));
    }

    @Test
    void joinCompletedStudySessionFails() throws Exception {
        User host = saveUser("host@neo.square", "Host");
        User member = saveUser("member@neo.square", "Member");
        Space studySpace = saveSpace("Study Lounge", SpaceType.STUDY);
        StudySession studySession = saveStudySession(host, studySpace, "완료된 스터디", "정리 모임");
        studySession.complete();

        mockMvc.perform(post("/api/study/sessions/{studySessionId}/join", studySession.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(member)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Only active study sessions can be joined."));
    }

    private User saveUser(String email, String nickname) {
        return userRepository.save(User.create(
                email,
                passwordEncoder.encode("password123!"),
                nickname
        ));
    }

    private Space saveSpace(String name, SpaceType spaceType) {
        return spaceRepository.save(Space.create(
                name,
                spaceType,
                name + " 설명",
                50,
                true
        ));
    }

    private StudySession saveStudySession(User host, Space space, String title, String description) {
        return studySessionRepository.save(StudySession.create(host, space, title, description));
    }

    private String bearerToken(User user) {
        return "Bearer " + jwtTokenProvider.generateAccessToken(user);
    }
}
