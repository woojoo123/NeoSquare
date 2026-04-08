package com.neosquare.study;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import com.neosquare.space.Space;
import com.neosquare.user.User;

import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "study_sessions")
public class StudySession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "host_id", nullable = false)
    private User host;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "space_id", nullable = false)
    private Space space;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StudySessionStatus status;

    @OneToMany(mappedBy = "studySession", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("joinedAt ASC, id ASC")
    private List<StudySessionParticipant> participants = new ArrayList<>();

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @Column
    private Instant completedAt;

    protected StudySession() {
    }

    private StudySession(
            User host,
            Space space,
            String title,
            String description
    ) {
        this.host = Objects.requireNonNull(host);
        this.space = Objects.requireNonNull(space);
        this.title = Objects.requireNonNull(title);
        this.description = Objects.requireNonNull(description);
        this.status = StudySessionStatus.ACTIVE;
        addParticipant(host, StudySessionParticipantRole.HOST);
    }

    public static StudySession create(
            User host,
            Space space,
            String title,
            String description
    ) {
        return new StudySession(host, space, title, description);
    }

    public void join(User user) {
        ensureActive("joined");

        if (isParticipant(user.getId())) {
            throw new InvalidStudySessionStateException("You have already joined this study session.");
        }

        addParticipant(user, StudySessionParticipantRole.MEMBER);
    }

    public void complete() {
        if (status == StudySessionStatus.COMPLETED) {
            throw new InvalidStudySessionStateException("This study session has already been completed.");
        }

        if (status != StudySessionStatus.ACTIVE) {
            throw new InvalidStudySessionStateException("Only active study sessions can be completed.");
        }

        this.status = StudySessionStatus.COMPLETED;
        this.completedAt = Instant.now();
    }

    public boolean isParticipant(Long userId) {
        return participants.stream()
                .map(StudySessionParticipant::getUser)
                .map(User::getId)
                .anyMatch(participantUserId -> Objects.equals(participantUserId, userId));
    }

    public boolean isHost(Long userId) {
        return Objects.equals(host.getId(), userId);
    }

    public int getParticipantCount() {
        return participants.size();
    }

    private void addParticipant(User user, StudySessionParticipantRole role) {
        participants.add(StudySessionParticipant.create(this, user, role));
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

    private void ensureActive(String action) {
        if (status != StudySessionStatus.ACTIVE) {
            throw new InvalidStudySessionStateException(
                    "Only active study sessions can be " + action + "."
            );
        }
    }

    public Long getId() {
        return id;
    }

    public User getHost() {
        return host;
    }

    public Space getSpace() {
        return space;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public StudySessionStatus getStatus() {
        return status;
    }

    public List<StudySessionParticipant> getParticipants() {
        return participants;
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
}
