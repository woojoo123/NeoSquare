package com.neosquare.mentor;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Objects;

import com.neosquare.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "mentor_availability_slots")
public class MentorAvailabilitySlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mentor_id", nullable = false)
    private User mentor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DayOfWeek dayOfWeek;

    @Column(nullable = false)
    private LocalTime startTime;

    @Column(nullable = false)
    private LocalTime endTime;

    protected MentorAvailabilitySlot() {
    }

    private MentorAvailabilitySlot(User mentor, DayOfWeek dayOfWeek, LocalTime startTime, LocalTime endTime) {
        this.mentor = Objects.requireNonNull(mentor);
        this.dayOfWeek = Objects.requireNonNull(dayOfWeek);
        this.startTime = Objects.requireNonNull(startTime);
        this.endTime = Objects.requireNonNull(endTime);

        if (!startTime.isBefore(endTime)) {
            throw new InvalidMentorAvailabilityException("Availability start time must be before end time.");
        }
    }

    public static MentorAvailabilitySlot create(
            User mentor,
            DayOfWeek dayOfWeek,
            LocalTime startTime,
            LocalTime endTime
    ) {
        return new MentorAvailabilitySlot(mentor, dayOfWeek, startTime, endTime);
    }

    public boolean overlaps(MentorAvailabilitySlot other) {
        if (dayOfWeek != other.dayOfWeek) {
            return false;
        }

        return startTime.isBefore(other.endTime) && other.startTime.isBefore(endTime);
    }

    public boolean matches(DayOfWeek requestedDayOfWeek, LocalTime requestedTime) {
        return dayOfWeek == requestedDayOfWeek
                && !requestedTime.isBefore(startTime)
                && requestedTime.isBefore(endTime);
    }

    public Long getId() {
        return id;
    }

    public User getMentor() {
        return mentor;
    }

    public DayOfWeek getDayOfWeek() {
        return dayOfWeek;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }
}
