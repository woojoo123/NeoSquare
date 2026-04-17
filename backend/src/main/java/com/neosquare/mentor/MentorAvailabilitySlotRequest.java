package com.neosquare.mentor;

import java.time.DayOfWeek;
import java.time.LocalTime;

import jakarta.validation.constraints.NotNull;

public record MentorAvailabilitySlotRequest(
        @NotNull(message = "dayOfWeek is required.")
        DayOfWeek dayOfWeek,
        @NotNull(message = "startTime is required.")
        LocalTime startTime,
        @NotNull(message = "endTime is required.")
        LocalTime endTime
) {
}
