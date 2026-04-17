package com.neosquare.admin;

import com.neosquare.mentor.MentorCourseStatus;

public record AdminCourseOverviewResponse(
        Long id,
        String title,
        Long mentorId,
        String mentorNickname,
        MentorCourseStatus status,
        int price,
        int capacity,
        int approvedApplicationCount,
        int remainingCapacity,
        long pendingApplicationCount
) {
}
