package com.neosquare.auth;

import com.neosquare.user.User;
import com.neosquare.user.UserRepository;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenService refreshTokenService;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider,
            RefreshTokenService refreshTokenService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.refreshTokenService = refreshTokenService;
    }

    @Transactional
    public SignupResponse signup(SignupRequest request) {
        String normalizedEmail = normalizeEmail(request.email());
        String normalizedNickname = normalizeNickname(request.nickname());

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new DuplicateEmailException();
        }

        if (userRepository.existsByNickname(normalizedNickname)) {
            throw new DuplicateNicknameException();
        }

        String encodedPassword = passwordEncoder.encode(request.password());
        User user = User.create(normalizedEmail, encodedPassword, normalizedNickname);
        User savedUser = userRepository.save(user);

        return SignupResponse.from(savedUser);
    }

    @Transactional
    public AuthSessionResult login(LoginRequest request) {
        User user = userRepository.findByEmail(normalizeEmail(request.email()))
                .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new InvalidCredentialsException();
        }

        String accessToken = jwtTokenProvider.generateAccessToken(user);
        String refreshToken = refreshTokenService.issue(user);

        return new AuthSessionResult(
                LoginResponse.of(user, accessToken),
                refreshToken
        );
    }

    @Transactional
    public AuthSessionResult refresh(String refreshToken) {
        User user = refreshTokenService.rotate(refreshToken);
        String accessToken = jwtTokenProvider.generateAccessToken(user);
        String nextRefreshToken = refreshTokenService.issue(user);

        return new AuthSessionResult(
                LoginResponse.of(user, accessToken),
                nextRefreshToken
        );
    }

    @Transactional
    public void logout(AuthUserPrincipal authUser, String refreshToken) {
        if (authUser == null) {
            throw new InvalidCredentialsException();
        }

        refreshTokenService.revoke(refreshToken);
    }

    @Transactional(readOnly = true)
    public CurrentUserResponse getCurrentUser(AuthUserPrincipal authUser) {
        return CurrentUserResponse.from(authUser);
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    private String normalizeNickname(String nickname) {
        return nickname == null ? null : nickname.trim();
    }
}
