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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mentor-management")
public class MentorManagementController {

    private final MentorManagementService mentorManagementService;

    public MentorManagementController(MentorManagementService mentorManagementService) {
        this.mentorManagementService = mentorManagementService;
    }

    @GetMapping("/profile")
    public ApiResponse<MentorManagementProfileResponse> getMyProfile(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "Mentor profile retrieved.",
                mentorManagementService.getMyProfile(authUser)
        );
    }

    @PatchMapping("/profile")
    public ApiResponse<MentorManagementProfileResponse> updateMyProfile(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @Valid @RequestBody MentorManagementProfileUpdateRequest request
    ) {
        return ApiResponse.success(
                "Mentor profile updated.",
                mentorManagementService.updateMyProfile(authUser, request)
        );
    }

    @GetMapping("/availability")
    public ApiResponse<List<MentorAvailabilitySlotResponse>> getMyAvailability(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "Mentor availability retrieved.",
                mentorManagementService.getMyAvailability(authUser)
        );
    }

    @PutMapping("/availability")
    public ApiResponse<List<MentorAvailabilitySlotResponse>> updateMyAvailability(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @Valid @RequestBody MentorAvailabilityUpdateRequest request
    ) {
        return ApiResponse.success(
                "Mentor availability updated.",
                mentorManagementService.updateMyAvailability(authUser, request)
        );
    }

    @GetMapping("/courses")
    public ApiResponse<List<MentorCourseResponse>> getMyCourses(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "Mentor courses retrieved.",
                mentorManagementService.getMyCourses(authUser)
        );
    }

    @PostMapping("/courses")
    public ResponseEntity<ApiResponse<MentorCourseResponse>> createCourse(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @Valid @RequestBody MentorCourseCreateRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(
                        "Mentor course created.",
                        mentorManagementService.createCourse(authUser, request)
                ));
    }

    @PatchMapping("/courses/{courseId}")
    public ApiResponse<MentorCourseResponse> updateCourse(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long courseId,
            @Valid @RequestBody MentorCourseUpdateRequest request
    ) {
        return ApiResponse.success(
                "Mentor course updated.",
                mentorManagementService.updateCourse(authUser, courseId, request)
        );
    }
}
