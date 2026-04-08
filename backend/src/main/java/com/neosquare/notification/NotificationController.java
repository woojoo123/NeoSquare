package com.neosquare.notification;

import java.util.List;

import com.neosquare.auth.AuthUserPrincipal;
import com.neosquare.common.ApiResponse;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping("/me")
    public ApiResponse<List<NotificationResponse>> getMyNotifications(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "My notifications retrieved.",
                notificationService.getMyNotifications(authUser)
        );
    }

    @PatchMapping("/{notificationId}/read")
    public ApiResponse<NotificationResponse> readNotification(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long notificationId
    ) {
        return ApiResponse.success(
                "Notification marked as read.",
                notificationService.readNotification(authUser, notificationId)
        );
    }

    @PatchMapping("/read-all")
    public ApiResponse<List<NotificationResponse>> readAllNotifications(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "All notifications marked as read.",
                notificationService.readAllNotifications(authUser)
        );
    }
}
