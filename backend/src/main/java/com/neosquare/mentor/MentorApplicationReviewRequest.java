package com.neosquare.mentor;

import jakarta.validation.constraints.Size;

public record MentorApplicationReviewRequest(
        @Size(max = 1000, message = "reviewNote must be at most 1000 characters.")
        String reviewNote
) {
}
