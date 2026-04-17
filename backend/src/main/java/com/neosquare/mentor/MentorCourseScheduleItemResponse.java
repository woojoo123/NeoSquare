package com.neosquare.mentor;

import java.time.Instant;
import java.util.List;

public record MentorCourseScheduleItemResponse(
        Long id,
        int sequence,
        String title,
        String description,
        Instant startsAt,
        Instant endsAt,
        int approvedApplicationCount,
        List<String> approvedApplicantNicknames
) {

    public static MentorCourseScheduleItemResponse from(
            MentorCourseScheduleItem item,
            int approvedApplicationCount,
            List<String> approvedApplicantNicknames
    ) {
        return new MentorCourseScheduleItemResponse(
                item.getId(),
                item.getSequence(),
                item.getTitle(),
                item.getDescription(),
                item.getStartsAt(),
                item.getEndsAt(),
                approvedApplicationCount,
                approvedApplicantNicknames
        );
    }
}
