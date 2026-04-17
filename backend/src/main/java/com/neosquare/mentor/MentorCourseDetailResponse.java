package com.neosquare.mentor;

import java.time.Instant;
import java.util.List;

import com.neosquare.user.User;

public record MentorCourseDetailResponse(
        Long id,
        String title,
        String summary,
        String description,
        String meetingType,
        int price,
        int capacity,
        int approvedApplicationCount,
        int remainingCapacity,
        MentorCourseStatus status,
        Instant createdAt,
        Instant updatedAt,
        Long mentorId,
        String mentorNickname,
        String mentorBio,
        String mentorInterests,
        String mentorSpecialties,
        String mentorAvatarUrl,
        List<MentorCourseCurriculumItemResponse> curriculumItems,
        List<MentorCourseScheduleItemResponse> scheduleItems
) {

    public static MentorCourseDetailResponse of(
            MentorCourse course,
            User mentor,
            int approvedApplicationCount,
            List<MentorCourseCurriculumItemResponse> curriculumItems,
            List<MentorCourseScheduleItemResponse> scheduleItems
    ) {
        return new MentorCourseDetailResponse(
                course.getId(),
                course.getTitle(),
                course.getSummary(),
                course.getDescription(),
                course.getMeetingType(),
                course.getPrice(),
                course.getCapacity(),
                approvedApplicationCount,
                Math.max(course.getCapacity() - approvedApplicationCount, 0),
                course.getStatus(),
                course.getCreatedAt(),
                course.getUpdatedAt(),
                mentor.getId(),
                mentor.getNickname(),
                mentor.getProfile().getBio(),
                mentor.getProfile().getInterests(),
                mentor.getProfile().getSpecialties(),
                mentor.getProfile().getAvatarUrl(),
                curriculumItems,
                scheduleItems
        );
    }
}
