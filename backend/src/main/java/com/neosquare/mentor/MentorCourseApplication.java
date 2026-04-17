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
        name = "mentor_course_applications",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_mentor_course_applications_course_applicant",
                        columnNames = {"course_id", "applicant_id"}
                )
        }
)
public class MentorCourseApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private MentorCourse course;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "applicant_id", nullable = false)
    private User applicant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "preferred_schedule_item_id")
    private MentorCourseScheduleItem preferredScheduleItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_schedule_item_id")
    private MentorCourseScheduleItem assignedScheduleItem;

    @Column(nullable = false, length = 500)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MentorCourseApplicationStatus status;

    @Column(length = 500)
    private String reviewNote;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @Column
    private Instant reviewedAt;

    protected MentorCourseApplication() {
    }

    private MentorCourseApplication(
            MentorCourse course,
            User applicant,
            MentorCourseScheduleItem preferredScheduleItem,
            String message
    ) {
        this.course = Objects.requireNonNull(course);
        this.applicant = Objects.requireNonNull(applicant);
        this.preferredScheduleItem = preferredScheduleItem;
        this.message = Objects.requireNonNull(message);
        this.status = MentorCourseApplicationStatus.PENDING;
    }

    public static MentorCourseApplication create(
            MentorCourse course,
            User applicant,
            MentorCourseScheduleItem preferredScheduleItem,
            String message
    ) {
        return new MentorCourseApplication(course, applicant, preferredScheduleItem, message);
    }

    public void resubmit(MentorCourseScheduleItem preferredScheduleItem, String message) {
        if (status == MentorCourseApplicationStatus.PENDING) {
            throw new InvalidMentorCourseApplicationStateException(
                    "Your course application is already pending review."
            );
        }

        if (status == MentorCourseApplicationStatus.APPROVED) {
            throw new InvalidMentorCourseApplicationStateException(
                    "Your course application has already been approved."
            );
        }

        this.preferredScheduleItem = preferredScheduleItem;
        this.assignedScheduleItem = null;
        this.message = Objects.requireNonNull(message);
        this.status = MentorCourseApplicationStatus.PENDING;
        this.reviewNote = null;
        this.reviewedAt = null;
    }

    public void approve(MentorCourseScheduleItem assignedScheduleItem, String reviewNote) {
        ensurePending("approved");
        this.assignedScheduleItem = assignedScheduleItem;
        this.status = MentorCourseApplicationStatus.APPROVED;
        this.reviewNote = reviewNote;
        this.reviewedAt = Instant.now();
    }

    public void reject(String reviewNote) {
        ensurePending("rejected");
        this.status = MentorCourseApplicationStatus.REJECTED;
        this.reviewNote = reviewNote;
        this.reviewedAt = Instant.now();
    }

    public void cancel() {
        ensurePending("canceled");
        this.status = MentorCourseApplicationStatus.CANCELED;
        this.reviewedAt = Instant.now();
    }

    public boolean isApplicant(Long userId) {
        return Objects.equals(applicant.getId(), userId);
    }

    public boolean isMentor(Long userId) {
        return Objects.equals(course.getMentor().getId(), userId);
    }

    public boolean isParticipant(Long userId) {
        return isApplicant(userId) || isMentor(userId);
    }

    public Long resolveCounterpartUserId(Long userId) {
        if (isApplicant(userId)) {
            return course.getMentor().getId();
        }

        if (isMentor(userId)) {
            return applicant.getId();
        }

        throw new MentorCourseApplicationAccessDeniedException(
                "Only course session participants can resolve a counterpart."
        );
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    private void ensurePending(String action) {
        if (status != MentorCourseApplicationStatus.PENDING) {
            throw new InvalidMentorCourseApplicationStateException(
                    "Only pending course applications can be " + action + "."
            );
        }
    }

    public Long getId() {
        return id;
    }

    public MentorCourse getCourse() {
        return course;
    }

    public User getApplicant() {
        return applicant;
    }

    public MentorCourseScheduleItem getPreferredScheduleItem() {
        return preferredScheduleItem;
    }

    public MentorCourseScheduleItem getAssignedScheduleItem() {
        return assignedScheduleItem;
    }

    public String getMessage() {
        return message;
    }

    public MentorCourseApplicationStatus getStatus() {
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
