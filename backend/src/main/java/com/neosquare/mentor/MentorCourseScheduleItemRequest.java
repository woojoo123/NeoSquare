package com.neosquare.mentor;

import java.time.Instant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record MentorCourseScheduleItemRequest(
        @NotBlank(message = "scheduleItems[].title is required.")
        @Size(max = 120, message = "scheduleItems[].title must be at most 120 characters.")
        String title,
        @Size(max = 500, message = "scheduleItems[].description must be at most 500 characters.")
        String description,
        @NotNull(message = "scheduleItems[].startsAt is required.")
        Instant startsAt,
        @NotNull(message = "scheduleItems[].endsAt is required.")
        Instant endsAt
) {
}
