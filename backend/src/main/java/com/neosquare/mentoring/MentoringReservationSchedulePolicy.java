package com.neosquare.mentoring;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Component;

@Component
public class MentoringReservationSchedulePolicy {

    private static final Duration RESERVATION_SLOT_DURATION = Duration.ofHours(1);
    private static final Set<MentoringReservationStatus> CREATE_BLOCKING_STATUSES =
            EnumSet.of(MentoringReservationStatus.PENDING, MentoringReservationStatus.ACCEPTED);
    private static final Set<MentoringReservationStatus> ACCEPT_BLOCKING_STATUSES =
            EnumSet.of(MentoringReservationStatus.ACCEPTED);

    public void validateCreation(
            Instant reservedAt,
            List<MentoringReservation> requesterReservations,
            List<MentoringReservation> mentorReservations
    ) {
        if (hasOverlap(requesterReservations, reservedAt, null)) {
            throw new MentoringReservationScheduleConflictException(
                    "You already have another reservation in this time slot."
            );
        }

        if (hasOverlap(mentorReservations, reservedAt, null)) {
            throw new MentoringReservationScheduleConflictException(
                    "The mentor already has another reservation in this time slot."
            );
        }
    }

    public void validateAcceptance(
            MentoringReservation reservation,
            List<MentoringReservation> requesterReservations,
            List<MentoringReservation> mentorReservations
    ) {
        Instant reservedAt = reservation.getReservedAt();

        if (hasOverlap(requesterReservations, reservedAt, reservation.getId())) {
            throw new MentoringReservationScheduleConflictException(
                    "The requester already has another accepted reservation in this time slot."
            );
        }

        if (hasOverlap(mentorReservations, reservedAt, reservation.getId())) {
            throw new MentoringReservationScheduleConflictException(
                    "The mentor already has another accepted reservation in this time slot."
            );
        }
    }

    public Set<MentoringReservationStatus> getCreateBlockingStatuses() {
        return CREATE_BLOCKING_STATUSES;
    }

    public Set<MentoringReservationStatus> getAcceptBlockingStatuses() {
        return ACCEPT_BLOCKING_STATUSES;
    }

    private boolean hasOverlap(
            List<MentoringReservation> reservations,
            Instant reservedAt,
            Long excludedReservationId
    ) {
        Instant nextEnd = reservedAt.plus(RESERVATION_SLOT_DURATION);

        return reservations.stream().anyMatch(reservation -> {
            if (excludedReservationId != null && excludedReservationId.equals(reservation.getId())) {
                return false;
            }

            Instant currentStart = reservation.getReservedAt();
            Instant currentEnd = currentStart.plus(RESERVATION_SLOT_DURATION);
            return currentStart.isBefore(nextEnd) && reservedAt.isBefore(currentEnd);
        });
    }
}
