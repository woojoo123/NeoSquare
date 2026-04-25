package com.neosquare.realtime;

import java.util.LinkedHashSet;
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
public class SessionChatRoutingService {

    private static final String SESSION_SCOPE_FIELD = "sessionScope";
    private static final String LEGACY_SCOPE_FIELD = "scope";
    private static final String MENTORING_SESSION_SCOPE = "mentoring_session";
    private static final String RESERVATION_SESSION_SCOPE = "reservation_session";
    private static final String MENTOR_COURSE_SESSION_SCOPE = "mentor_course_session";
    private static final String STUDY_SESSION_SCOPE = "study_session";
    private static final String CHAT_SCOPE_PUBLIC = "PUBLIC";
    private static final String CHAT_SCOPE_WHISPER = "WHISPER";

    private final MentoringRequestRepository mentoringRequestRepository;
    private final MentoringReservationRepository mentoringReservationRepository;
    private final MentorCourseApplicationRepository mentorCourseApplicationRepository;
    private final StudySessionRepository studySessionRepository;
    private final RealtimeSessionRegistry realtimeSessionRegistry;
    private final MentoringReservationSessionAccessPolicy mentoringReservationSessionAccessPolicy;
    private final MentorCourseSessionAccessPolicy mentorCourseSessionAccessPolicy;

