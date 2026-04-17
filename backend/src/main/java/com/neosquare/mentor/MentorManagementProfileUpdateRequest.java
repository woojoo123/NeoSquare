package com.neosquare.mentor;

import jakarta.validation.constraints.Size;

public record MentorManagementProfileUpdateRequest(
        @Size(max = 1000, message = "bio must be at most 1000 characters.")
        String bio,
        @Size(max = 500, message = "interests must be at most 500 characters.")
        String interests,
        @Size(max = 500, message = "specialties must be at most 500 characters.")
        String specialties,
        @Size(max = 500, message = "avatarUrl must be at most 500 characters.")
        String avatarUrl,
        boolean mentorEnabled
) {
}
