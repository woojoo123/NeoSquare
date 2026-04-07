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
import com.neosquare.user.User;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.socket.WebSocketSession;

class MentoringSessionSignalingServiceTest {

    private MentoringRequestRepository mentoringRequestRepository;
    private RealtimeSessionRegistry realtimeSessionRegistry;
    private MentoringSessionSignalingService mentoringSessionSignalingService;

    @BeforeEach
    void setUp() {
        mentoringRequestRepository = mock(MentoringRequestRepository.class);
        realtimeSessionRegistry = mock(RealtimeSessionRegistry.class);
        mentoringSessionSignalingService = new MentoringSessionSignalingService(
                mentoringRequestRepository,
                realtimeSessionRegistry
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

    private ObjectNode createSignalPayload(Long requestId) {
        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.put("requestId", requestId);
        payload.put("scope", "mentoring_session");

        ObjectNode sdp = payload.putObject("sdp");
        sdp.put("type", "offer");
        sdp.put("sdp", "sample-offer");
        return payload;
    }
}
