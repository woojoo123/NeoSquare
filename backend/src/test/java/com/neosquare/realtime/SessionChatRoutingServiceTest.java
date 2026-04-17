package com.neosquare.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.neosquare.mentoring.MentoringRequest;
import com.neosquare.mentoring.MentoringRequestRepository;
import com.neosquare.mentoring.MentoringReservation;
import com.neosquare.mentoring.MentoringReservationRepository;
import com.neosquare.mentoring.MentoringReservationSessionAccessPolicy;
import com.neosquare.space.Space;
import com.neosquare.space.SpaceType;
import com.neosquare.study.StudySession;
import com.neosquare.study.StudySessionRepository;
import com.neosquare.user.User;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.socket.WebSocketSession;

class SessionChatRoutingServiceTest {

    private MentoringRequestRepository mentoringRequestRepository;
    private MentoringReservationRepository mentoringReservationRepository;
    private StudySessionRepository studySessionRepository;
    private RealtimeSessionRegistry realtimeSessionRegistry;
    private SessionChatRoutingService sessionChatRoutingService;

    @BeforeEach
    void setUp() {
        mentoringRequestRepository = mock(MentoringRequestRepository.class);
        mentoringReservationRepository = mock(MentoringReservationRepository.class);
        studySessionRepository = mock(StudySessionRepository.class);
        realtimeSessionRegistry = mock(RealtimeSessionRegistry.class);
        sessionChatRoutingService = new SessionChatRoutingService(
                mentoringRequestRepository,
                mentoringReservationRepository,
                studySessionRepository,
                realtimeSessionRegistry,
                new MentoringReservationSessionAccessPolicy()
        );
    }

    @Test
    void routeChatMessageRoutesMentoringSessionChatToParticipants() {
        User requester = createUser(1L, "requester@neo.square", "Requester");
        User mentor = createUser(2L, "mentor@neo.square", "Mentor");
        MentoringRequest mentoringRequest = createAcceptedRequest(41L, requester, mentor);
        WebSocketSession requesterSession = mockSession();
        WebSocketSession mentorSession = mockSession();

        when(mentoringRequestRepository.findById(41L)).thenReturn(Optional.of(mentoringRequest));
        when(realtimeSessionRegistry.findOpenSessions(1L)).thenReturn(Set.of(requesterSession));
        when(realtimeSessionRegistry.findOpenSessions(2L)).thenReturn(Set.of(mentorSession));

        SignalRouteResult routeResult = sessionChatRoutingService.routeChatMessage(
                new WebSocketMessage(
                        WebSocketEventType.CHAT_SEND,
                        createMentoringChatPayload(41L, "같이 화면 보면서 이야기해요."),
                        1L,
                        Instant.now()
                )
        );

        assertThat(routeResult.targetSessions()).containsExactlyInAnyOrder(requesterSession, mentorSession);
        assertThat(routeResult.outboundMessage().senderId()).isEqualTo(1L);
        assertThat(routeResult.outboundMessage().payload().get("scope").asText()).isEqualTo("mentoring_session");
    }

    @Test
    void routeChatMessageRoutesReservationSessionChatToParticipants() {
        User requester = createUser(20L, "requester@neo.square", "Requester");
        User mentor = createUser(21L, "mentor@neo.square", "Mentor");
        MentoringReservation reservation = createAcceptedReservation(61L, requester, mentor);
        WebSocketSession requesterSession = mockSession();
        WebSocketSession mentorSession = mockSession();

        when(mentoringReservationRepository.findDetailById(61L)).thenReturn(Optional.of(reservation));
        when(realtimeSessionRegistry.findOpenSessions(20L)).thenReturn(Set.of(requesterSession));
        when(realtimeSessionRegistry.findOpenSessions(21L)).thenReturn(Set.of(mentorSession));

        SignalRouteResult routeResult = sessionChatRoutingService.routeChatMessage(
                new WebSocketMessage(
                        WebSocketEventType.CHAT_SEND,
                        createReservationChatPayload(61L, "예약 세션에서도 바로 이야기해요."),
                        20L,
                        Instant.now()
                )
        );

        assertThat(routeResult.targetSessions()).containsExactlyInAnyOrder(requesterSession, mentorSession);
        assertThat(routeResult.outboundMessage().payload().get("reservationId").asLong()).isEqualTo(61L);
        assertThat(routeResult.outboundMessage().payload().get("scope").asText()).isEqualTo("reservation_session");
    }

