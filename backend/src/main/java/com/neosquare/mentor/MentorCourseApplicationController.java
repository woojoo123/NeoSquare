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
@RequestMapping("/api/mentor-courses")
public class MentorCourseApplicationController {

    private final MentorCourseApplicationService mentorCourseApplicationService;

    public MentorCourseApplicationController(MentorCourseApplicationService mentorCourseApplicationService) {
        this.mentorCourseApplicationService = mentorCourseApplicationService;
    }

    @PostMapping("/{courseId}/applications")
    public ResponseEntity<ApiResponse<MentorCourseApplicationResponse>> createApplication(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long courseId,
            @Valid @RequestBody(required = false) MentorCourseApplicationCreateRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(
                        "Course application created.",
                        mentorCourseApplicationService.createApplication(authUser, courseId, request)
                ));
    }

    @GetMapping("/applications/me")
    public ApiResponse<List<MentorCourseApplicationResponse>> getMyApplications(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "My course applications retrieved.",
                mentorCourseApplicationService.getMyApplications(authUser)
        );
    }

    @GetMapping("/applications/received")
    public ApiResponse<List<MentorCourseApplicationResponse>> getReceivedApplications(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "Received course applications retrieved.",
                mentorCourseApplicationService.getReceivedApplications(authUser)
        );
    }

    @PatchMapping("/applications/{applicationId}/approve")
    public ApiResponse<MentorCourseApplicationResponse> approveApplication(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long applicationId,
            @Valid @RequestBody(required = false) MentorCourseApplicationReviewRequest request
    ) {
        return ApiResponse.success(
                "Course application approved.",
                mentorCourseApplicationService.approveApplication(authUser, applicationId, request)
        );
    }

    @PatchMapping("/applications/{applicationId}/reject")
    public ApiResponse<MentorCourseApplicationResponse> rejectApplication(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long applicationId,
            @Valid @RequestBody(required = false) MentorCourseApplicationReviewRequest request
    ) {
        return ApiResponse.success(
                "Course application rejected.",
                mentorCourseApplicationService.rejectApplication(authUser, applicationId, request)
        );
    }

    @PatchMapping("/applications/{applicationId}/cancel")
    public ApiResponse<MentorCourseApplicationResponse> cancelApplication(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long applicationId
    ) {
        return ApiResponse.success(
                "Course application canceled.",
                mentorCourseApplicationService.cancelApplication(authUser, applicationId)
        );
    }
}
