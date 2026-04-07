package com.neosquare.realtime;

import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.neosquare.mentoring.MentoringRequest;
import com.neosquare.mentoring.MentoringRequestRepository;
import com.neosquare.mentoring.MentoringRequestStatus;

import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

@Service
public class MentoringSessionSignalingService {

    private final MentoringRequestRepository mentoringRequestRepository;
    private final RealtimeSessionRegistry realtimeSessionRegistry;

    public MentoringSessionSignalingService(
            MentoringRequestRepository mentoringRequestRepository,
            RealtimeSessionRegistry realtimeSessionRegistry
    ) {
        this.mentoringRequestRepository = mentoringRequestRepository;
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
        Long requestId = extractRequestId(payload);
        String scope = extractScope(payload);

        if (!"mentoring_session".equals(scope)) {
            throw new IllegalArgumentException("Unsupported signaling scope.");
        }

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

    private Long extractRequestId(JsonNode payload) {
        if (payload == null || payload.get("requestId") == null || payload.get("requestId").isNull()) {
            throw new IllegalArgumentException("Mentoring session requestId is required.");
        }

        JsonNode requestIdNode = payload.get("requestId");

        if (requestIdNode.canConvertToLong()) {
            return requestIdNode.asLong();
        }

        if (requestIdNode.isTextual()) {
            try {
                return Long.parseLong(requestIdNode.asText());
            } catch (NumberFormatException exception) {
                throw new IllegalArgumentException("Mentoring session requestId must be numeric.");
            }
        }

        throw new IllegalArgumentException("Mentoring session requestId must be numeric.");
    }

    private String extractScope(JsonNode payload) {
        if (payload == null || payload.get("scope") == null || payload.get("scope").isNull()) {
            throw new IllegalArgumentException("Mentoring session signaling scope is required.");
        }

        return payload.get("scope").asText();
    }
}
