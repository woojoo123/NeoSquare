package com.neosquare.mentoring;

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
@RequestMapping("/api/mentoring/requests")
public class MentoringRequestController {

    private final MentoringRequestService mentoringRequestService;

    public MentoringRequestController(MentoringRequestService mentoringRequestService) {
        this.mentoringRequestService = mentoringRequestService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<MentoringRequestResponse>> createRequest(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @Valid @RequestBody MentoringRequestCreateRequest request
    ) {
        MentoringRequestResponse response = mentoringRequestService.createRequest(authUser, request);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Mentoring request created.", response));
    }

    @GetMapping("/sent")
    public ApiResponse<List<MentoringRequestResponse>> getSentRequests(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "Sent mentoring requests retrieved.",
                mentoringRequestService.getSentRequests(authUser)
        );
    }

    @GetMapping("/received")
    public ApiResponse<List<MentoringRequestResponse>> getReceivedRequests(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "Received mentoring requests retrieved.",
                mentoringRequestService.getReceivedRequests(authUser)
        );
    }

    @GetMapping("/{requestId}")
    public ApiResponse<MentoringRequestResponse> getRequest(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long requestId
    ) {
        return ApiResponse.success(
                "Mentoring request retrieved.",
                mentoringRequestService.getRequest(authUser, requestId)
        );
    }

    @PatchMapping("/{requestId}/accept")
    public ApiResponse<MentoringRequestResponse> acceptRequest(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long requestId
    ) {
        return ApiResponse.success(
                "Mentoring request accepted.",
                mentoringRequestService.acceptRequest(authUser, requestId)
        );
    }

    @PatchMapping("/{requestId}/reject")
    public ApiResponse<MentoringRequestResponse> rejectRequest(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long requestId
    ) {
        return ApiResponse.success(
                "Mentoring request rejected.",
                mentoringRequestService.rejectRequest(authUser, requestId)
        );
    }
}
