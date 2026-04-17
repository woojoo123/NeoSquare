package com.neosquare.mentor;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

public record MentorCourseResponse(
        Long id,
        String title,
        String summary,
        String description,
        String meetingType,
        int price,
        int capacity,
        int approvedApplicationCount,
        int remainingCapacity,
        List<MentorCourseCurriculumItemResponse> curriculumItems,
        MentorCourseStatus status,
        Instant createdAt,
        Instant updatedAt
) {

    private static final Comparator<MentorCourseResponse> PUBLIC_COMPARATOR = Comparator
            .comparing(MentorCourseResponse::createdAt, Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(MentorCourseResponse::id, Comparator.nullsLast(Comparator.reverseOrder()));

    private static final Comparator<MentorCourseResponse> OWNER_COMPARATOR = Comparator
            .comparing((MentorCourseResponse course) -> course.status() == MentorCourseStatus.PUBLISHED ? 0 : 1)
            .thenComparing(MentorCourseResponse::updatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(MentorCourseResponse::id, Comparator.nullsLast(Comparator.reverseOrder()));

    public static MentorCourseResponse from(
            MentorCourse course,
            int approvedApplicationCount,
            List<MentorCourseCurriculumItemResponse> curriculumItems
    ) {
        return new MentorCourseResponse(
                course.getId(),
                course.getTitle(),
                course.getSummary(),
                course.getDescription(),
                course.getMeetingType(),
                course.getPrice(),
                course.getCapacity(),
                approvedApplicationCount,
                Math.max(course.getCapacity() - approvedApplicationCount, 0),
                curriculumItems,
                course.getStatus(),
                course.getCreatedAt(),
                course.getUpdatedAt()
        );
    }

    public static int compareForPublicList(MentorCourse left, MentorCourse right) {
        return PUBLIC_COMPARATOR.compare(from(left, 0, List.of()), from(right, 0, List.of()));
    }

    public static int compareForOwnerList(MentorCourse left, MentorCourse right) {
        return OWNER_COMPARATOR.compare(from(left, 0, List.of()), from(right, 0, List.of()));
    }
}
