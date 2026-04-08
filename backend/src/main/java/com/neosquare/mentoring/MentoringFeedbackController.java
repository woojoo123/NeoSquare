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
@RequestMapping("/api/mentoring/feedbacks")
public class MentoringFeedbackController {

    private final MentoringFeedbackService mentoringFeedbackService;

    public MentoringFeedbackController(MentoringFeedbackService mentoringFeedbackService) {
        this.mentoringFeedbackService = mentoringFeedbackService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<MentoringFeedbackResponse>> createFeedback(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @Valid @RequestBody MentoringFeedbackCreateRequest request
    ) {
        MentoringFeedbackResponse response = mentoringFeedbackService.createFeedback(authUser, request);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Session feedback created.", response));
    }

    @GetMapping("/me")
    public ApiResponse<List<MentoringFeedbackResponse>> getMyFeedbacks(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "My session feedbacks retrieved.",
                mentoringFeedbackService.getMyFeedbacks(authUser)
        );
    }

    @GetMapping("/{feedbackId}")
    public ApiResponse<MentoringFeedbackResponse> getFeedback(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long feedbackId
    ) {
        return ApiResponse.success(
                "Session feedback retrieved.",
                mentoringFeedbackService.getFeedback(authUser, feedbackId)
        );
    }

    @GetMapping("/by-request/{requestId}")
    public ApiResponse<MentoringFeedbackResponse> getFeedbackByRequest(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long requestId
    ) {
        return ApiResponse.success(
                "Session feedback retrieved by request.",
                mentoringFeedbackService.getFeedbackByRequest(authUser, requestId)
        );
    }
}
