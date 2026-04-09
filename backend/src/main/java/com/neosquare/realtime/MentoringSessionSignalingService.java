package com.neosquare.realtime;

import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.neosquare.mentoring.MentoringRequest;
import com.neosquare.mentoring.MentoringRequestRepository;
import com.neosquare.mentoring.MentoringRequestStatus;
import com.neosquare.mentoring.MentoringReservation;
import com.neosquare.mentoring.MentoringReservationRepository;
import com.neosquare.mentoring.MentoringReservationStatus;

import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

@Service
public class MentoringSessionSignalingService {

    private static final String MENTORING_SESSION_SCOPE = "mentoring_session";
    private static final String RESERVATION_SESSION_SCOPE = "reservation_session";

    private final MentoringRequestRepository mentoringRequestRepository;
    private final MentoringReservationRepository mentoringReservationRepository;
    private final RealtimeSessionRegistry realtimeSessionRegistry;

    public MentoringSessionSignalingService(
            MentoringRequestRepository mentoringRequestRepository,
            MentoringReservationRepository mentoringReservationRepository,
            RealtimeSessionRegistry realtimeSessionRegistry
    ) {
        this.mentoringRequestRepository = mentoringRequestRepository;
        this.mentoringReservationRepository = mentoringReservationRepository;
        this.realtimeSessionRegistry = realtimeSessionRegistry;
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
