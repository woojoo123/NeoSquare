package com.neosquare.mentor;

import java.time.Instant;

public record MentorApplicationResponse(
        Long id,
        Long userId,
        String nickname,
        String email,
        String bio,
        String specialties,
        String interests,
        String reason,
        MentorApplicationStatus status,
        String reviewNote,
        Instant createdAt,
        Instant updatedAt,
        Instant reviewedAt
) {

    public static MentorApplicationResponse from(MentorApplication mentorApplication) {
        return new MentorApplicationResponse(
                mentorApplication.getId(),
                mentorApplication.getUser().getId(),
                mentorApplication.getUser().getNickname(),
                mentorApplication.getUser().getEmail(),
                mentorApplication.getBio(),
                mentorApplication.getSpecialties(),
                mentorApplication.getInterests(),
                mentorApplication.getReason(),
                mentorApplication.getStatus(),
                mentorApplication.getReviewNote(),
                mentorApplication.getCreatedAt(),
                mentorApplication.getUpdatedAt(),
                mentorApplication.getReviewedAt()
        );
    }
}
