package com.neosquare.config;

import com.neosquare.realtime.RealtimeWebSocketHandler;
import com.neosquare.realtime.AuthenticatedWebSocketHandshakeInterceptor;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final RealtimeWebSocketHandler realtimeWebSocketHandler;
    private final AuthenticatedWebSocketHandshakeInterceptor authenticatedWebSocketHandshakeInterceptor;

    public WebSocketConfig(
            RealtimeWebSocketHandler realtimeWebSocketHandler,
            AuthenticatedWebSocketHandshakeInterceptor authenticatedWebSocketHandshakeInterceptor
    ) {
        this.realtimeWebSocketHandler = realtimeWebSocketHandler;
        this.authenticatedWebSocketHandshakeInterceptor = authenticatedWebSocketHandshakeInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(realtimeWebSocketHandler, "/ws")
                .addInterceptors(authenticatedWebSocketHandshakeInterceptor)
                .setAllowedOriginPatterns(
                        "http://localhost:*",
                        "http://127.0.0.1:*"
                );
    }
}
