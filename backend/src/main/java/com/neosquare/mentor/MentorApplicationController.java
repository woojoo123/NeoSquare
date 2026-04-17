package com.neosquare.mentor;

import java.util.List;

import com.neosquare.auth.AuthUserPrincipal;
import com.neosquare.common.ApiResponse;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mentor-applications")
public class MentorApplicationController {

    private final MentorApplicationService mentorApplicationService;

    public MentorApplicationController(MentorApplicationService mentorApplicationService) {
        this.mentorApplicationService = mentorApplicationService;
    }

    @GetMapping("/me")
    public ApiResponse<MentorApplicationResponse> getMyApplication(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "Mentor application retrieved.",
                mentorApplicationService.getMyApplication(authUser)
        );
    }

    @PostMapping
    public ResponseEntity<ApiResponse<MentorApplicationResponse>> submitApplication(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @Valid @RequestBody MentorApplicationCreateRequest request
    ) {
        MentorApplicationResponse response = mentorApplicationService.submitApplication(authUser, request);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Mentor application submitted.", response));
    }

    @GetMapping("/pending")
    public ApiResponse<List<MentorApplicationResponse>> getPendingApplications(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "Pending mentor applications retrieved.",
                mentorApplicationService.getPendingApplications(authUser)
        );
    }

    @PatchMapping("/{mentorApplicationId}/approve")
    public ApiResponse<MentorApplicationResponse> approveApplication(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long mentorApplicationId,
            @Valid @RequestBody(required = false) MentorApplicationReviewRequest request
    ) {
        return ApiResponse.success(
                "Mentor application approved.",
                mentorApplicationService.approveApplication(authUser, mentorApplicationId, request)
        );
    }

    @PatchMapping("/{mentorApplicationId}/reject")
    public ApiResponse<MentorApplicationResponse> rejectApplication(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long mentorApplicationId,
            @Valid @RequestBody(required = false) MentorApplicationReviewRequest request
    ) {
        return ApiResponse.success(
                "Mentor application rejected.",
                mentorApplicationService.rejectApplication(authUser, mentorApplicationId, request)
        );
    }
}
