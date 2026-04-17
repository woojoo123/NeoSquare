package com.neosquare.realtime;

import java.util.Set;
import java.util.stream.Collectors;

import com.fasterxml.jackson.databind.JsonNode;
import com.neosquare.mentor.MentorCourseApplication;
import com.neosquare.mentor.MentorCourseApplicationRepository;
import com.neosquare.mentor.MentorCourseApplicationStatus;
import com.neosquare.mentor.MentorCourseSessionAccessPolicy;
import com.neosquare.mentoring.MentoringRequest;
import com.neosquare.mentoring.MentoringRequestRepository;
import com.neosquare.mentoring.MentoringRequestStatus;
import com.neosquare.mentoring.MentoringReservation;
import com.neosquare.mentoring.MentoringReservationRepository;
import com.neosquare.mentoring.MentoringReservationSessionAccessPolicy;
import com.neosquare.mentoring.MentoringReservationStatus;
import com.neosquare.study.StudySession;
import com.neosquare.study.StudySessionRepository;
import com.neosquare.study.StudySessionStatus;

import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

@Service
public class MentoringSessionSignalingService {

    private static final String MENTORING_SESSION_SCOPE = "mentoring_session";
    private static final String RESERVATION_SESSION_SCOPE = "reservation_session";
    private static final String MENTOR_COURSE_SESSION_SCOPE = "mentor_course_session";
    private static final String STUDY_SESSION_SCOPE = "study_session";

    private final MentoringRequestRepository mentoringRequestRepository;
    private final MentoringReservationRepository mentoringReservationRepository;
    private final MentorCourseApplicationRepository mentorCourseApplicationRepository;
    private final StudySessionRepository studySessionRepository;
    private final RealtimeSessionRegistry realtimeSessionRegistry;
    private final MentoringReservationSessionAccessPolicy mentoringReservationSessionAccessPolicy;
    private final MentorCourseSessionAccessPolicy mentorCourseSessionAccessPolicy;

    public MentoringSessionSignalingService(
            MentoringRequestRepository mentoringRequestRepository,
            MentoringReservationRepository mentoringReservationRepository,
            MentorCourseApplicationRepository mentorCourseApplicationRepository,
            StudySessionRepository studySessionRepository,
            RealtimeSessionRegistry realtimeSessionRegistry,
            MentoringReservationSessionAccessPolicy mentoringReservationSessionAccessPolicy,
            MentorCourseSessionAccessPolicy mentorCourseSessionAccessPolicy
    ) {
        this.mentoringRequestRepository = mentoringRequestRepository;
        this.mentoringReservationRepository = mentoringReservationRepository;
        this.mentorCourseApplicationRepository = mentorCourseApplicationRepository;
        this.studySessionRepository = studySessionRepository;
        this.realtimeSessionRegistry = realtimeSessionRegistry;
        this.mentoringReservationSessionAccessPolicy = mentoringReservationSessionAccessPolicy;
        this.mentorCourseSessionAccessPolicy = mentorCourseSessionAccessPolicy;
    }

    public boolean supports(WebSocketEventType eventType) {
        return eventType == WebSocketEventType.WEBRTC_OFFER
                || eventType == WebSocketEventType.WEBRTC_ANSWER
                || eventType == WebSocketEventType.WEBRTC_ICE_CANDIDATE;
    }

    public SignalRouteResult routeSignal(WebSocketMessage incomingMessage) {
        if (!supports(incomingMessage.type())) {
            throw new IllegalArgumentException("Unsupported signaling message type.");
        }

        if (incomingMessage.senderId() == null) {
            throw new IllegalArgumentException("Signaling senderId is required.");
        }

        JsonNode payload = incomingMessage.payload();
        String scope = extractScope(payload);

        if (MENTORING_SESSION_SCOPE.equals(scope)) {
            return routeMentoringRequestSignal(incomingMessage, payload);
        }

        if (RESERVATION_SESSION_SCOPE.equals(scope)) {
            return routeReservationSignal(incomingMessage, payload);
        }

        if (MENTOR_COURSE_SESSION_SCOPE.equals(scope)) {
            return routeMentorCourseSignal(incomingMessage, payload);
        }

        if (STUDY_SESSION_SCOPE.equals(scope)) {
            return routeStudySessionSignal(incomingMessage, payload);
        }

        throw new IllegalArgumentException("Unsupported signaling scope.");
    }

    private SignalRouteResult routeMentoringRequestSignal(WebSocketMessage incomingMessage, JsonNode payload) {
        Long requestId = extractLong(payload, "requestId", "Mentoring session requestId is required.");
        MentoringRequest mentoringRequest = mentoringRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Mentoring request not found."));

        if (mentoringRequest.getStatus() != MentoringRequestStatus.ACCEPTED) {
            throw new IllegalStateException("Mentoring request is not accepted.");
        }

        if (!mentoringRequest.isParticipant(incomingMessage.senderId())) {
            throw new IllegalStateException("Signal sender is not a participant of this mentoring request.");
        }

        Long targetUserId = mentoringRequest.resolveCounterpartUserId(incomingMessage.senderId());
        Set<WebSocketSession> targetSessions = realtimeSessionRegistry.findOpenSessions(targetUserId);

        if (targetSessions.isEmpty()) {
            throw new IllegalStateException("Target participant is not connected.");
        }

        return new SignalRouteResult(
                targetSessions,
                WebSocketMessage.relay(incomingMessage.type(), payload, incomingMessage.senderId())
        );
    }

