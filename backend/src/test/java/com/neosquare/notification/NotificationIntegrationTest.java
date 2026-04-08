package com.neosquare.notification;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import com.neosquare.auth.JwtTokenProvider;
import com.neosquare.mentoring.MentoringRequest;
import com.neosquare.mentoring.MentoringRequestRepository;
import com.neosquare.mentoring.MentoringReservation;
import com.neosquare.mentoring.MentoringReservationRepository;
import com.neosquare.user.User;
import com.neosquare.user.UserRepository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import jakarta.transaction.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class NotificationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private MentoringRequestRepository mentoringRequestRepository;

    @Autowired
    private MentoringReservationRepository mentoringReservationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void acceptingRequestCreatesNotificationForRequester() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringRequest mentoringRequest = saveRequest(requester, mentor, "Please accept");

        mockMvc.perform(patch("/api/mentoring/requests/{requestId}/accept", mentoringRequest.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/notifications/me")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("My notifications retrieved."))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].type").value(NotificationType.REQUEST_ACCEPTED.name()))
                .andExpect(jsonPath("$.data[0].title").value("Mentoring request accepted"))
                .andExpect(jsonPath("$.data[0].relatedId").value(mentoringRequest.getId()))
                .andExpect(jsonPath("$.data[0].isRead").value(false));
    }

    @Test
    void acceptingReservationCreatesNotificationForRequester() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringReservation reservation = saveReservation(
                requester,
                mentor,
                Instant.now().plusSeconds(3600),
                "Please accept"
        );

        mockMvc.perform(patch("/api/mentoring/reservations/{reservationId}/accept", reservation.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/notifications/me")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].type").value(NotificationType.RESERVATION_ACCEPTED.name()))
                .andExpect(jsonPath("$.data[0].title").value("Reservation accepted"))
                .andExpect(jsonPath("$.data[0].relatedId").value(reservation.getId()))
                .andExpect(jsonPath("$.data[0].isRead").value(false));
    }

    @Test
    void getMyNotificationsReturnsCurrentUsersNotifications() throws Exception {
        User recipient = saveUser("recipient@neo.square", "Recipient");
        User otherUser = saveUser("other@neo.square", "Other");

        saveNotification(
                recipient,
                NotificationType.REQUEST_ACCEPTED,
                "First",
                "First notification",
                1L
        );
        Notification unreadLatest = saveNotification(
                recipient,
                NotificationType.RESERVATION_ACCEPTED,
                "Second",
                "Second notification",
                2L
        );
        saveNotification(
                otherUser,
                NotificationType.REQUEST_ACCEPTED,
                "Other",
                "Other notification",
                3L
        );

        mockMvc.perform(get("/api/notifications/me")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(recipient)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].id").value(unreadLatest.getId()))
                .andExpect(jsonPath("$.data[0].type").value(NotificationType.RESERVATION_ACCEPTED.name()));
    }

    @Test
    void ownerCanReadOwnNotification() throws Exception {
        User recipient = saveUser("recipient@neo.square", "Recipient");
        Notification notification = saveNotification(
                recipient,
                NotificationType.REQUEST_ACCEPTED,
                "Read me",
                "Please read this notification",
                10L
        );

        mockMvc.perform(patch("/api/notifications/{notificationId}/read", notification.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(recipient)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Notification marked as read."))
                .andExpect(jsonPath("$.data.id").value(notification.getId()))
                .andExpect(jsonPath("$.data.isRead").value(true));
    }

    @Test
    void otherUserCannotReadNotification() throws Exception {
        User recipient = saveUser("recipient@neo.square", "Recipient");
        User outsider = saveUser("outsider@neo.square", "Outsider");
        Notification notification = saveNotification(
                recipient,
                NotificationType.REQUEST_ACCEPTED,
                "Read me",
                "Please read this notification",
                10L
        );

        mockMvc.perform(patch("/api/notifications/{notificationId}/read", notification.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(outsider)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("You do not have access to this notification."))
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    void readAllMarksUnreadNotificationsAsRead() throws Exception {
        User recipient = saveUser("recipient@neo.square", "Recipient");
        Notification firstNotification = saveNotification(
                recipient,
                NotificationType.REQUEST_ACCEPTED,
                "First",
                "First unread notification",
                1L
        );
        Notification secondNotification = saveNotification(
                recipient,
                NotificationType.RESERVATION_ACCEPTED,
                "Second",
                "Second unread notification",
                2L
        );

        mockMvc.perform(patch("/api/notifications/read-all")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(recipient)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("All notifications marked as read."))
                .andExpect(jsonPath("$.data.length()").value(2));

        mockMvc.perform(get("/api/notifications/me")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(recipient)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(secondNotification.getId()))
                .andExpect(jsonPath("$.data[0].isRead").value(true))
                .andExpect(jsonPath("$.data[1].id").value(firstNotification.getId()))
                .andExpect(jsonPath("$.data[1].isRead").value(true));
    }

    @Test
    void readingAlreadyReadNotificationReturnsConflict() throws Exception {
        User recipient = saveUser("recipient@neo.square", "Recipient");
        Notification notification = saveNotification(
                recipient,
                NotificationType.REQUEST_ACCEPTED,
                "Already read",
                "Already read notification",
                33L
        );
        notification.markAsRead();

        mockMvc.perform(patch("/api/notifications/{notificationId}/read", notification.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(recipient)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("This notification has already been marked as read."))
                .andExpect(jsonPath("$.status").value(409));
    }

    private User saveUser(String email, String nickname) {
        return userRepository.save(User.create(
                email,
                passwordEncoder.encode("password123"),
                nickname
        ));
    }

    private MentoringRequest saveRequest(User requester, User mentor, String message) {
        return mentoringRequestRepository.save(MentoringRequest.create(requester, mentor, message));
    }

    private MentoringReservation saveReservation(User requester, User mentor, Instant reservedAt, String message) {
        return mentoringReservationRepository.save(
                MentoringReservation.create(requester, mentor, reservedAt, message)
        );
    }

    private Notification saveNotification(
            User recipient,
            NotificationType type,
            String title,
            String message,
            Long relatedId
    ) {
        return notificationRepository.save(Notification.create(recipient, type, title, message, relatedId));
    }

    private String bearerToken(User user) {
        return "Bearer " + jwtTokenProvider.generateAccessToken(user);
    }
}
