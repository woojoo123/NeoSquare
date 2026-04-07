package com.neosquare.mentoring;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
class MentoringRequestIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MentoringRequestRepository mentoringRequestRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void createMentoringRequestReturnsCreatedRequest() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");

        mockMvc.perform(post("/api/mentoring/requests")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "mentorId": %d,
                                  "message": "Need help with Spring Boot."
                                }
                                """.formatted(mentor.getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Mentoring request created."))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.requesterId").value(requester.getId()))
                .andExpect(jsonPath("$.data.requesterLabel").value("Requester"))
                .andExpect(jsonPath("$.data.requesterNickname").value("Requester"))
                .andExpect(jsonPath("$.data.mentorId").value(mentor.getId()))
                .andExpect(jsonPath("$.data.mentorLabel").value("Mentor"))
                .andExpect(jsonPath("$.data.mentorNickname").value("Mentor"))
                .andExpect(jsonPath("$.data.message").value("Need help with Spring Boot."))
                .andExpect(jsonPath("$.data.status").value(MentoringRequestStatus.PENDING.name()))
                .andExpect(jsonPath("$.data.createdAt").exists());
    }

    @Test
    void getSentRequestsReturnsCurrentUsersRequests() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User firstMentor = saveUser("mentor1@neo.square", "Mentor One");
        User secondMentor = saveUser("mentor2@neo.square", "Mentor Two");

        saveRequest(requester, firstMentor, "First request");
        MentoringRequest latestRequest = saveRequest(requester, secondMentor, "Second request");

        mockMvc.perform(get("/api/mentoring/requests/sent")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Sent mentoring requests retrieved."))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].id").value(latestRequest.getId()))
                .andExpect(jsonPath("$.data[0].mentorNickname").value("Mentor Two"))
                .andExpect(jsonPath("$.data[1].mentorNickname").value("Mentor One"));
    }

    @Test
    void getReceivedRequestsReturnsCurrentUsersRequests() throws Exception {
        User mentor = saveUser("mentor@neo.square", "Mentor");
        User firstRequester = saveUser("requester1@neo.square", "Requester One");
        User secondRequester = saveUser("requester2@neo.square", "Requester Two");

        saveRequest(firstRequester, mentor, "First request");
        MentoringRequest latestRequest = saveRequest(secondRequester, mentor, "Second request");

        mockMvc.perform(get("/api/mentoring/requests/received")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Received mentoring requests retrieved."))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].id").value(latestRequest.getId()))
                .andExpect(jsonPath("$.data[0].requesterNickname").value("Requester Two"))
                .andExpect(jsonPath("$.data[1].requesterNickname").value("Requester One"));
    }

    @Test
    void getRequestReturnsRequestForParticipant() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringRequest mentoringRequest = saveRequest(requester, mentor, "Need some guidance");

        mockMvc.perform(get("/api/mentoring/requests/{requestId}", mentoringRequest.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Mentoring request retrieved."))
                .andExpect(jsonPath("$.data.id").value(mentoringRequest.getId()))
                .andExpect(jsonPath("$.data.requesterId").value(requester.getId()))
                .andExpect(jsonPath("$.data.mentorId").value(mentor.getId()))
                .andExpect(jsonPath("$.data.message").value("Need some guidance"))
                .andExpect(jsonPath("$.data.status").value(MentoringRequestStatus.PENDING.name()));
    }

    @Test
    void mentorCanAcceptPendingRequest() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringRequest mentoringRequest = saveRequest(requester, mentor, "Please accept");

        mockMvc.perform(patch("/api/mentoring/requests/{requestId}/accept", mentoringRequest.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Mentoring request accepted."))
                .andExpect(jsonPath("$.data.status").value(MentoringRequestStatus.ACCEPTED.name()));
    }

    @Test
    void mentorCanRejectPendingRequest() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringRequest mentoringRequest = saveRequest(requester, mentor, "Please reject");

        mockMvc.perform(patch("/api/mentoring/requests/{requestId}/reject", mentoringRequest.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(mentor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Mentoring request rejected."))
                .andExpect(jsonPath("$.data.status").value(MentoringRequestStatus.REJECTED.name()));
    }

    @Test
    void requesterCannotAcceptOwnRequest() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");
        User mentor = saveUser("mentor@neo.square", "Mentor");
        MentoringRequest mentoringRequest = saveRequest(requester, mentor, "Need a mentor");

        mockMvc.perform(patch("/api/mentoring/requests/{requestId}/accept", mentoringRequest.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Only the mentor can accept this mentoring request."))
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void createMentoringRequestToSelfReturnsBadRequest() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");

        mockMvc.perform(post("/api/mentoring/requests")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "mentorId": %d,
                                  "message": "Need help with myself."
                                }
                                """.formatted(requester.getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("You cannot send a mentoring request to yourself."))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void getMissingRequestReturnsNotFound() throws Exception {
        User requester = saveUser("requester@neo.square", "Requester");

        mockMvc.perform(get("/api/mentoring/requests/{requestId}", 9999L)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(requester)))
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

    private String bearerToken(User user) {
        return "Bearer " + jwtTokenProvider.generateAccessToken(user);
    }
}
