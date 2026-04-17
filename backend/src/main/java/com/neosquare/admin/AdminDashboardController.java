package com.neosquare.admin;

import com.neosquare.auth.AuthUserPrincipal;
import com.neosquare.common.ApiResponse;

import jakarta.validation.Valid;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminDashboardController {

    private final AdminDashboardService adminDashboardService;

    public AdminDashboardController(AdminDashboardService adminDashboardService) {
        this.adminDashboardService = adminDashboardService;
    }

    @GetMapping("/dashboard")
    public ApiResponse<AdminDashboardResponse> getDashboard(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "Admin dashboard retrieved.",
                adminDashboardService.getDashboard(authUser)
        );
    }

    @PatchMapping("/mentors/{mentorId}/visibility")
    public ApiResponse<AdminMentorOverviewResponse> updateMentorVisibility(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long mentorId,
            @Valid @RequestBody AdminMentorVisibilityUpdateRequest request
    ) {
        return ApiResponse.success(
                "Mentor visibility updated.",
                adminDashboardService.updateMentorVisibility(authUser, mentorId, request)
        );
    }

    @PatchMapping("/courses/{courseId}/status")
    public ApiResponse<AdminCourseOverviewResponse> updateCourseStatus(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long courseId,
            @Valid @RequestBody AdminCourseStatusUpdateRequest request
    ) {
        return ApiResponse.success(
                "Course status updated.",
                adminDashboardService.updateCourseStatus(authUser, courseId, request)
        );
    }
}
