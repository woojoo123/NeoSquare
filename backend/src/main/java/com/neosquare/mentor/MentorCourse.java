package com.neosquare.mentor;

import java.time.Instant;
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
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "mentor_courses")
public class MentorCourse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mentor_id", nullable = false)
    private User mentor;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 240)
    private String summary;

    @Column(nullable = false, length = 2000)
    private String description;

    @Column(nullable = false, length = 40)
    private String meetingType;

    @Column(nullable = false)
    private int price;

    @Column(nullable = false)
    private int capacity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MentorCourseStatus status;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected MentorCourse() {
    }

    private MentorCourse(
            User mentor,
            String title,
            String summary,
            String description,
            String meetingType,
            int price,
            int capacity,
            MentorCourseStatus status
    ) {
        this.mentor = Objects.requireNonNull(mentor);
        this.title = Objects.requireNonNull(title);
        this.summary = Objects.requireNonNull(summary);
        this.description = Objects.requireNonNull(description);
        this.meetingType = Objects.requireNonNull(meetingType);
        this.price = price;
        this.capacity = capacity;
        this.status = Objects.requireNonNull(status);
    }

    public static MentorCourse create(
            User mentor,
            String title,
            String summary,
            String description,
            String meetingType,
            int price,
            int capacity,
            MentorCourseStatus status
    ) {
        return new MentorCourse(mentor, title, summary, description, meetingType, price, capacity, status);
    }

    public void update(
            String title,
            String summary,
            String description,
            String meetingType,
            int price,
            int capacity,
            MentorCourseStatus status
    ) {
        this.title = Objects.requireNonNull(title);
        this.summary = Objects.requireNonNull(summary);
        this.description = Objects.requireNonNull(description);
        this.meetingType = Objects.requireNonNull(meetingType);
        this.price = price;
        this.capacity = capacity;
        this.status = Objects.requireNonNull(status);
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public User getMentor() {
        return mentor;
    }

    public String getTitle() {
        return title;
    }

    public String getSummary() {
        return summary;
    }

    public String getDescription() {
        return description;
    }

    public String getMeetingType() {
        return meetingType;
    }

    public int getPrice() {
        return price;
    }

    public int getCapacity() {
        return capacity;
    }

    public MentorCourseStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
