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
@RequestMapping("/api/mentoring/reservations")
public class MentoringReservationController {

    private final MentoringReservationService mentoringReservationService;

    public MentoringReservationController(MentoringReservationService mentoringReservationService) {
        this.mentoringReservationService = mentoringReservationService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<MentoringReservationResponse>> createReservation(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @Valid @RequestBody MentoringReservationCreateRequest request
    ) {
        MentoringReservationResponse response = mentoringReservationService.createReservation(authUser, request);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Reservation created.", response));
    }

    @GetMapping("/me")
    public ApiResponse<List<MentoringReservationResponse>> getMyReservations(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "My reservations retrieved.",
                mentoringReservationService.getMyReservations(authUser)
        );
    }

    @GetMapping("/received")
    public ApiResponse<List<MentoringReservationResponse>> getReceivedReservations(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "Received reservations retrieved.",
                mentoringReservationService.getReceivedReservations(authUser)
        );
    }

    @GetMapping("/{reservationId}")
    public ApiResponse<MentoringReservationResponse> getReservation(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long reservationId
    ) {
        return ApiResponse.success(
                "Reservation retrieved.",
                mentoringReservationService.getReservation(authUser, reservationId)
        );
    }

    @PatchMapping("/{reservationId}/accept")
    public ApiResponse<MentoringReservationResponse> acceptReservation(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long reservationId
    ) {
        return ApiResponse.success(
                "Reservation accepted.",
                mentoringReservationService.acceptReservation(authUser, reservationId)
        );
    }

    @PatchMapping("/{reservationId}/reject")
    public ApiResponse<MentoringReservationResponse> rejectReservation(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long reservationId
    ) {
        return ApiResponse.success(
                "Reservation rejected.",
                mentoringReservationService.rejectReservation(authUser, reservationId)
        );
    }

    @PatchMapping("/{reservationId}/cancel")
    public ApiResponse<MentoringReservationResponse> cancelReservation(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long reservationId
    ) {
        return ApiResponse.success(
                "Reservation canceled.",
                mentoringReservationService.cancelReservation(authUser, reservationId)
        );
    }
}
