package com.neosquare.mentoring;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record MentoringRequestCreateRequest(
        @NotNull(message = "mentorId is required.")
        @Positive(message = "mentorId must be positive.")
        Long mentorId,
        @NotBlank(message = "message is required.")
        @Size(max = 500, message = "message must be at most 500 characters.")
        String message
) {
}
