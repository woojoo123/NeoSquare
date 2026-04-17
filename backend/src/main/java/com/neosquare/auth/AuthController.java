package com.neosquare.auth;

import com.neosquare.common.ApiResponse;

import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final RefreshTokenCookieService refreshTokenCookieService;

    public AuthController(AuthService authService, RefreshTokenCookieService refreshTokenCookieService) {
        this.authService = authService;
        this.refreshTokenCookieService = refreshTokenCookieService;
    }

    @PostMapping("/signup")
    public ResponseEntity<ApiResponse<SignupResponse>> signup(@Valid @RequestBody SignupRequest request) {
        SignupResponse response = authService.signup(request);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Signup succeeded.", response));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthSessionResult sessionResult = authService.login(request);

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.SET_COOKIE,
                        refreshTokenCookieService.buildRefreshTokenCookieHeader(sessionResult.refreshToken())
                )
                .body(ApiResponse.success("Login succeeded.", sessionResult.loginResponse()));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @AuthenticationPrincipal AuthUserPrincipal authUser,
            HttpServletRequest request
    ) {
        authService.logout(
                authUser,
                refreshTokenCookieService.extractRefreshToken(request.getHeader(HttpHeaders.COOKIE))
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookieService.buildClearRefreshTokenCookieHeader())
                .body(ApiResponse.success("Logout succeeded."));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<LoginResponse>> refresh(HttpServletRequest request) {
        AuthSessionResult sessionResult = authService.refresh(
                refreshTokenCookieService.extractRefreshToken(request.getHeader(HttpHeaders.COOKIE))
        );

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.SET_COOKIE,
                        refreshTokenCookieService.buildRefreshTokenCookieHeader(sessionResult.refreshToken())
                )
                .body(ApiResponse.success("Refresh succeeded.", sessionResult.loginResponse()));
    }

    @GetMapping("/me")
    public ApiResponse<CurrentUserResponse> me(@AuthenticationPrincipal AuthUserPrincipal authUser) {
        CurrentUserResponse response = authService.getCurrentUser(authUser);

        return ApiResponse.success("Current user retrieved.", response);
    }

    @PostMapping("/ws-ticket")
    public ApiResponse<WebSocketTicketResponse> issueWebSocketTicket(
            @AuthenticationPrincipal AuthUserPrincipal authUser
    ) {
        return ApiResponse.success(
                "WebSocket ticket issued.",
                authService.issueWebSocketTicket(authUser)
        );
    }
}
