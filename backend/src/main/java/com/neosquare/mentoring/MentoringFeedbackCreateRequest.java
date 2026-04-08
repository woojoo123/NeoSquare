package com.neosquare.mentoring;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record MentoringFeedbackCreateRequest(
        @NotNull(message = "requestId is required.")
        @Positive(message = "requestId must be positive.")
        Long requestId,
        @NotNull(message = "rating is required.")
        @Min(value = 1, message = "rating must be between 1 and 5.")
        @Max(value = 5, message = "rating must be between 1 and 5.")
        Integer rating,
        @Size(max = 255, message = "summary must be at most 255 characters.")
        String summary,
        @Size(max = 2000, message = "feedback must be at most 2000 characters.")
        String feedback
) {
}
