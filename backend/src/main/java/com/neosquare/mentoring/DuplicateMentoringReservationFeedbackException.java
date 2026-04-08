package com.neosquare.mentoring;

public class DuplicateMentoringReservationFeedbackException extends RuntimeException {

    public DuplicateMentoringReservationFeedbackException(Long reservationId) {
        super("Feedback already exists for reservation: " + reservationId);
    }
}
