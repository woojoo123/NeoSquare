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

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
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

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(normalizeEmail(request.email()))
                .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new InvalidCredentialsException();
        }

        String accessToken = jwtTokenProvider.generateAccessToken(user);

        return LoginResponse.of(user, accessToken);
    }

    @Transactional(readOnly = true)
    public void logout(AuthUserPrincipal authUser) {
        // Refresh token 도입 전 단계라 서버 측 폐기 작업은 없다.
        if (authUser == null) {
            throw new InvalidCredentialsException();
        }
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