    public SessionChatRoutingService(
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

    public boolean supports(WebSocketMessage incomingMessage) {
        if (incomingMessage.type() != WebSocketEventType.CHAT_SEND) {
            return false;
        }

        return isSupportedSessionScope(extractRequestedSessionScope(incomingMessage.payload()));
    }

    public boolean hasScopedChat(WebSocketMessage incomingMessage) {
        if (incomingMessage.type() != WebSocketEventType.CHAT_SEND) {
            return false;
        }

        String requestedSessionScope = extractRequestedSessionScope(incomingMessage.payload());
        return requestedSessionScope != null && !isSupportedSessionScope(requestedSessionScope);
    }

    public SignalRouteResult routeChatMessage(WebSocketMessage incomingMessage) {
        if (incomingMessage.type() != WebSocketEventType.CHAT_SEND) {
            throw new IllegalArgumentException("Unsupported chat message type.");
        }

        if (incomingMessage.senderId() == null) {
            throw new IllegalArgumentException("Chat senderId is required.");
        }

        String scope = extractRequestedSessionScope(incomingMessage.payload());

        if (MENTORING_SESSION_SCOPE.equals(scope)) {
            return routeMentoringSessionChat(incomingMessage);
        }

        if (RESERVATION_SESSION_SCOPE.equals(scope)) {
            return routeReservationSessionChat(incomingMessage);
        }

        if (MENTOR_COURSE_SESSION_SCOPE.equals(scope)) {
            return routeMentorCourseSessionChat(incomingMessage);
        }

        if (STUDY_SESSION_SCOPE.equals(scope)) {
            return routeStudySessionChat(incomingMessage);
        }

        throw new IllegalArgumentException("Unsupported chat scope.");
    }

    private SignalRouteResult routeMentoringSessionChat(WebSocketMessage incomingMessage) {
        JsonNode payload = incomingMessage.payload();
        Long requestId = extractLong(payload, "requestId", "Mentoring session requestId is required.");
        MentoringRequest mentoringRequest = mentoringRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Mentoring request not found."));

        if (mentoringRequest.getStatus() != MentoringRequestStatus.ACCEPTED) {
            throw new IllegalStateException("Mentoring request is not accepted.");
        }

        if (!mentoringRequest.isParticipant(incomingMessage.senderId())) {
            throw new IllegalStateException("Chat sender is not a participant of this mentoring request.");
        }

        Set<WebSocketSession> targetSessions = findParticipantSessions(Set.of(
                mentoringRequest.getRequester().getId(),
                mentoringRequest.getMentor().getId()
        ));

        return new SignalRouteResult(
                targetSessions,
                WebSocketMessage.relay(incomingMessage.type(), payload, incomingMessage.senderId())
        );
    }

    private SignalRouteResult routeReservationSessionChat(WebSocketMessage incomingMessage) {
        JsonNode payload = incomingMessage.payload();
        Long reservationId = extractLong(payload, "reservationId", "Reservation session id is required.");
        MentoringReservation mentoringReservation = mentoringReservationRepository.findDetailById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Mentoring reservation not found."));

        if (mentoringReservation.getStatus() != MentoringReservationStatus.ACCEPTED) {
            throw new IllegalStateException("Mentoring reservation is not accepted.");
        }

        if (!mentoringReservation.isParticipant(incomingMessage.senderId())) {
            throw new IllegalStateException("Chat sender is not a participant of this mentoring reservation.");
        }

        mentoringReservationSessionAccessPolicy.validateSessionEntry(mentoringReservation);

        Set<WebSocketSession> targetSessions = findParticipantSessions(Set.of(
                mentoringReservation.getRequester().getId(),
                mentoringReservation.getMentor().getId()
        ));

        return new SignalRouteResult(
                targetSessions,
                WebSocketMessage.relay(incomingMessage.type(), payload, incomingMessage.senderId())
        );
    }

    private SignalRouteResult routeStudySessionChat(WebSocketMessage incomingMessage) {
        JsonNode payload = incomingMessage.payload();
        Long studySessionId = extractLong(payload, "studySessionId", "Study session id is required.");
        StudySession studySession = studySessionRepository.findDetailById(studySessionId)
                .orElseThrow(() -> new IllegalArgumentException("Study session not found."));

        if (studySession.getStatus() != StudySessionStatus.ACTIVE) {
            throw new IllegalStateException("Study session is not active.");
        }

        if (!studySession.isParticipant(incomingMessage.senderId())) {
            throw new IllegalStateException("Chat sender is not a participant of this study session.");
        }

        Set<Long> participantUserIds = studySession.getParticipants().stream()
                .map(participant -> participant.getUser().getId())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<WebSocketSession> targetSessions = findParticipantSessions(participantUserIds);

        return new SignalRouteResult(
                targetSessions,
                WebSocketMessage.relay(incomingMessage.type(), payload, incomingMessage.senderId())
        );
    }

    private SignalRouteResult routeMentorCourseSessionChat(WebSocketMessage incomingMessage) {
        JsonNode payload = incomingMessage.payload();
        Long applicationId = extractLong(payload, "applicationId", "Course session applicationId is required.");
        MentorCourseApplication application = mentorCourseApplicationRepository.findDetailById(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Course application not found."));

        if (application.getStatus() != MentorCourseApplicationStatus.APPROVED) {
            throw new IllegalStateException("Course application is not approved.");
        }

        if (!application.isParticipant(incomingMessage.senderId())) {
            throw new IllegalStateException("Chat sender is not a participant of this course session.");
        }

        mentorCourseSessionAccessPolicy.validateSessionEntry(application);

        Set<WebSocketSession> targetSessions = findParticipantSessions(Set.of(
                application.getApplicant().getId(),
                application.getCourse().getMentor().getId()
        ));

        return new SignalRouteResult(
                targetSessions,
                WebSocketMessage.relay(incomingMessage.type(), payload, incomingMessage.senderId())
        );
    }

    private Set<WebSocketSession> findParticipantSessions(Set<Long> participantUserIds) {
        Set<WebSocketSession> targetSessions = new LinkedHashSet<>();

        for (Long participantUserId : participantUserIds) {
            targetSessions.addAll(realtimeSessionRegistry.findOpenSessions(participantUserId));
        }

        return targetSessions;
    }

    private boolean isSupportedSessionScope(String scope) {
        return MENTORING_SESSION_SCOPE.equals(scope)
                || RESERVATION_SESSION_SCOPE.equals(scope)
                || MENTOR_COURSE_SESSION_SCOPE.equals(scope)
                || STUDY_SESSION_SCOPE.equals(scope);
    }

    private String extractRequestedSessionScope(JsonNode payload) {
        String explicitSessionScope = extractText(payload, SESSION_SCOPE_FIELD);

        if (explicitSessionScope != null) {
            return explicitSessionScope;
        }

        String legacyScope = extractText(payload, LEGACY_SCOPE_FIELD);

        if (legacyScope == null) {
            return null;
        }

        if (CHAT_SCOPE_PUBLIC.equalsIgnoreCase(legacyScope) || CHAT_SCOPE_WHISPER.equalsIgnoreCase(legacyScope)) {
            return null;
        }

        return legacyScope;
    }

    private String extractText(JsonNode payload, String fieldName) {
        if (payload == null || payload.get(fieldName) == null || payload.get(fieldName).isNull()) {
            return null;
        }

        String value = payload.get(fieldName).asText();
        return value == null || value.isBlank() ? null : value.trim();
    }

    private Long extractLong(JsonNode payload, String fieldName, String errorMessage) {
        if (payload == null || payload.get(fieldName) == null || payload.get(fieldName).isNull()) {
            throw new IllegalArgumentException(errorMessage);
        }

        JsonNode fieldNode = payload.get(fieldName);

        if (fieldNode.canConvertToLong()) {
            return fieldNode.asLong();
        }

        if (fieldNode.isTextual()) {
            try {
                return Long.parseLong(fieldNode.asText());
            } catch (NumberFormatException exception) {
                throw new IllegalArgumentException(fieldName + " must be numeric.");
            }
        }

        throw new IllegalArgumentException(fieldName + " must be numeric.");
    }
}
