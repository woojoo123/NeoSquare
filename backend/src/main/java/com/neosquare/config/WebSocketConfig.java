package com.neosquare.config;

import com.neosquare.realtime.RealtimeWebSocketHandler;
import com.neosquare.realtime.AuthenticatedWebSocketHandshakeInterceptor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final RealtimeWebSocketHandler realtimeWebSocketHandler;
    private final AuthenticatedWebSocketHandshakeInterceptor authenticatedWebSocketHandshakeInterceptor;
    private final String[] allowedOriginPatterns;

    public WebSocketConfig(
            RealtimeWebSocketHandler realtimeWebSocketHandler,
            AuthenticatedWebSocketHandshakeInterceptor authenticatedWebSocketHandshakeInterceptor,
            @Value("${app.websocket.allowed-origin-patterns:http://localhost:*,http://127.0.0.1:*,https://localhost:*,https://127.0.0.1:*,https://*.duckdns.org,http://*.duckdns.org}")
            String[] allowedOriginPatterns
    ) {
        this.realtimeWebSocketHandler = realtimeWebSocketHandler;
        this.authenticatedWebSocketHandshakeInterceptor = authenticatedWebSocketHandshakeInterceptor;
        this.allowedOriginPatterns = allowedOriginPatterns;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(realtimeWebSocketHandler, "/ws")
                .addInterceptors(authenticatedWebSocketHandshakeInterceptor)
                .setAllowedOriginPatterns(allowedOriginPatterns);
    }
}
