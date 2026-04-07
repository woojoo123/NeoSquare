package com.neosquare.realtime;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class RealtimeWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(RealtimeWebSocketHandler.class);

    private final ObjectMapper objectMapper;
    private final MentoringSessionSignalingService mentoringSessionSignalingService;
    private final RealtimeSessionRegistry realtimeSessionRegistry;

    public RealtimeWebSocketHandler(
            ObjectMapper objectMapper,
            MentoringSessionSignalingService mentoringSessionSignalingService,
            RealtimeSessionRegistry realtimeSessionRegistry
    ) {
        this.objectMapper = objectMapper;
        this.mentoringSessionSignalingService = mentoringSessionSignalingService;
        this.realtimeSessionRegistry = realtimeSessionRegistry;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        log.info("WebSocket connected. sessionId={}", session.getId());
        sendMessage(session, WebSocketMessage.connected(session.getId()));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        realtimeSessionRegistry.removeSession(session);
        log.info(
                "WebSocket disconnected. sessionId={}, code={}, reason={}",
                session.getId(),
                status.getCode(),
                status.getReason()
        );
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("WebSocket transport error. sessionId={}", session.getId(), exception);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        WebSocketEventType incomingType = null;

        try {
            WebSocketMessage incomingMessage = objectMapper.readValue(message.getPayload(), WebSocketMessage.class);

            if (incomingMessage.type() == null) {
                throw new IllegalArgumentException("WebSocket message type is required.");
            }

            incomingType = incomingMessage.type();

            if (incomingMessage.senderId() != null) {
                realtimeSessionRegistry.bindSession(session, incomingMessage.senderId());
            }

            log.info(
                    "WebSocket message received. sessionId={}, type={}, senderId={}",
                    session.getId(),
                    incomingMessage.type().getValue(),
                    incomingMessage.senderId()
            );

            if (mentoringSessionSignalingService.supports(incomingMessage.type())) {
                SignalRouteResult routeResult = mentoringSessionSignalingService.routeSignal(incomingMessage);

                for (WebSocketSession targetSession : routeResult.targetSessions()) {
                    sendMessage(targetSession, routeResult.outboundMessage());
                }
            }

            sendMessage(session, WebSocketMessage.ack(incomingMessage.type(), session.getId()));
        } catch (JsonProcessingException exception) {
            log.warn("Invalid WebSocket message. sessionId={}", session.getId(), exception);
            sendMessage(session, WebSocketMessage.error("Invalid WebSocket message."));
        } catch (IllegalArgumentException | IllegalStateException exception) {
            log.warn("WebSocket message rejected. sessionId={}", session.getId(), exception);
            if (incomingType == null) {
                sendMessage(session, WebSocketMessage.error("Invalid WebSocket message."));
            } else {
                sendMessage(session, WebSocketMessage.error(exception.getMessage(), incomingType));
            }
        }
    }

    private void sendMessage(WebSocketSession session, WebSocketMessage message) throws Exception {
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
    }
}
