package com.neosquare.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;

import com.neosquare.user.User;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class RefreshTokenService {

    private static final int REFRESH_TOKEN_BYTE_LENGTH = 32;

    private final JwtProperties jwtProperties;
    private final RefreshTokenRepository refreshTokenRepository;

    public RefreshTokenService(
            JwtProperties jwtProperties,
            RefreshTokenRepository refreshTokenRepository
    ) {
        this.jwtProperties = jwtProperties;
        this.refreshTokenRepository = refreshTokenRepository;
    }

    @Transactional
    public String issue(User user) {
        String rawToken = generateToken();
        String tokenHash = hashToken(rawToken);
        Instant expiration = Instant.now().plusMillis(jwtProperties.refreshTokenExpirationMillis());

        refreshTokenRepository.save(RefreshToken.issue(user, tokenHash, expiration));
        return rawToken;
    }

    @Transactional
    public User rotate(String rawToken) {
        RefreshToken refreshToken = findValidRefreshToken(rawToken);
        User user = refreshToken.getUser();

        refreshTokenRepository.delete(refreshToken);
        return user;
    }

    @Transactional
    public void revoke(String rawToken) {
        if (!StringUtils.hasText(rawToken)) {
            return;
        }

        refreshTokenRepository.findByTokenHash(hashToken(rawToken))
                .ifPresent(refreshTokenRepository::delete);
    }

    private RefreshToken findValidRefreshToken(String rawToken) {
        if (!StringUtils.hasText(rawToken)) {
            throw new InvalidRefreshTokenException();
        }

        RefreshToken refreshToken = refreshTokenRepository.findByTokenHash(hashToken(rawToken))
                .orElseThrow(InvalidRefreshTokenException::new);

        if (refreshToken.isExpired(Instant.now())) {
            refreshTokenRepository.delete(refreshToken);
            throw new InvalidRefreshTokenException();
        }

        return refreshToken;
    }

    private String generateToken() {
        byte[] bytes = new byte[REFRESH_TOKEN_BYTE_LENGTH];
        new java.security.SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hash.length * 2);

            for (byte value : hash) {
                builder.append(String.format("%02x", value));
            }

            return builder.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 algorithm is required.", exception);
        }
    }
}
