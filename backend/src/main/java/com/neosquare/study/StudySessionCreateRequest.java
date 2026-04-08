package com.neosquare.study;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record StudySessionCreateRequest(
        @NotNull(message = "spaceId is required.")
        Long spaceId,

        @NotBlank(message = "title is required.")
        @Size(max = 100, message = "title must be at most 100 characters.")
        String title,

        @Size(max = 500, message = "description must be at most 500 characters.")
        String description
) {
}
