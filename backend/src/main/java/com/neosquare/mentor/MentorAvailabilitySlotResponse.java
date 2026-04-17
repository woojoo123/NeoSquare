package com.neosquare.mentor;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Comparator;

public record MentorAvailabilitySlotResponse(
        Long id,
        DayOfWeek dayOfWeek,
        LocalTime startTime,
        LocalTime endTime
) {

    private static final Comparator<MentorAvailabilitySlotResponse> COMPARATOR = Comparator
            .comparingInt((MentorAvailabilitySlotResponse slot) -> slot.dayOfWeek().getValue())
            .thenComparing(MentorAvailabilitySlotResponse::startTime)
            .thenComparing(MentorAvailabilitySlotResponse::endTime);

    public static MentorAvailabilitySlotResponse from(MentorAvailabilitySlot slot) {
        return new MentorAvailabilitySlotResponse(
                slot.getId(),
                slot.getDayOfWeek(),
                slot.getStartTime(),
                slot.getEndTime()
        );
    }

    public static int compare(MentorAvailabilitySlot left, MentorAvailabilitySlot right) {
        return COMPARATOR.compare(from(left), from(right));
    }

    public static int compare(MentorAvailabilitySlotResponse left, MentorAvailabilitySlotResponse right) {
        return COMPARATOR.compare(left, right);
    }
}
