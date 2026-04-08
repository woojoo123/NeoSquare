package com.neosquare.study;

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
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "study_session_participants",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_study_session_participants_session_user",
                        columnNames = {"study_session_id", "user_id"}
                )
        }
)
public class StudySessionParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "study_session_id", nullable = false)
    private StudySession studySession;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StudySessionParticipantRole role;

    @Column(nullable = false, updatable = false)
    private Instant joinedAt;

    protected StudySessionParticipant() {
    }

    private StudySessionParticipant(
            StudySession studySession,
            User user,
            StudySessionParticipantRole role
    ) {
        this.studySession = Objects.requireNonNull(studySession);
        this.user = Objects.requireNonNull(user);
        this.role = Objects.requireNonNull(role);
        this.joinedAt = Instant.now();
    }

    public static StudySessionParticipant create(
            StudySession studySession,
            User user,
            StudySessionParticipantRole role
    ) {
        return new StudySessionParticipant(studySession, user, role);
    }

    @PrePersist
    void onCreate() {
        if (joinedAt == null) {
            joinedAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public StudySession getStudySession() {
        return studySession;
    }

    public User getUser() {
        return user;
    }

    public StudySessionParticipantRole getRole() {
        return role;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }
}
