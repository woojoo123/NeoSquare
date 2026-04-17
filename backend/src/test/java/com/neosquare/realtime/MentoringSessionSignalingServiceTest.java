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

class MentoringSessionSignalingServiceTest {

    private MentoringRequestRepository mentoringRequestRepository;
    private MentoringReservationRepository mentoringReservationRepository;
    private StudySessionRepository studySessionRepository;
    private RealtimeSessionRegistry realtimeSessionRegistry;
    private MentoringSessionSignalingService mentoringSessionSignalingService;

    @BeforeEach
    void setUp() {
        mentoringRequestRepository = mock(MentoringRequestRepository.class);
        mentoringReservationRepository = mock(MentoringReservationRepository.class);
        studySessionRepository = mock(StudySessionRepository.class);
        realtimeSessionRegistry = mock(RealtimeSessionRegistry.class);
        mentoringSessionSignalingService = new MentoringSessionSignalingService(
                mentoringRequestRepository,
                mentoringReservationRepository,
                studySessionRepository,
                realtimeSessionRegistry,
                new MentoringReservationSessionAccessPolicy()
        );
    }

    @Test
    void routeSignalRoutesAcceptedRequestToCounterpartUser() {
        User requester = createUser(1L, "requester@neo.square", "Requester");
        User mentor = createUser(2L, "mentor@neo.square", "Mentor");
        MentoringRequest mentoringRequest = createAcceptedRequest(41L, requester, mentor);
        WebSocketSession mentorSession = mock(WebSocketSession.class);
        when(mentorSession.isOpen()).thenReturn(true);

        when(mentoringRequestRepository.findById(41L)).thenReturn(Optional.of(mentoringRequest));
        when(realtimeSessionRegistry.findOpenSessions(2L)).thenReturn(Set.of(mentorSession));

        SignalRouteResult routeResult = mentoringSessionSignalingService.routeSignal(
                new WebSocketMessage(
                        WebSocketEventType.WEBRTC_OFFER,
                        createSignalPayload(41L),
                        1L,
                        Instant.now()
                )
        );

        assertThat(routeResult.targetSessions()).containsExactly(mentorSession);
        assertThat(routeResult.outboundMessage().type()).isEqualTo(WebSocketEventType.WEBRTC_OFFER);
        assertThat(routeResult.outboundMessage().senderId()).isEqualTo(1L);
        assertThat(routeResult.outboundMessage().payload().get("requestId").asLong()).isEqualTo(41L);
        assertThat(routeResult.outboundMessage().payload().get("scope").asText()).isEqualTo("mentoring_session");
    }

    @Test
    void routeSignalRoutesAcceptedReservationToCounterpartUser() {
        User requester = createUser(1L, "requester@neo.square", "Requester");
        User mentor = createUser(2L, "mentor@neo.square", "Mentor");
        MentoringReservation reservation = createAcceptedReservation(71L, requester, mentor);
        WebSocketSession mentorSession = mock(WebSocketSession.class);
        when(mentorSession.isOpen()).thenReturn(true);

        when(mentoringReservationRepository.findDetailById(71L)).thenReturn(Optional.of(reservation));
        when(realtimeSessionRegistry.findOpenSessions(2L)).thenReturn(Set.of(mentorSession));

        SignalRouteResult routeResult = mentoringSessionSignalingService.routeSignal(
                new WebSocketMessage(
                        WebSocketEventType.WEBRTC_OFFER,
                        createReservationSignalPayload(71L),
                        1L,
                        Instant.now()
                )
        );

        assertThat(routeResult.targetSessions()).containsExactly(mentorSession);
        assertThat(routeResult.outboundMessage().payload().get("reservationId").asLong()).isEqualTo(71L);
        assertThat(routeResult.outboundMessage().payload().get("scope").asText()).isEqualTo("reservation_session");
    }

