package com.neosquare.study;

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
@RequestMapping("/api/study/sessions")
public class StudySessionController {

    private final StudySessionService studySessionService;

    public StudySessionController(StudySessionService studySessionService) {
        this.studySessionService = studySessionService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<StudySessionResponse>> createStudySession(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @Valid @RequestBody StudySessionCreateRequest request
    ) {
        StudySessionResponse response = studySessionService.createStudySession(authUser, request);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Study session created.", response));
    }

    @GetMapping("/me")
    public ApiResponse<List<StudySessionResponse>> getMyStudySessions(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "My study sessions retrieved.",
                studySessionService.getMyStudySessions(authUser)
        );
    }

    @GetMapping("/space/{spaceId}")
    public ApiResponse<List<StudySessionResponse>> getStudySessionsBySpace(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long spaceId
    ) {
        return ApiResponse.success(
                "Study sessions retrieved.",
                studySessionService.getStudySessionsBySpace(authUser, spaceId)
        );
    }

    @GetMapping("/{studySessionId}")
    public ApiResponse<StudySessionResponse> getStudySession(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long studySessionId
    ) {
        return ApiResponse.success(
                "Study session retrieved.",
                studySessionService.getStudySession(authUser, studySessionId)
        );
    }

    @PostMapping("/{studySessionId}/join")
    public ApiResponse<StudySessionResponse> joinStudySession(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long studySessionId
    ) {
        return ApiResponse.success(
                "Study session joined.",
                studySessionService.joinStudySession(authUser, studySessionId)
        );
    }

    @PatchMapping("/{studySessionId}/complete")
    public ApiResponse<StudySessionResponse> completeStudySession(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            @PathVariable Long studySessionId
    ) {
        return ApiResponse.success(
                "Study session completed.",
                studySessionService.completeStudySession(authUser, studySessionId)
        );
    }
}
