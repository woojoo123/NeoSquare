package com.neosquare.mentoring;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
class MentoringFeedbackIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MentoringFeedbackRepository mentoringFeedbackRepository;

    @Autowired
    private MentoringRequestRepository mentoringRequestRepository;

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
        MentoringRequest mentoringRequest = saveRequest(requester, mentor, "Need Spring help");

        mockMvc.perform(post("/api/mentoring/feedbacks")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "requestId": %d,
                                  "rating": 5,
                                  "summary": "Covered Spring Boot basics",
                                  "feedback": "Very helpful session."
                                }
                                """.formatted(mentoringRequest.getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Session feedback created."))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.requestId").value(mentoringRequest.getId()))
                .andExpect(jsonPath("$.data.authorId").value(requester.getId()))
                .andExpect(jsonPath("$.data.authorLabel").value("Requester"))
                .andExpect(jsonPath("$.data.authorRole").value("Requester"))
                .andExpect(jsonPath("$.data.targetUserId").value(mentor.getId()))
                .andExpect(jsonPath("$.data.targetUserLabel").value("Mentor"))
                .andExpect(jsonPath("$.data.rating").value(5))
                .andExpect(jsonPath("$.data.summary").value("Covered Spring Boot basics"))
                .andExpect(jsonPath("$.data.feedback").value("Very helpful session."))
                .andExpect(jsonPath("$.data.sessionSource").value("request"))
                .andExpect(jsonPath("$.data.createdAt").exists());
    }

    @Test
    void getMyFeedbacksReturnsCurrentUsersFeedbacks() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentorOne = saveUser("mentor1@neo.square", "Mentor One");
        User mentorTwo = saveUser("mentor2@neo.square", "Mentor Two");
        MentoringRequest firstRequest = saveRequest(requester, mentorOne, "First request");
        MentoringRequest secondRequest = saveRequest(requester, mentorTwo, "Second request");

        saveFeedback(firstRequest, requester, mentorOne, 4, "First summary", "First feedback");
        saveFeedback(secondRequest, requester, mentorTwo, 5, "Second summary", "Second feedback");

        mockMvc.perform(get("/api/mentoring/feedbacks/me")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("My session feedbacks retrieved."))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].requestId").value(secondRequest.getId()))
                .andExpect(jsonPath("$.data[0].targetUserLabel").value("Mentor Two"))
                .andExpect(jsonPath("$.data[1].requestId").value(firstRequest.getId()))
                .andExpect(jsonPath("$.data[1].targetUserLabel").value("Mentor One"));
    }

    @Test
    void getFeedbackByRequestReturnsAuthorsOwnFeedback() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringRequest mentoringRequest = saveRequest(requester, mentor, "Need guidance");
        MentoringFeedback mentoringFeedback = saveFeedback(
                mentoringRequest,
                requester,
                mentor,
                5,
                "Session summary",
                "Great session"
        );

        mockMvc.perform(get("/api/mentoring/feedbacks/by-request/{requestId}", mentoringRequest.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Session feedback retrieved by request."))
                .andExpect(jsonPath("$.data.id").value(mentoringFeedback.getId()))
                .andExpect(jsonPath("$.data.requestId").value(mentoringRequest.getId()))
                .andExpect(jsonPath("$.data.authorId").value(requester.getId()));
    }

    @Test
    void unrelatedUserCannotViewFeedback() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        User outsider = saveUser("outsider@neo.square", "Outsider");
        MentoringRequest mentoringRequest = saveRequest(requester, mentor, "Need guidance");
        MentoringFeedback mentoringFeedback = saveFeedback(
                mentoringRequest,
                requester,
                mentor,
                5,
                "Session summary",
                "Great session"
        );

        mockMvc.perform(get("/api/mentoring/feedbacks/{feedbackId}", mentoringFeedback.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(outsider)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("You do not have access to this session feedback."))
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void createFeedbackWithInvalidRatingReturnsBadRequest() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringRequest mentoringRequest = saveRequest(requester, mentor, "Need help");

        mockMvc.perform(post("/api/mentoring/feedbacks")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "requestId": %d,
                                  "rating": 6,
                                  "summary": "Invalid rating",
                                  "feedback": "Should fail"
                                }
                                """.formatted(mentoringRequest.getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Validation failed."))
                .andExpect(jsonPath("$.errors.rating").value("rating must be between 1 and 5."));
    }

    @Test
    void duplicateFeedbackForSameRequestAndAuthorReturnsConflict() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringRequest mentoringRequest = saveRequest(requester, mentor, "Need help");
        saveFeedback(mentoringRequest, requester, mentor, 4, "Existing", "Already saved");

        mockMvc.perform(post("/api/mentoring/feedbacks")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "requestId": %d,
                                  "rating": 5,
                                  "summary": "Duplicate",
                                  "feedback": "Should fail"
                                }
                                """.formatted(mentoringRequest.getId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Feedback already exists for request: " + mentoringRequest.getId()))
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void createFeedbackWithMissingRequestReturnsNotFound() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");

        mockMvc.perform(post("/api/mentoring/feedbacks")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "requestId": 9999,
                                  "rating": 5,
                                  "summary": "Missing request",
                                  "feedback": "Should fail"
                                }
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Mentoring request not found: 9999"))
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

    private MentoringRequest saveRequest(User requester, User mentor, String message) {
        return mentoringRequestRepository.save(MentoringRequest.create(requester, mentor, message));
    }

    private MentoringFeedback saveFeedback(
            MentoringRequest request,
            User author,
            User targetUser,
            int rating,
            String summary,
            String feedback
    ) {
        return mentoringFeedbackRepository.save(
                MentoringFeedback.create(request, author, targetUser, rating, summary, feedback)
        );
    }

    private String bearerToken(User user) {
        return "Bearer " + jwtTokenProvider.generateAccessToken(user);
    }
}