    @Test
    void routeSignalRoutesStudySessionSignalToTargetParticipant() {
        User host = createUser(10L, "host@neo.square", "Host");
        User member = createUser(11L, "member@neo.square", "Member");
        StudySession studySession = createStudySession(91L, host, member);
        WebSocketSession memberSession = mock(WebSocketSession.class);
        when(memberSession.isOpen()).thenReturn(true);

        when(studySessionRepository.findDetailById(91L)).thenReturn(Optional.of(studySession));
        when(realtimeSessionRegistry.findOpenSessions(11L)).thenReturn(Set.of(memberSession));

        SignalRouteResult routeResult = mentoringSessionSignalingService.routeSignal(
                new WebSocketMessage(
                        WebSocketEventType.WEBRTC_OFFER,
                        createStudySignalPayload(91L, 11L),
                        10L,
                        Instant.now()
                )
        );

        assertThat(routeResult.targetSessions()).containsExactly(memberSession);
        assertThat(routeResult.outboundMessage().payload().get("studySessionId").asLong()).isEqualTo(91L);
        assertThat(routeResult.outboundMessage().payload().get("targetUserId").asLong()).isEqualTo(11L);
        assertThat(routeResult.outboundMessage().payload().get("scope").asText()).isEqualTo("study_session");
    }

    @Test
    void routeSignalRejectsWhenMentoringRequestIsNotAccepted() {
        User requester = createUser(1L, "requester@neo.square", "Requester");
        User mentor = createUser(2L, "mentor@neo.square", "Mentor");
        MentoringRequest mentoringRequest = MentoringRequest.create(requester, mentor, "Need help");
        ReflectionTestUtils.setField(mentoringRequest, "id", 41L);

        when(mentoringRequestRepository.findById(41L)).thenReturn(Optional.of(mentoringRequest));

        assertThatThrownBy(() -> mentoringSessionSignalingService.routeSignal(
                new WebSocketMessage(
                        WebSocketEventType.WEBRTC_OFFER,
                        createSignalPayload(41L),
                        1L,
                        Instant.now()
                )
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Mentoring request is not accepted.");
    }

    @Test
    void routeSignalRejectsReservationWhenSessionEntryIsNotOpenYet() {
        User requester = createUser(1L, "requester@neo.square", "Requester");
        User mentor = createUser(2L, "mentor@neo.square", "Mentor");
        MentoringReservation reservation = createAcceptedReservation(
                71L,
                requester,
                mentor,
                Instant.now().plusSeconds(3600)
        );

        when(mentoringReservationRepository.findDetailById(71L)).thenReturn(Optional.of(reservation));

        assertThatThrownBy(() -> mentoringSessionSignalingService.routeSignal(
                new WebSocketMessage(
                        WebSocketEventType.WEBRTC_OFFER,
                        createReservationSignalPayload(71L),
                        1L,
                        Instant.now()
                )
        ))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("Reservation session entry is not open yet.");
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
                "Need mentoring tomorrow"
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
                "네트워크 스터디",
                "WebRTC signaling 구조 점검"
        );
        studySession.join(member);
        ReflectionTestUtils.setField(studySession, "id", id);
        return studySession;
    }

    private ObjectNode createSignalPayload(Long requestId) {
        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.put("requestId", requestId);
        payload.put("scope", "mentoring_session");

        ObjectNode sdp = payload.putObject("sdp");
        sdp.put("type", "offer");
        sdp.put("sdp", "sample-offer");
        return payload;
    }

    private ObjectNode createReservationSignalPayload(Long reservationId) {
        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.put("reservationId", reservationId);
        payload.put("scope", "reservation_session");

        ObjectNode sdp = payload.putObject("sdp");
        sdp.put("type", "offer");
        sdp.put("sdp", "sample-offer");
        return payload;
    }

    private ObjectNode createStudySignalPayload(Long studySessionId, Long targetUserId) {
        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.put("studySessionId", studySessionId);
        payload.put("targetUserId", targetUserId);
        payload.put("scope", "study_session");

        ObjectNode sdp = payload.putObject("sdp");
        sdp.put("type", "offer");
        sdp.put("sdp", "sample-offer");
        return payload;
    }
}
