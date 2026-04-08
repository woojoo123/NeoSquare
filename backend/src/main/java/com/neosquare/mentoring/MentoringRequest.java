package com.neosquare.mentoring;

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
@Table(name = "mentoring_requests")
public class MentoringRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requester_id", nullable = false)
    private User requester;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mentor_id", nullable = false)
    private User mentor;

    @Column(nullable = false, length = 500)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MentoringRequestStatus status;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @Column
    private Instant completedAt;

    protected MentoringRequest() {
    }

    private MentoringRequest(User requester, User mentor, String message) {
        this.requester = Objects.requireNonNull(requester);
        this.mentor = Objects.requireNonNull(mentor);
        this.message = Objects.requireNonNull(message);
        this.status = MentoringRequestStatus.PENDING;
    }

    public static MentoringRequest create(User requester, User mentor, String message) {
        return new MentoringRequest(requester, mentor, message);
    }

    public void accept() {
        ensurePending("accepted");
        this.status = MentoringRequestStatus.ACCEPTED;
    }

    public void reject() {
        ensurePending("rejected");
        this.status = MentoringRequestStatus.REJECTED;
    }

    public void complete() {
        if (status == MentoringRequestStatus.COMPLETED) {
            throw new InvalidMentoringRequestStateException("This mentoring request has already been completed.");
        }

        if (status != MentoringRequestStatus.ACCEPTED) {
            throw new InvalidMentoringRequestStateException(
                    "Only accepted mentoring requests can be completed."
            );
        }

        this.status = MentoringRequestStatus.COMPLETED;
        this.completedAt = Instant.now();
    }

    public boolean isParticipant(Long userId) {
        return Objects.equals(requester.getId(), userId) || Objects.equals(mentor.getId(), userId);
    }

    public boolean isMentor(Long userId) {
        return Objects.equals(mentor.getId(), userId);
    }

    public Long resolveCounterpartUserId(Long userId) {
        if (Objects.equals(requester.getId(), userId)) {
            return mentor.getId();
        }

        if (Objects.equals(mentor.getId(), userId)) {
            return requester.getId();
        }

        throw new IllegalStateException("Signal sender is not a participant of this mentoring request.");
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

    public User getRequester() {
        return requester;
    }

    public User getMentor() {
        return mentor;
    }

    public String getMessage() {
        return message;
    }

    public MentoringRequestStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    private void ensurePending(String action) {
        if (status != MentoringRequestStatus.PENDING) {
            throw new InvalidMentoringRequestStateException(
                    "Only pending mentoring requests can be " + action + "."
            );
        }
    }
}
