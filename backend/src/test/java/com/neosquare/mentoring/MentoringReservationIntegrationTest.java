package com.neosquare.mentoring;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import com.neosquare.auth.JwtTokenProvider;
import com.neosquare.user.User;
import com.neosquare.user.UserRepository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import jakarta.transaction.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MentoringReservationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MentoringReservationRepository mentoringReservationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void createReservationReturnsCreatedReservation() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        Instant reservedAt = Instant.now().plusSeconds(3600);

        mockMvc.perform(post("/api/mentoring/reservations")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "mentorId": %d,
                                  "reservedAt": "%s",
                                  "message": "Could we talk later?"
                                }
                                """.formatted(mentor.getId(), reservedAt)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Reservation created."))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.requesterId").value(requester.getId()))
                .andExpect(jsonPath("$.data.requesterLabel").value("Requester"))
                .andExpect(jsonPath("$.data.mentorId").value(mentor.getId()))
                .andExpect(jsonPath("$.data.mentorLabel").value("Mentor"))
                .andExpect(jsonPath("$.data.reservedAt").value(reservedAt.toString()))
                .andExpect(jsonPath("$.data.message").value("Could we talk later?"))
                .andExpect(jsonPath("$.data.status").value(MentoringReservationStatus.PENDING.name()))
                .andExpect(jsonPath("$.data.createdAt").exists());
    }

    @Test
    void getMyReservationsReturnsCurrentUsersReservations() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User firstMentor = saveUser("mentor1@neo.square", "Mentor One");
        User secondMentor = saveUser("mentor2@neo.square", "Mentor Two");

        saveReservation(requester, secondMentor, Instant.now().plusSeconds(7200), "Later reservation");
        MentoringReservation earliestReservation = saveReservation(
                requester,
                firstMentor,
                Instant.now().plusSeconds(3600),
                "Soon reservation"
        );

        mockMvc.perform(get("/api/mentoring/reservations/me")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("My reservations retrieved."))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].id").value(earliestReservation.getId()))
                .andExpect(jsonPath("$.data[0].mentorNickname").value("Mentor One"))
                .andExpect(jsonPath("$.data[1].mentorNickname").value("Mentor Two"));
    }

    @Test
    void getReceivedReservationsReturnsCurrentUsersReservations() throws Exception {
        User mentor = saveUser("mentor@neo.square", "Mentor");
        User firstRequester = saveUser("requester1@neo.square", "Requester One");
        User secondRequester = saveUser("requester2@neo.square", "Requester Two");

        saveReservation(firstRequester, mentor, Instant.now().plusSeconds(3600), "Soon reservation");
        MentoringReservation laterReservation = saveReservation(
                secondRequester,
                mentor,
                Instant.now().plusSeconds(7200),
                "Later reservation"
        );

        mockMvc.perform(get("/api/mentoring/reservations/received")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Received reservations retrieved."))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].requesterNickname").value("Requester One"))
                .andExpect(jsonPath("$.data[1].id").value(laterReservation.getId()))
                .andExpect(jsonPath("$.data[1].requesterNickname").value("Requester Two"));
    }

    @Test
    void mentorCanAcceptPendingReservation() throws Exception {
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
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Reservation accepted."))
                .andExpect(jsonPath("$.data.status").value(MentoringReservationStatus.ACCEPTED.name()));
    }

    @Test
    void mentorCanRejectPendingReservation() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringReservation reservation = saveReservation(
                requester,
                mentor,
                Instant.now().plusSeconds(3600),
                "Please reject"
        );

        mockMvc.perform(patch("/api/mentoring/reservations/{reservationId}/reject", reservation.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Reservation rejected."))
                .andExpect(jsonPath("$.data.status").value(MentoringReservationStatus.REJECTED.name()));
    }

    @Test
    void requesterCanCancelPendingReservation() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringReservation reservation = saveReservation(
                requester,
                mentor,
                Instant.now().plusSeconds(3600),
                "Please cancel"
        );

        mockMvc.perform(patch("/api/mentoring/reservations/{reservationId}/cancel", reservation.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Reservation canceled."))
                .andExpect(jsonPath("$.data.status").value(MentoringReservationStatus.CANCELED.name()));
    }

    @Test
    void participantCanCompleteAcceptedReservation() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringReservation reservation = saveReservation(
                requester,
                mentor,
                Instant.now().plusSeconds(3600),
                "Please complete"
        );
        reservation.accept();

        mockMvc.perform(patch("/api/mentoring/reservations/{reservationId}/complete", reservation.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Reservation completed."))
                .andExpect(jsonPath("$.data.status").value(MentoringReservationStatus.COMPLETED.name()))
                .andExpect(jsonPath("$.data.completedAt").exists());
    }

    @Test
    void requesterCannotAcceptReservation() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringReservation reservation = saveReservation(
                requester,
                mentor,
                Instant.now().plusSeconds(3600),
                "Need acceptance"
        );

        mockMvc.perform(patch("/api/mentoring/reservations/{reservationId}/accept", reservation.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Only the mentor can accept this reservation."))
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void outsiderCannotCompleteReservation() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        User outsider = saveUser("outsider@neo.square", "Outsider");
        MentoringReservation reservation = saveReservation(
                requester,
                mentor,
                Instant.now().plusSeconds(3600),
                "Need completion"
        );
        reservation.accept();

        mockMvc.perform(patch("/api/mentoring/reservations/{reservationId}/complete", reservation.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(outsider)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Only session participants can complete this reservation."))
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    void pendingReservationCannotBeCompleted() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringReservation reservation = saveReservation(
                requester,
                mentor,
                Instant.now().plusSeconds(3600),
                "Still pending"
        );

        mockMvc.perform(patch("/api/mentoring/reservations/{reservationId}/complete", reservation.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Only accepted reservations can be completed."))
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void completedReservationCannotBeCompletedTwice() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringReservation reservation = saveReservation(
                requester,
                mentor,
                Instant.now().plusSeconds(3600),
                "Already completed"
        );
        reservation.accept();
        reservation.complete();

        mockMvc.perform(patch("/api/mentoring/reservations/{reservationId}/complete", reservation.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("This reservation has already been completed."))
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void completeMissingReservationReturnsNotFound() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");

        mockMvc.perform(patch("/api/mentoring/reservations/{reservationId}/complete", 9999L)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Reservation not found: 9999"))
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void createReservationToSelfReturnsBadRequest() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        Instant reservedAt = Instant.now().plusSeconds(3600);

        mockMvc.perform(post("/api/mentoring/reservations")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "mentorId": %d,
                                  "reservedAt": "%s",
                                  "message": "Self reservation"
                                }
                                """.formatted(requester.getId(), reservedAt)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("You cannot create a reservation for yourself."))
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void createReservationInPastReturnsBadRequest() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        Instant reservedAt = Instant.now().minusSeconds(3600);

        mockMvc.perform(post("/api/mentoring/reservations")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "mentorId": %d,
                                  "reservedAt": "%s",
                                  "message": "Past reservation"
                                }
                                """.formatted(mentor.getId(), reservedAt)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Reservation time must be in the future."))
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void getMissingReservationReturnsNotFound() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");

        mockMvc.perform(get("/api/mentoring/reservations/{reservationId}", 9999L)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Reservation not found: 9999"))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    private User saveUser(String email, String nickname) {
        return userRepository.save(User.create(
                email,
                passwordEncoder.encode("password123"),
                nickname
        ));
    }

    private MentoringReservation saveReservation(User requester, User mentor, Instant reservedAt, String message) {
        return mentoringReservationRepository.save(
                MentoringReservation.create(requester, mentor, reservedAt, message)
        );
    }

    private String bearerToken(User user) {
        return "Bearer " + jwtTokenProvider.generateAccessToken(user);
    }
}
