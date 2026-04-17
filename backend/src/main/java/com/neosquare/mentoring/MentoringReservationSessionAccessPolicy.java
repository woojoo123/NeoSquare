package com.neosquare.mentoring;

import java.time.Duration;
import java.time.Instant;

import org.springframework.stereotype.Component;

@Component
public class MentoringReservationSessionAccessPolicy {

    private static final Duration ENTRY_OPEN_OFFSET = Duration.ofMinutes(10);
    private static final Duration ENTRY_CLOSE_OFFSET = Duration.ofMinutes(120);

    public MentoringReservationSessionWindow resolveSessionWindow(MentoringReservation reservation) {
        Instant reservedAt = reservation.getReservedAt();

        return new MentoringReservationSessionWindow(
                reservedAt.minus(ENTRY_OPEN_OFFSET),
                reservedAt.plus(ENTRY_CLOSE_OFFSET)
        );
    }

    public void validateSessionEntry(MentoringReservation reservation) {
        if (reservation.getStatus() != MentoringReservationStatus.ACCEPTED) {
            throw new InvalidMentoringReservationSessionEntryException(
                    "Only accepted reservations can enter this session."
            );
        }

        MentoringReservationSessionWindow sessionWindow = resolveSessionWindow(reservation);
        Instant now = Instant.now();

        if (now.isBefore(sessionWindow.entryOpenAt())) {
            throw new InvalidMentoringReservationSessionEntryException(
                    "Reservation session entry is not open yet."
            );
        }

        if (now.isAfter(sessionWindow.entryCloseAt())) {
            throw new InvalidMentoringReservationSessionEntryException(
                    "Reservation session entry window has expired."
            );
        }
    }
}
