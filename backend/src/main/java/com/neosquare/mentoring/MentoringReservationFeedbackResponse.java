package com.neosquare.mentoring;

import java.time.Instant;
import java.util.Objects;

public record MentoringReservationFeedbackResponse(
        Long id,
        Long reservationId,
        Long authorId,
        String authorLabel,
        String authorRole,
        Long targetUserId,
        String targetUserLabel,
        int rating,
        String summary,
        String feedback,
        String sessionSource,
        Instant reservedAt,
        Instant createdAt
) {

    public static MentoringReservationFeedbackResponse from(MentoringReservationFeedback reservationFeedback) {
        String authorRole = Objects.equals(
                reservationFeedback.getAuthor().getId(),
                reservationFeedback.getReservation().getRequester().getId()
        ) ? "Requester" : "Mentor";

        return new MentoringReservationFeedbackResponse(
                reservationFeedback.getId(),
                reservationFeedback.getReservation().getId(),
                reservationFeedback.getAuthor().getId(),
                reservationFeedback.getAuthor().getNickname(),
                authorRole,
                reservationFeedback.getTargetUser().getId(),
                reservationFeedback.getTargetUser().getNickname(),
                reservationFeedback.getRating(),
                reservationFeedback.getSummary(),
                reservationFeedback.getFeedback(),
                "reservation",
                reservationFeedback.getReservation().getReservedAt(),
                reservationFeedback.getCreatedAt()
        );
    }
}
