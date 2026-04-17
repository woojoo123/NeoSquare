package com.neosquare.admin;

public record AdminMentorOverviewResponse(
        Long id,
        String nickname,
        String email,
        boolean mentorEnabled,
        String specialties,
        int courseCount,
        int publishedCourseCount,
        long pendingCourseApplicationCount
) {
}
