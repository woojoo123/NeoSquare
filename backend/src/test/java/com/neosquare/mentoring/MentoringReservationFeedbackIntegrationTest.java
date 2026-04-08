package com.neosquare.mentoring;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
class MentoringReservationFeedbackIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MentoringReservationFeedbackRepository mentoringReservationFeedbackRepository;

    @Autowired
    private MentoringReservationRepository mentoringReservationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void createFeedbackReturnsCreatedFeedback() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringReservation reservation = saveReservation(requester, mentor, "Need portfolio help");
        reservation.accept();
        reservation.complete();

        mockMvc.perform(post("/api/mentoring/reservation-feedbacks")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "reservationId": %d,
                                  "rating": 5,
                                  "summary": "Covered portfolio rehearsal",
                                  "feedback": "Very helpful reservation session."
                                }
                                """.formatted(reservation.getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Reservation feedback created."))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.reservationId").value(reservation.getId()))
                .andExpect(jsonPath("$.data.authorId").value(requester.getId()))
                .andExpect(jsonPath("$.data.authorRole").value("Requester"))
                .andExpect(jsonPath("$.data.targetUserId").value(mentor.getId()))
                .andExpect(jsonPath("$.data.sessionSource").value("reservation"))
                .andExpect(jsonPath("$.data.reservedAt").value(reservation.getReservedAt().toString()))
                .andExpect(jsonPath("$.data.createdAt").exists());
    }

    @Test
    void getMyFeedbacksReturnsCurrentUsersFeedbacks() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentorOne = saveUser("mentor1@neo.square", "Mentor One");
        User mentorTwo = saveUser("mentor2@neo.square", "Mentor Two");
        MentoringReservation firstReservation = saveReservation(requester, mentorOne, "First reservation");
        MentoringReservation secondReservation = saveReservation(requester, mentorTwo, "Second reservation");

        saveFeedback(firstReservation, requester, mentorOne, 4, "First summary", "First feedback");
        saveFeedback(secondReservation, requester, mentorTwo, 5, "Second summary", "Second feedback");

        mockMvc.perform(get("/api/mentoring/reservation-feedbacks/me")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("My reservation feedbacks retrieved."))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].reservationId").value(secondReservation.getId()))
                .andExpect(jsonPath("$.data[0].targetUserLabel").value("Mentor Two"))
                .andExpect(jsonPath("$.data[1].reservationId").value(firstReservation.getId()))
                .andExpect(jsonPath("$.data[1].targetUserLabel").value("Mentor One"));
    }

    @Test
    void getFeedbackByReservationReturnsAuthorsOwnFeedback() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringReservation reservation = saveReservation(requester, mentor, "Need rehearsal");
        MentoringReservationFeedback reservationFeedback = saveFeedback(
                reservation,
                requester,
                mentor,
                5,
                "Session summary",
                "Great reservation session"
        );

        mockMvc.perform(get("/api/mentoring/reservation-feedbacks/by-reservation/{reservationId}", reservation.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Reservation feedback retrieved by reservation."))
                .andExpect(jsonPath("$.data.id").value(reservationFeedback.getId()))
                .andExpect(jsonPath("$.data.reservationId").value(reservation.getId()))
                .andExpect(jsonPath("$.data.authorId").value(requester.getId()));
    }

    @Test
    void unrelatedUserCannotViewFeedback() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        User outsider = saveUser("outsider@neo.square", "Outsider");
        MentoringReservation reservation = saveReservation(requester, mentor, "Need rehearsal");
        MentoringReservationFeedback reservationFeedback = saveFeedback(
                reservation,
                requester,
                mentor,
                5,
                "Session summary",
                "Great reservation session"
        );

        mockMvc.perform(get("/api/mentoring/reservation-feedbacks/{feedbackId}", reservationFeedback.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(outsider)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("You do not have access to this reservation feedback."))
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void createFeedbackWithInvalidRatingReturnsBadRequest() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringReservation reservation = saveReservation(requester, mentor, "Need help");

        mockMvc.perform(post("/api/mentoring/reservation-feedbacks")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "reservationId": %d,
                                  "rating": 6,
                                  "summary": "Invalid rating",
                                  "feedback": "Should fail"
                                }
                                """.formatted(reservation.getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Validation failed."))
                .andExpect(jsonPath("$.errors.rating").value("rating must be between 1 and 5."));
    }

    @Test
    void duplicateFeedbackForSameReservationAndAuthorReturnsConflict() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringReservation reservation = saveReservation(requester, mentor, "Need help");
        saveFeedback(reservation, requester, mentor, 4, "Existing", "Already saved");

        mockMvc.perform(post("/api/mentoring/reservation-feedbacks")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "reservationId": %d,
                                  "rating": 5,
                                  "summary": "Duplicate",
                                  "feedback": "Should fail"
                                }
                                """.formatted(reservation.getId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message")
                        .value("Feedback already exists for reservation: " + reservation.getId()))
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void createFeedbackWithMissingReservationReturnsNotFound() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");

        mockMvc.perform(post("/api/mentoring/reservation-feedbacks")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "reservationId": 9999,
                                  "rating": 5,
                                  "summary": "Missing reservation",
                                  "feedback": "Should fail"
                                }
                                """))
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

    private MentoringReservation saveReservation(User requester, User mentor, String message) {
        return mentoringReservationRepository.save(
                MentoringReservation.create(requester, mentor, Instant.now().plusSeconds(3600), message)
        );
    }

    private MentoringReservationFeedback saveFeedback(
            MentoringReservation reservation,
            User author,
            User targetUser,
            int rating,
            String summary,
            String feedback
    ) {
        return mentoringReservationFeedbackRepository.save(
                MentoringReservationFeedback.create(reservation, author, targetUser, rating, summary, feedback)
        );
    }

    private String bearerToken(User user) {
        return "Bearer " + jwtTokenProvider.generateAccessToken(user);
    }
}
