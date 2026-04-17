package com.neosquare.mentor;

import java.time.Instant;
import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "mentor_course_schedule_items")
public class MentorCourseScheduleItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private MentorCourse course;

    @Column(nullable = false)
    private int sequence;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(length = 500)
    private String description;

    @Column(nullable = false)
    private Instant startsAt;

    @Column(nullable = false)
    private Instant endsAt;

    protected MentorCourseScheduleItem() {
    }

    private MentorCourseScheduleItem(
            MentorCourse course,
            int sequence,
            String title,
            String description,
            Instant startsAt,
            Instant endsAt
    ) {
        this.course = Objects.requireNonNull(course);
        this.sequence = sequence;
        this.title = Objects.requireNonNull(title);
        this.description = description;
        this.startsAt = Objects.requireNonNull(startsAt);
        this.endsAt = Objects.requireNonNull(endsAt);
    }

    public static MentorCourseScheduleItem create(
            MentorCourse course,
            int sequence,
            String title,
            String description,
            Instant startsAt,
            Instant endsAt
    ) {
        return new MentorCourseScheduleItem(course, sequence, title, description, startsAt, endsAt);
    }

    public Long getId() {
        return id;
    }

    public MentorCourse getCourse() {
        return course;
    }

    public int getSequence() {
        return sequence;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public Instant getStartsAt() {
        return startsAt;
    }

    public Instant getEndsAt() {
        return endsAt;
    }
}
