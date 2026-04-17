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
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "mentor_applications",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_mentor_applications_user", columnNames = "user_id")
        }
)
public class MentorApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 1000)
    private String bio;

    @Column(nullable = false, length = 500)
    private String specialties;

    @Column(nullable = false, length = 500)
    private String interests;

    @Column(nullable = false, length = 1000)
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MentorApplicationStatus status;

    @Column(length = 1000)
    private String reviewNote;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @Column
    private Instant reviewedAt;

    protected MentorApplication() {
    }

    private MentorApplication(
            User user,
            String bio,
            String specialties,
            String interests,
            String reason
    ) {
        this.user = Objects.requireNonNull(user);
        this.bio = Objects.requireNonNull(bio);
        this.specialties = Objects.requireNonNull(specialties);
        this.interests = Objects.requireNonNull(interests);
        this.reason = Objects.requireNonNull(reason);
        this.status = MentorApplicationStatus.PENDING;
    }

    public static MentorApplication create(
            User user,
            String bio,
            String specialties,
            String interests,
            String reason
    ) {
        return new MentorApplication(user, bio, specialties, interests, reason);
    }

    public void resubmit(
            String bio,
            String specialties,
            String interests,
            String reason
    ) {
        this.bio = Objects.requireNonNull(bio);
        this.specialties = Objects.requireNonNull(specialties);
        this.interests = Objects.requireNonNull(interests);
        this.reason = Objects.requireNonNull(reason);
        this.status = MentorApplicationStatus.PENDING;
        this.reviewNote = null;
        this.reviewedAt = null;
    }

    public void approve(String reviewNote) {
        ensurePending("approved");
        this.status = MentorApplicationStatus.APPROVED;
        this.reviewNote = reviewNote;
        this.reviewedAt = Instant.now();
    }

    public void reject(String reviewNote) {
        ensurePending("rejected");
        this.status = MentorApplicationStatus.REJECTED;
        this.reviewNote = reviewNote;
        this.reviewedAt = Instant.now();
    }

    private void ensurePending(String action) {
        if (status != MentorApplicationStatus.PENDING) {
            throw new InvalidMentorApplicationStateException(
                    "Only pending mentor applications can be " + action + "."
            );
        }
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

    public User getUser() {
        return user;
    }

    public String getBio() {
        return bio;
    }

    public String getSpecialties() {
        return specialties;
    }

    public String getInterests() {
        return interests;
    }

    public String getReason() {
        return reason;
    }

    public MentorApplicationStatus getStatus() {
        return status;
    }

    public String getReviewNote() {
        return reviewNote;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getReviewedAt() {
        return reviewedAt;
    }
}
