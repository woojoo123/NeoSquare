package com.neosquare.common;

import java.time.Instant;
import java.util.Map;

import org.springframework.http.HttpStatus;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
        boolean success,
        String message,
        int status,
        String timestamp,
        Map<String, String> errors
) {

    public static ErrorResponse of(HttpStatus status, String message) {
        return new ErrorResponse(
                false,
                message,
                status.value(),
                Instant.now().toString(),
                null
        );
    }

    public static ErrorResponse of(HttpStatus status, String message, Map<String, String> errors) {
        return new ErrorResponse(
                false,
                message,
                status.value(),
                Instant.now().toString(),
                errors
        );
    }
}
