package com.neosquare.notification;

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

@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipient_id", nullable = false)
    private User recipient;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private NotificationType type;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 500)
    private String message;

    @Column
    private Long relatedId;

    @Column(name = "is_read", nullable = false)
    private boolean read;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected Notification() {
    }

    private Notification(
            User recipient,
            NotificationType type,
            String title,
            String message,
            Long relatedId
    ) {
        this.recipient = Objects.requireNonNull(recipient);
        this.type = Objects.requireNonNull(type);
        this.title = Objects.requireNonNull(title);
        this.message = Objects.requireNonNull(message);
        this.relatedId = relatedId;
        this.read = false;
    }

    public static Notification create(
            User recipient,
            NotificationType type,
            String title,
            String message,
            Long relatedId
    ) {
        return new Notification(recipient, type, title, message, relatedId);
    }

    public void markAsRead() {
        if (read) {
            throw new InvalidNotificationStateException("This notification has already been marked as read.");
        }

        read = true;
    }

    public boolean isRecipient(Long userId) {
        return Objects.equals(recipient.getId(), userId);
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public User getRecipient() {
        return recipient;
    }

    public NotificationType getType() {
        return type;
    }

    public String getTitle() {
        return title;
    }

    public String getMessage() {
        return message;
    }

    public Long getRelatedId() {
        return relatedId;
    }

    public boolean isRead() {
        return read;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
