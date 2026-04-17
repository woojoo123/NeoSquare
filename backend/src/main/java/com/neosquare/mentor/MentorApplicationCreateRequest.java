package com.neosquare.mentor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MentorApplicationCreateRequest(
        @NotBlank(message = "bio is required.")
        @Size(max = 1000, message = "bio must be at most 1000 characters.")
        String bio,
        @NotBlank(message = "specialties is required.")
        @Size(max = 500, message = "specialties must be at most 500 characters.")
        String specialties,
        @NotBlank(message = "interests is required.")
        @Size(max = 500, message = "interests must be at most 500 characters.")
        String interests,
        @NotBlank(message = "reason is required.")
        @Size(max = 1000, message = "reason must be at most 1000 characters.")
        String reason
) {
}
