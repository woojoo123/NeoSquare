package com.neosquare.mentoring;

import java.util.List;

import com.neosquare.auth.AuthUserPrincipal;
import com.neosquare.common.ApiResponse;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mentoring/reservation-feedbacks")
public class MentoringReservationFeedbackController {

    private final MentoringReservationFeedbackService mentoringReservationFeedbackService;

    public MentoringReservationFeedbackController(
            MentoringReservationFeedbackService mentoringReservationFeedbackService
    ) {
        this.mentoringReservationFeedbackService = mentoringReservationFeedbackService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<MentoringReservationFeedbackResponse>> createFeedback(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @Valid @RequestBody MentoringReservationFeedbackCreateRequest request
    ) {
        MentoringReservationFeedbackResponse response =
                mentoringReservationFeedbackService.createFeedback(authUser, request);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Reservation feedback created.", response));
    }

    @GetMapping("/me")
    public ApiResponse<List<MentoringReservationFeedbackResponse>> getMyFeedbacks(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "My reservation feedbacks retrieved.",
                mentoringReservationFeedbackService.getMyFeedbacks(authUser)
        );
    }

    @GetMapping("/{feedbackId}")
    public ApiResponse<MentoringReservationFeedbackResponse> getFeedback(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long feedbackId
    ) {
        return ApiResponse.success(
                "Reservation feedback retrieved.",
                mentoringReservationFeedbackService.getFeedback(authUser, feedbackId)
        );
    }

    @GetMapping("/by-reservation/{reservationId}")
    public ApiResponse<MentoringReservationFeedbackResponse> getFeedbackByReservation(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long reservationId
    ) {
        return ApiResponse.success(
                "Reservation feedback retrieved by reservation.",
                mentoringReservationFeedbackService.getFeedbackByReservation(authUser, reservationId)
        );
    }
}
