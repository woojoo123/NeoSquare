package com.neosquare.mentor;

import java.util.List;

import com.neosquare.auth.AuthUserPrincipal;
import com.neosquare.mentoring.UserNotFoundException;
import com.neosquare.user.User;
import com.neosquare.user.UserRepository;
import com.neosquare.user.UserRole;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MentorApplicationService {

    private final MentorApplicationRepository mentorApplicationRepository;
    private final UserRepository userRepository;

    public MentorApplicationService(
            MentorApplicationRepository mentorApplicationRepository,
            UserRepository userRepository
    ) {
        this.mentorApplicationRepository = mentorApplicationRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public MentorApplicationResponse getMyApplication(AuthUserPrincipal authUser) {
        Long currentUserId = extractCurrentUserId(authUser);

        MentorApplication mentorApplication = mentorApplicationRepository.findByUser_Id(currentUserId)
                .orElseThrow(() -> new MentorApplicationNotFoundException(currentUserId));

        return MentorApplicationResponse.from(mentorApplication);
    }

    @Transactional
    public MentorApplicationResponse submitApplication(
            AuthUserPrincipal authUser,
            MentorApplicationCreateRequest request
    ) {
        User user = getUserOrThrow(extractCurrentUserId(authUser));

        if (user.getRole() == UserRole.MENTOR || user.getRole() == UserRole.ADMIN) {
            throw new InvalidMentorApplicationStateException("You are already registered as a mentor.");
        }

        String bio = request.bio().trim();
        String specialties = request.specialties().trim();
        String interests = request.interests().trim();
        String reason = request.reason().trim();

        MentorApplication mentorApplication = mentorApplicationRepository.findByUser_Id(user.getId())
                .map(existingApplication -> resubmitApplication(
                        existingApplication,
                        bio,
                        specialties,
                        interests,
                        reason
                ))
                .orElseGet(() -> MentorApplication.create(user, bio, specialties, interests, reason));

        MentorApplication savedApplication = mentorApplicationRepository.save(mentorApplication);
        return MentorApplicationResponse.from(savedApplication);
    }

    @Transactional(readOnly = true)
    public List<MentorApplicationResponse> getPendingApplications(AuthUserPrincipal authUser) {
        ensureAdmin(authUser);

        return mentorApplicationRepository.findAllByStatusOrderByCreatedAtAscIdAsc(MentorApplicationStatus.PENDING)
                .stream()
                .map(MentorApplicationResponse::from)
                .toList();
    }

    @Transactional
    public MentorApplicationResponse approveApplication(
            AuthUserPrincipal authUser,
            Long mentorApplicationId,
            MentorApplicationReviewRequest request
    ) {
        ensureAdmin(authUser);
        MentorApplication mentorApplication = getApplicationOrThrow(mentorApplicationId);

        mentorApplication.approve(normalizeReviewNote(request));
        mentorApplication.getUser().changeRole(UserRole.MENTOR);
        mentorApplication.getUser().getProfile().update(
                mentorApplication.getBio(),
                mentorApplication.getInterests(),
                mentorApplication.getSpecialties(),
                mentorApplication.getUser().getProfile().getAvatarUrl(),
                true
        );

        return MentorApplicationResponse.from(mentorApplication);
    }

    @Transactional
    public MentorApplicationResponse rejectApplication(
            AuthUserPrincipal authUser,
            Long mentorApplicationId,
            MentorApplicationReviewRequest request
    ) {
        ensureAdmin(authUser);
        MentorApplication mentorApplication = getApplicationOrThrow(mentorApplicationId);
        mentorApplication.reject(normalizeReviewNote(request));

        return MentorApplicationResponse.from(mentorApplication);
    }

    private MentorApplication resubmitApplication(
            MentorApplication mentorApplication,
            String bio,
            String specialties,
            String interests,
            String reason
    ) {
        if (mentorApplication.getStatus() == MentorApplicationStatus.PENDING) {
            throw new InvalidMentorApplicationStateException(
                    "Your mentor application is already pending review."
            );
        }

        if (mentorApplication.getStatus() == MentorApplicationStatus.APPROVED) {
            throw new InvalidMentorApplicationStateException(
                    "Your mentor application has already been approved."
            );
        }

        mentorApplication.resubmit(bio, specialties, interests, reason);
        return mentorApplication;
    }

    private String normalizeReviewNote(MentorApplicationReviewRequest request) {
        if (request == null || request.reviewNote() == null) {
            return null;
        }

        String reviewNote = request.reviewNote().trim();
        return reviewNote.isBlank() ? null : reviewNote;
    }

    private void ensureAdmin(AuthUserPrincipal authUser) {
        if (authUser == null || authUser.role() != UserRole.ADMIN) {
            throw new MentorApplicationAccessDeniedException("Only admins can review mentor applications.");
        }
    }

    private Long extractCurrentUserId(AuthUserPrincipal authUser) {
        if (authUser == null || authUser.id() == null) {
            throw new MentorApplicationAccessDeniedException("Authentication is required.");
        }

        return authUser.id();
    }

    private User getUserOrThrow(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + userId));
    }

    private MentorApplication getApplicationOrThrow(Long mentorApplicationId) {
        return mentorApplicationRepository.findById(mentorApplicationId)
                .orElseThrow(() -> new MentorApplicationNotFoundException(mentorApplicationId));
    }
}
