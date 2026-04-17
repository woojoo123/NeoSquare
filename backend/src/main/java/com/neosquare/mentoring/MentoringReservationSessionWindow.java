package com.neosquare.mentoring;

import java.time.Instant;

public record MentoringReservationSessionWindow(
        Instant entryOpenAt,
        Instant entryCloseAt
) {
}
