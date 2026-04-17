package com.neosquare.realtime;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Collectors;

import com.fasterxml.jackson.databind.JsonNode;
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

    private static final String SPACE_SCOPE = "space";
    private static final String MENTORING_SESSION_SCOPE = "mentoring_session";
    private static final String RESERVATION_SESSION_SCOPE = "reservation_session";
    private static final String STUDY_SESSION_SCOPE = "study_session";

    private final MentoringRequestRepository mentoringRequestRepository;
    private final MentoringReservationRepository mentoringReservationRepository;
    private final StudySessionRepository studySessionRepository;
    private final RealtimeSessionRegistry realtimeSessionRegistry;
    private final MentoringReservationSessionAccessPolicy mentoringReservationSessionAccessPolicy;

    public SessionChatRoutingService(
            MentoringRequestRepository mentoringRequestRepository,
            MentoringReservationRepository mentoringReservationRepository,
            StudySessionRepository studySessionRepository,
            RealtimeSessionRegistry realtimeSessionRegistry,
            MentoringReservationSessionAccessPolicy mentoringReservationSessionAccessPolicy
    ) {
        this.mentoringRequestRepository = mentoringRequestRepository;
        this.mentoringReservationRepository = mentoringReservationRepository;
        this.studySessionRepository = studySessionRepository;
        this.realtimeSessionRegistry = realtimeSessionRegistry;
        this.mentoringReservationSessionAccessPolicy = mentoringReservationSessionAccessPolicy;
    }

    public boolean supports(WebSocketMessage incomingMessage) {
        if (incomingMessage.type() != WebSocketEventType.CHAT_SEND) {
            return false;
        }

        String scope = extractScope(incomingMessage.payload());
        return MENTORING_SESSION_SCOPE.equals(scope)
                || RESERVATION_SESSION_SCOPE.equals(scope)
                || STUDY_SESSION_SCOPE.equals(scope);
    }

    public boolean hasScopedChat(WebSocketMessage incomingMessage) {
        if (incomingMessage.type() != WebSocketEventType.CHAT_SEND) {
            return false;
        }

        String scope = extractScope(incomingMessage.payload());
        return scope != null && !scope.isBlank() && !SPACE_SCOPE.equals(scope);
    }

    public SignalRouteResult routeChatMessage(WebSocketMessage incomingMessage) {
        if (incomingMessage.type() != WebSocketEventType.CHAT_SEND) {
            throw new IllegalArgumentException("Unsupported chat message type.");
        }

        if (incomingMessage.senderId() == null) {
            throw new IllegalArgumentException("Chat senderId is required.");
        }

        String scope = extractScope(incomingMessage.payload());

        if (MENTORING_SESSION_SCOPE.equals(scope)) {
            return routeMentoringSessionChat(incomingMessage);
        }

        if (RESERVATION_SESSION_SCOPE.equals(scope)) {
            return routeReservationSessionChat(incomingMessage);
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

    private Set<WebSocketSession> findParticipantSessions(Set<Long> participantUserIds) {
        Set<WebSocketSession> targetSessions = new LinkedHashSet<>();

        for (Long participantUserId : participantUserIds) {
            targetSessions.addAll(realtimeSessionRegistry.findOpenSessions(participantUserId));
        }

        return targetSessions;
    }

    private String extractScope(JsonNode payload) {
        if (payload == null || payload.get("scope") == null || payload.get("scope").isNull()) {
            return null;
        }

        return payload.get("scope").asText();
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
