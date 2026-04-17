package com.neosquare.mentor;

import jakarta.validation.constraints.Size;

public record MentorCourseApplicationReviewRequest(
        Long assignedScheduleItemId,
        @Size(max = 500, message = "reviewNote must be at most 500 characters.")
        String reviewNote
) {
}
