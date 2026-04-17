package com.neosquare.mentor;

import java.time.Instant;
import java.util.List;

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
        Long preferredScheduleItemId,
        String preferredScheduleTitle,
        Instant preferredScheduleStartsAt,
        Instant preferredScheduleEndsAt,
        Long assignedScheduleItemId,
        String assignedScheduleTitle,
        Instant assignedScheduleStartsAt,
        Instant assignedScheduleEndsAt,
        Instant sessionEntryOpenAt,
        Instant sessionEntryCloseAt,
        List<MentorCourseScheduleItemResponse> courseScheduleItems,
        String message,
        MentorCourseApplicationStatus status,
        String reviewNote,
        Instant createdAt,
        Instant reviewedAt
) {

    public static MentorCourseApplicationResponse from(
            MentorCourseApplication application,
            MentorCourseSessionWindow sessionWindow
    ) {
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
                application.getPreferredScheduleItem() != null ? application.getPreferredScheduleItem().getId() : null,
                application.getPreferredScheduleItem() != null ? application.getPreferredScheduleItem().getTitle() : null,
                application.getPreferredScheduleItem() != null
                        ? application.getPreferredScheduleItem().getStartsAt()
                        : null,
                application.getPreferredScheduleItem() != null
                        ? application.getPreferredScheduleItem().getEndsAt()
                        : null,
                application.getAssignedScheduleItem() != null ? application.getAssignedScheduleItem().getId() : null,
                application.getAssignedScheduleItem() != null ? application.getAssignedScheduleItem().getTitle() : null,
                application.getAssignedScheduleItem() != null
                        ? application.getAssignedScheduleItem().getStartsAt()
                        : null,
                application.getAssignedScheduleItem() != null
                        ? application.getAssignedScheduleItem().getEndsAt()
                        : null,
                sessionWindow != null ? sessionWindow.entryOpenAt() : null,
                sessionWindow != null ? sessionWindow.entryCloseAt() : null,
                List.of(),
                application.getMessage(),
                application.getStatus(),
                application.getReviewNote(),
                application.getCreatedAt(),
                application.getReviewedAt()
        );
    }

    public static MentorCourseApplicationResponse from(
            MentorCourseApplication application,
            List<MentorCourseScheduleItemResponse> courseScheduleItems,
            MentorCourseSessionWindow sessionWindow
    ) {
        MentorCourseApplicationResponse baseResponse = from(application, sessionWindow);

        return new MentorCourseApplicationResponse(
                baseResponse.id(),
                baseResponse.courseId(),
                baseResponse.courseTitle(),
                baseResponse.courseSummary(),
                baseResponse.courseMeetingType(),
                baseResponse.coursePrice(),
                baseResponse.mentorId(),
                baseResponse.mentorNickname(),
                baseResponse.applicantId(),
                baseResponse.applicantNickname(),
                baseResponse.preferredScheduleItemId(),
                baseResponse.preferredScheduleTitle(),
                baseResponse.preferredScheduleStartsAt(),
                baseResponse.preferredScheduleEndsAt(),
                baseResponse.assignedScheduleItemId(),
                baseResponse.assignedScheduleTitle(),
                baseResponse.assignedScheduleStartsAt(),
                baseResponse.assignedScheduleEndsAt(),
                baseResponse.sessionEntryOpenAt(),
                baseResponse.sessionEntryCloseAt(),
                courseScheduleItems,
                baseResponse.message(),
                baseResponse.status(),
                baseResponse.reviewNote(),
                baseResponse.createdAt(),
                baseResponse.reviewedAt()
        );
    }
}