    @Test
    void routeChatMessageRoutesStudySessionChatToParticipants() {
        User host = createUser(10L, "host@neo.square", "Host");
        User member = createUser(11L, "member@neo.square", "Member");
        StudySession studySession = createStudySession(51L, host, member);
        WebSocketSession hostSession = mockSession();
        WebSocketSession memberSession = mockSession();

        when(studySessionRepository.findDetailById(51L)).thenReturn(Optional.of(studySession));
        when(realtimeSessionRegistry.findOpenSessions(10L)).thenReturn(Set.of(hostSession));
        when(realtimeSessionRegistry.findOpenSessions(11L)).thenReturn(Set.of(memberSession));

        SignalRouteResult routeResult = sessionChatRoutingService.routeChatMessage(
                new WebSocketMessage(
                        WebSocketEventType.CHAT_SEND,
                        createStudyChatPayload(51L, "오늘은 리액트 훅 구조를 같이 정리해요."),
                        10L,
                        Instant.now()
                )
        );

        assertThat(routeResult.targetSessions()).containsExactlyInAnyOrder(hostSession, memberSession);
        assertThat(routeResult.outboundMessage().payload().get("studySessionId").asLong()).isEqualTo(51L);
        assertThat(routeResult.outboundMessage().payload().get("scope").asText()).isEqualTo("study_session");
    }

    @Test
    void routeChatMessageRejectsUnsupportedScope() {
        assertThatThrownBy(() -> sessionChatRoutingService.routeChatMessage(
                new WebSocketMessage(
                        WebSocketEventType.CHAT_SEND,
                        createUnsupportedChatPayload(),
                        1L,
                        Instant.now()
                )
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Unsupported chat scope.");
    }

    @Test
    void routeChatMessageRejectsExpiredReservationSession() {
        User requester = createUser(20L, "requester@neo.square", "Requester");
        User mentor = createUser(21L, "mentor@neo.square", "Mentor");
        MentoringReservation reservation = createAcceptedReservation(
                61L,
                requester,
                mentor,
                Instant.now().minusSeconds(3 * 3600)
        );

        when(mentoringReservationRepository.findDetailById(61L)).thenReturn(Optional.of(reservation));

        assertThatThrownBy(() -> sessionChatRoutingService.routeChatMessage(
                new WebSocketMessage(
                        WebSocketEventType.CHAT_SEND,
                        createReservationChatPayload(61L, "지금도 채팅될까요?"),
                        20L,
                        Instant.now()
                )
        ))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("Reservation session entry window has expired.");
    }

    private WebSocketSession mockSession() {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.isOpen()).thenReturn(true);
        return session;
    }

    private User createUser(Long id, String email, String nickname) {
        User user = User.create(email, "encoded-password", nickname);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private MentoringRequest createAcceptedRequest(Long id, User requester, User mentor) {
        MentoringRequest mentoringRequest = MentoringRequest.create(requester, mentor, "Need help");
        mentoringRequest.accept();
        ReflectionTestUtils.setField(mentoringRequest, "id", id);
        return mentoringRequest;
    }

    private MentoringReservation createAcceptedReservation(Long id, User requester, User mentor) {
        return createAcceptedReservation(id, requester, mentor, Instant.now().plusSeconds(300));
    }

    private MentoringReservation createAcceptedReservation(
            Long id,
            User requester,
            User mentor,
            Instant reservedAt
    ) {
        MentoringReservation reservation = MentoringReservation.create(
                requester,
                mentor,
                reservedAt,
                "오후 예약 멘토링"
        );
        reservation.accept();
        ReflectionTestUtils.setField(reservation, "id", id);
        return reservation;
    }

    private StudySession createStudySession(Long id, User host, User member) {
        Space studySpace = Space.create(
                "Study Lounge",
                SpaceType.STUDY,
                "스터디 공간",
                50,
                true
        );
        ReflectionTestUtils.setField(studySpace, "id", 3L);

        StudySession studySession = StudySession.create(
                host,
                studySpace,
                "리액트 훅 스터디",
                "상태 분리와 훅 설계"
        );
        studySession.join(member);
        ReflectionTestUtils.setField(studySession, "id", id);
        return studySession;
    }

    private ObjectNode createMentoringChatPayload(Long requestId, String content) {
        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.put("requestId", requestId);
        payload.put("scope", "mentoring_session");
        payload.put("content", content);
        return payload;
    }

    private ObjectNode createReservationChatPayload(Long reservationId, String content) {
        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.put("reservationId", reservationId);
        payload.put("scope", "reservation_session");
        payload.put("content", content);
        return payload;
    }

    private ObjectNode createStudyChatPayload(Long studySessionId, String content) {
        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.put("studySessionId", studySessionId);
        payload.put("scope", "study_session");
        payload.put("content", content);
        return payload;
    }

    private ObjectNode createUnsupportedChatPayload() {
        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.put("scope", "unknown_scope");
        payload.put("content", "hello");
        return payload;
    }
}
