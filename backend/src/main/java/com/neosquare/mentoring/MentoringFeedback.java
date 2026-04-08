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
        name = "mentoring_feedbacks",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_mentoring_feedbacks_request_author",
                        columnNames = {"request_id", "author_id"}
                )
        }
)
public class MentoringFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false)
    private MentoringRequest request;

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

    protected MentoringFeedback() {
    }

    private MentoringFeedback(
            MentoringRequest request,
            User author,
            User targetUser,
            int rating,
            String summary,
            String feedback
    ) {
        this.request = Objects.requireNonNull(request);
        this.author = Objects.requireNonNull(author);
        this.targetUser = Objects.requireNonNull(targetUser);
        this.rating = rating;
        this.summary = Objects.requireNonNull(summary);
        this.feedback = Objects.requireNonNull(feedback);
    }

    public static MentoringFeedback create(
            MentoringRequest request,
            User author,
            User targetUser,
            int rating,
            String summary,
            String feedback
    ) {
        return new MentoringFeedback(request, author, targetUser, rating, summary, feedback);
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

    public MentoringRequest getRequest() {
        return request;
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
