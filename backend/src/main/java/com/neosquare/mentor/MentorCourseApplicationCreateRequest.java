package com.neosquare.mentor;

import jakarta.validation.constraints.Size;

public record MentorCourseApplicationCreateRequest(
        Long preferredScheduleItemId,
        @Size(max = 500, message = "message must be at most 500 characters.")
        String message
) {
}
