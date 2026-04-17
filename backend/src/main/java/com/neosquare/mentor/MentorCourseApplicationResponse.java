package com.neosquare.mentor;

import java.time.Instant;

public record MentorCourseApplicationResponse(
        Long id,
        Long courseId,
        String courseTitle,
        String courseSummary,
        String courseMeetingType,
        int coursePrice,
        Long mentorId,
        String mentorNickname,
        Long applicantId,
        String applicantNickname,
        String message,
        MentorCourseApplicationStatus status,
        String reviewNote,
        Instant createdAt,
        Instant reviewedAt
) {

    public static MentorCourseApplicationResponse from(MentorCourseApplication application) {
        return new MentorCourseApplicationResponse(
                application.getId(),
                application.getCourse().getId(),
                application.getCourse().getTitle(),
                application.getCourse().getSummary(),
                application.getCourse().getMeetingType(),
                application.getCourse().getPrice(),
                application.getCourse().getMentor().getId(),
                application.getCourse().getMentor().getNickname(),
                application.getApplicant().getId(),
                application.getApplicant().getNickname(),
                application.getMessage(),
                application.getStatus(),
                application.getReviewNote(),
                application.getCreatedAt(),
                application.getReviewedAt()
        );
    }
}
