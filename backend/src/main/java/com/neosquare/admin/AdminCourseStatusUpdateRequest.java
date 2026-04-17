package com.neosquare.admin;

import com.neosquare.mentor.MentorCourseStatus;

import jakarta.validation.constraints.NotNull;

public record AdminCourseStatusUpdateRequest(
        @NotNull(message = "status is required.")
        MentorCourseStatus status
) {
}
