package com.neosquare.mentoring;

public class MentoringReservationNotFoundException extends RuntimeException {

    public MentoringReservationNotFoundException(Long reservationId) {
        super("Reservation not found: " + reservationId);
    }
}
