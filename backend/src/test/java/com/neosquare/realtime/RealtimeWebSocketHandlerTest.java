package com.neosquare.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

class RealtimeWebSocketHandlerTest {

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private RealtimeWebSocketHandler realtimeWebSocketHandler;

    @BeforeEach
    void setUp() {
        realtimeWebSocketHandler = new RealtimeWebSocketHandler(objectMapper);
    }

    @Test
    void afterConnectionEstablishedSendsConnectedMessage() throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-1");

        realtimeWebSocketHandler.afterConnectionEstablished(session);

        JsonNode response = captureResponse(session);

        assertThat(response.get("type").asText()).isEqualTo("ws_connected");
        assertThat(response.get("payload").get("sessionId").asText()).isEqualTo("session-1");
        assertThat(response.get("payload").get("message").asText()).isEqualTo("WebSocket connected.");
        assertThat(response.get("timestamp").asText()).isNotBlank();
    }

    @Test
    void handleTextMessageWithValidPayloadSendsAck() throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-2");

        realtimeWebSocketHandler.handleTextMessage(
                session,
                new TextMessage("""
                        {
                          "type": "user_enter",
                          "senderId": 1,
                          "payload": {
                            "spaceId": 1
                          }
                        }
                        """)
        );

        JsonNode response = captureResponse(session);

        assertThat(response.get("type").asText()).isEqualTo("ws_ack");
        assertThat(response.get("payload").get("receivedType").asText()).isEqualTo("user_enter");
        assertThat(response.get("payload").get("sessionId").asText()).isEqualTo("session-2");
        assertThat(response.get("payload").get("message").asText()).isEqualTo("Message received.");
    }

    @Test
    void handleTextMessageWithInvalidPayloadSendsError() throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-3");

        realtimeWebSocketHandler.handleTextMessage(
                session,
                new TextMessage("""
                        {
                          "payload": {
                            "spaceId": 1
                          }
                        }
                        """)
        );

        JsonNode response = captureResponse(session);

        assertThat(response.get("type").asText()).isEqualTo("ws_error");
        assertThat(response.get("payload").get("message").asText()).isEqualTo("Invalid WebSocket message.");
    }

    private JsonNode captureResponse(WebSocketSession session) throws Exception {
        ArgumentCaptor<TextMessage> captor = ArgumentCaptor.forClass(TextMessage.class);

        verify(session).sendMessage(captor.capture());

        return objectMapper.readTree(captor.getValue().getPayload());
    }
}
