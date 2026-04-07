package com.neosquare.mentoring;

public class SelfMentoringReservationException extends RuntimeException {

    public SelfMentoringReservationException() {
        super("You cannot create a reservation for yourself.");
    }
}
