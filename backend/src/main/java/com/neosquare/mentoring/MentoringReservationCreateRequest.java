package com.neosquare.mentoring;

import java.time.Instant;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record MentoringReservationCreateRequest(
        @NotNull(message = "mentorId is required.")
        @Positive(message = "mentorId must be positive.")
        Long mentorId,
        @NotNull(message = "reservedAt is required.")
        Instant reservedAt,
        @Size(max = 500, message = "message must be at most 500 characters.")
        String message
) {
}
