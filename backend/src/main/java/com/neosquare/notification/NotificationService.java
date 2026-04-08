package com.neosquare.notification;

import java.util.List;

import com.neosquare.auth.AuthUserPrincipal;
import com.neosquare.mentoring.MentoringRequest;
import com.neosquare.mentoring.MentoringReservation;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public void createRequestAcceptedNotification(MentoringRequest mentoringRequest) {
        Notification notification = Notification.create(
                mentoringRequest.getRequester(),
                NotificationType.REQUEST_ACCEPTED,
                "Mentoring request accepted",
                mentoringRequest.getMentor().getNickname() + " accepted your mentoring request.",
                mentoringRequest.getId()
        );

        notificationRepository.save(notification);
    }

    @Transactional
    public void createReservationAcceptedNotification(MentoringReservation reservation) {
        Notification notification = Notification.create(
                reservation.getRequester(),
                NotificationType.RESERVATION_ACCEPTED,
                "Reservation accepted",
                reservation.getMentor().getNickname() + " accepted your reservation.",
                reservation.getId()
        );

        notificationRepository.save(notification);
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> getMyNotifications(AuthUserPrincipal authUser) {
        Long currentUserId = extractCurrentUserId(authUser);

        return notificationRepository.findAllByRecipient_IdOrderByReadAscCreatedAtDescIdDesc(currentUserId).stream()
                .map(NotificationResponse::from)
                .toList();
    }

    @Transactional
    public NotificationResponse readNotification(AuthUserPrincipal authUser, Long notificationId) {
        Long currentUserId = extractCurrentUserId(authUser);
        Notification notification = getNotificationOrThrow(notificationId);

        if (!notification.isRecipient(currentUserId)) {
            throw new NotificationAccessDeniedException("You do not have access to this notification.");
        }

        notification.markAsRead();

        return NotificationResponse.from(notification);
    }

    @Transactional
    public List<NotificationResponse> readAllNotifications(AuthUserPrincipal authUser) {
        Long currentUserId = extractCurrentUserId(authUser);
        List<Notification> unreadNotifications = notificationRepository
                .findAllByRecipient_IdAndReadFalseOrderByCreatedAtDescIdDesc(currentUserId);

        unreadNotifications.forEach(Notification::markAsRead);

        return unreadNotifications.stream()
                .map(NotificationResponse::from)
                .toList();
    }

    private Long extractCurrentUserId(AuthUserPrincipal authUser) {
        if (authUser == null || authUser.id() == null) {
            throw new NotificationAccessDeniedException("Authentication is required.");
        }

        return authUser.id();
    }

    private Notification getNotificationOrThrow(Long notificationId) {
        return notificationRepository.findDetailById(notificationId)
                .orElseThrow(() -> new NotificationNotFoundException(notificationId));
    }
}
