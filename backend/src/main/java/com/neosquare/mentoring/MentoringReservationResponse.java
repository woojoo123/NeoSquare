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
        String message,
        MentoringReservationStatus status,
        Instant createdAt
) {

    public static MentoringReservationResponse from(MentoringReservation reservation) {
        return new MentoringReservationResponse(
                reservation.getId(),
                reservation.getRequester().getId(),
                reservation.getRequester().getNickname(),
                reservation.getRequester().getNickname(),
                reservation.getMentor().getId(),
                reservation.getMentor().getNickname(),
                reservation.getMentor().getNickname(),
                reservation.getReservedAt(),
                reservation.getMessage(),
                reservation.getStatus(),
                reservation.getCreatedAt()
        );
    }
}
