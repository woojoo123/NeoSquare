package com.neosquare.admin;

import java.util.List;

import com.neosquare.mentor.MentorApplicationResponse;
import com.neosquare.mentor.MentorCourseApplicationResponse;

public record AdminDashboardResponse(
        int mentorCount,
        int visibleMentorCount,
        int publishedCourseCount,
        long pendingMentorApplicationCount,
        long pendingCourseApplicationCount,
        List<MentorApplicationResponse> pendingMentorApplications,
        List<MentorCourseApplicationResponse> pendingCourseApplications,
        List<AdminMentorOverviewResponse> mentors,
        List<AdminCourseOverviewResponse> courses
) {
}
