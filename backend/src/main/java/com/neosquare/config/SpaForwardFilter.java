package com.neosquare.config;

import java.io.IOException;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class SpaForwardFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String path = request.getRequestURI();

        if (isFrontendRoute(request.getMethod(), path)) {
            request.getRequestDispatcher("/index.html").forward(request, response);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isFrontendRoute(String method, String path) {
        return "GET".equalsIgnoreCase(method)
                && !"/".equals(path)
                && !path.startsWith("/api")
                && !path.startsWith("/ws")
                && !path.contains(".");
    }
}
