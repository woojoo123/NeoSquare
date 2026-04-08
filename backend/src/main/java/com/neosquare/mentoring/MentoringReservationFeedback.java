package com.neosquare.mentoring;

import java.time.Instant;
import java.util.Objects;

import com.neosquare.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
        name = "mentoring_reservation_feedbacks",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_mentoring_reservation_feedbacks_reservation_author",
                        columnNames = {"reservation_id", "author_id"}
                )
        }
)
public class MentoringReservationFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reservation_id", nullable = false)
    private MentoringReservation reservation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "target_user_id", nullable = false)
    private User targetUser;

    @Column(nullable = false)
    private int rating;

    @Column(nullable = false, length = 255)
    private String summary;

    @Column(nullable = false, length = 2000)
    private String feedback;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected MentoringReservationFeedback() {
    }

    private MentoringReservationFeedback(
            MentoringReservation reservation,
            User author,
            User targetUser,
            int rating,
            String summary,
            String feedback
    ) {
        this.reservation = Objects.requireNonNull(reservation);
        this.author = Objects.requireNonNull(author);
        this.targetUser = Objects.requireNonNull(targetUser);
        this.rating = rating;
        this.summary = Objects.requireNonNull(summary);
        this.feedback = Objects.requireNonNull(feedback);
    }

    public static MentoringReservationFeedback create(
            MentoringReservation reservation,
            User author,
            User targetUser,
            int rating,
            String summary,
            String feedback
    ) {
        return new MentoringReservationFeedback(reservation, author, targetUser, rating, summary, feedback);
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

    public MentoringReservation getReservation() {
        return reservation;
    }

    public User getAuthor() {
        return author;
    }

    public User getTargetUser() {
        return targetUser;
    }

    public int getRating() {
        return rating;
    }

    public String getSummary() {
        return summary;
    }

    public String getFeedback() {
        return feedback;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
