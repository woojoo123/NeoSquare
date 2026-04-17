package com.neosquare.mentor;

import java.time.Instant;

public record MentorCourseSessionWindow(
        Instant entryOpenAt,
        Instant entryCloseAt
) {
}