    private SignalRouteResult routeStudySessionSignal(WebSocketMessage incomingMessage, JsonNode payload) {
        Long studySessionId = extractLong(payload, "studySessionId", "Study session id is required.");
        Long targetUserId = extractLong(payload, "targetUserId", "Study session targetUserId is required.");
        StudySession studySession = studySessionRepository.findDetailById(studySessionId)
                .orElseThrow(() -> new IllegalArgumentException("Study session not found."));

        if (studySession.getStatus() != StudySessionStatus.ACTIVE) {
            throw new IllegalStateException("Study session is not active.");
        }

        if (!studySession.isParticipant(incomingMessage.senderId())) {
            throw new IllegalStateException("Signal sender is not a participant of this study session.");
        }

        if (!studySession.isParticipant(targetUserId)) {
            throw new IllegalStateException("Signal target is not a participant of this study session.");
        }

        if (incomingMessage.senderId().equals(targetUserId)) {
            throw new IllegalArgumentException("Study session signaling targetUserId must be another participant.");
        }

        Set<WebSocketSession> targetSessions = realtimeSessionRegistry.findOpenSessions(targetUserId);

        if (targetSessions.isEmpty()) {
            throw new IllegalStateException("Target participant is not connected.");
        }

        return new SignalRouteResult(
                targetSessions.stream().filter(WebSocketSession::isOpen).collect(Collectors.toSet()),
                WebSocketMessage.relay(incomingMessage.type(), payload, incomingMessage.senderId())
        );
    }

    private SignalRouteResult routeReservationSignal(WebSocketMessage incomingMessage, JsonNode payload) {
        Long reservationId = extractLong(payload, "reservationId", "Reservation session reservationId is required.");
        MentoringReservation mentoringReservation = mentoringReservationRepository.findDetailById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Mentoring reservation not found."));

        if (mentoringReservation.getStatus() != MentoringReservationStatus.ACCEPTED) {
            throw new IllegalStateException("Mentoring reservation is not accepted.");
        }

        if (!mentoringReservation.isParticipant(incomingMessage.senderId())) {
            throw new IllegalStateException("Signal sender is not a participant of this mentoring reservation.");
        }

        mentoringReservationSessionAccessPolicy.validateSessionEntry(mentoringReservation);

        Long targetUserId = mentoringReservation.resolveCounterpartUserId(incomingMessage.senderId());
        Set<WebSocketSession> targetSessions = realtimeSessionRegistry.findOpenSessions(targetUserId);

        if (targetSessions.isEmpty()) {
            throw new IllegalStateException("Target participant is not connected.");
        }

        return new SignalRouteResult(
                targetSessions,
                WebSocketMessage.relay(incomingMessage.type(), payload, incomingMessage.senderId())
        );
    }

    private SignalRouteResult routeMentorCourseSignal(WebSocketMessage incomingMessage, JsonNode payload) {
        Long applicationId = extractLong(payload, "applicationId", "Course session applicationId is required.");
        MentorCourseApplication application = mentorCourseApplicationRepository.findDetailById(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Course application not found."));

        if (application.getStatus() != MentorCourseApplicationStatus.APPROVED) {
            throw new IllegalStateException("Course application is not approved.");
        }

        if (!application.isParticipant(incomingMessage.senderId())) {
            throw new IllegalStateException("Signal sender is not a participant of this course session.");
        }

        mentorCourseSessionAccessPolicy.validateSessionEntry(application);

        Long targetUserId = application.resolveCounterpartUserId(incomingMessage.senderId());
        Set<WebSocketSession> targetSessions = realtimeSessionRegistry.findOpenSessions(targetUserId);

        if (targetSessions.isEmpty()) {
            throw new IllegalStateException("Target participant is not connected.");
        }

        return new SignalRouteResult(
                targetSessions,
                WebSocketMessage.relay(incomingMessage.type(), payload, incomingMessage.senderId())
        );
    }

    private Long extractLong(JsonNode payload, String fieldName, String errorMessage) {
        if (payload == null || payload.get(fieldName) == null || payload.get(fieldName).isNull()) {
            throw new IllegalArgumentException(errorMessage);
        }

        JsonNode requestIdNode = payload.get(fieldName);

        if (requestIdNode.canConvertToLong()) {
            return requestIdNode.asLong();
        }

        if (requestIdNode.isTextual()) {
            try {
                return Long.parseLong(requestIdNode.asText());
            } catch (NumberFormatException exception) {
                throw new IllegalArgumentException(fieldName + " must be numeric.");
            }
        }

        throw new IllegalArgumentException(fieldName + " must be numeric.");
    }

    private String extractScope(JsonNode payload) {
        if (payload == null || payload.get("scope") == null || payload.get("scope").isNull()) {
            throw new IllegalArgumentException("Mentoring session signaling scope is required.");
        }

        return payload.get("scope").asText();
    }
}
