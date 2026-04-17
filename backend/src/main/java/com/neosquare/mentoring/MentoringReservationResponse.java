package com.neosquare.mentoring;

import java.time.Instant;

public record MentoringReservationResponse(
        Long id,
        Long requesterId,
        String requesterLabel,
        String requesterNickname,
        Long mentorId,
        String mentorLabel,
        String mentorNickname,
        Instant reservedAt,
        Instant sessionEntryOpenAt,
        Instant sessionEntryCloseAt,
        String message,
        MentoringReservationStatus status,
        Instant createdAt,
        Instant completedAt
) {

    public static MentoringReservationResponse from(
            MentoringReservation reservation,
            MentoringReservationSessionWindow sessionWindow
    ) {
        return new MentoringReservationResponse(
                reservation.getId(),
                reservation.getRequester().getId(),
                reservation.getRequester().getNickname(),
                reservation.getRequester().getNickname(),
                reservation.getMentor().getId(),
                reservation.getMentor().getNickname(),
                reservation.getMentor().getNickname(),
                reservation.getReservedAt(),
                sessionWindow.entryOpenAt(),
                sessionWindow.entryCloseAt(),
                reservation.getMessage(),
                reservation.getStatus(),
                reservation.getCreatedAt(),
                reservation.getCompletedAt()
        );
    }
}
