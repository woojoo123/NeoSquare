package com.neosquare.mentoring;

public class MentoringReservationFeedbackNotFoundException extends RuntimeException {

    public MentoringReservationFeedbackNotFoundException(Long feedbackId) {
        super("Reservation feedback not found: " + feedbackId);
    }

    public MentoringReservationFeedbackNotFoundException(String message) {
        super(message);
    }
}
