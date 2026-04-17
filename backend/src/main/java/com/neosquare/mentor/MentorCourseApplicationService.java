package com.neosquare.mentor;

import java.util.List;
import java.util.Objects;

import com.neosquare.auth.AuthUserPrincipal;
import com.neosquare.mentoring.UserNotFoundException;
import com.neosquare.user.User;
import com.neosquare.user.UserRepository;
import com.neosquare.user.UserRole;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MentorCourseApplicationService {

    private final MentorCourseRepository mentorCourseRepository;
    private final MentorCourseApplicationRepository mentorCourseApplicationRepository;
    private final UserRepository userRepository;

    public MentorCourseApplicationService(
            MentorCourseRepository mentorCourseRepository,
            MentorCourseApplicationRepository mentorCourseApplicationRepository,
            UserRepository userRepository
    ) {
        this.mentorCourseRepository = mentorCourseRepository;
        this.mentorCourseApplicationRepository = mentorCourseApplicationRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public MentorCourseApplicationResponse createApplication(
            AuthUserPrincipal authUser,
            Long courseId,
            MentorCourseApplicationCreateRequest request
    ) {
        Long applicantId = extractCurrentUserId(authUser);
        MentorCourse course = getCourseOrThrow(courseId);

        if (course.getStatus() != MentorCourseStatus.PUBLISHED) {
            throw new InvalidMentorCourseApplicationStateException(
                    "Only published courses can receive applications."
            );
        }

        if (!course.getMentor().getProfile().isMentorEnabled()) {
            throw new InvalidMentorCourseApplicationStateException(
                    "This mentor is not accepting course applications right now."
            );
        }

        long approvedCount = mentorCourseApplicationRepository.countByCourse_IdAndStatus(
                course.getId(),
                MentorCourseApplicationStatus.APPROVED
        );

        if (approvedCount >= course.getCapacity()) {
            throw new InvalidMentorCourseApplicationStateException("This course is already full.");
        }

        if (Objects.equals(course.getMentor().getId(), applicantId)) {
            throw new InvalidMentorCourseApplicationStateException(
                    "You cannot apply to your own course."
            );
        }

        User applicant = userRepository.findById(applicantId)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + applicantId));

        String message = normalizeMessage(request);

        MentorCourseApplication application = mentorCourseApplicationRepository
                .findByCourse_IdAndApplicant_Id(courseId, applicantId)
                .map(existingApplication -> {
                    existingApplication.resubmit(message);
                    return existingApplication;
                })
                .orElseGet(() -> MentorCourseApplication.create(course, applicant, message));

        return MentorCourseApplicationResponse.from(mentorCourseApplicationRepository.save(application));
    }

    @Transactional(readOnly = true)
    public List<MentorCourseApplicationResponse> getMyApplications(AuthUserPrincipal authUser) {
        Long applicantId = extractCurrentUserId(authUser);

        return mentorCourseApplicationRepository.findAllByApplicant_IdOrderByCreatedAtDescIdDesc(applicantId)
                .stream()
                .map(MentorCourseApplicationResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MentorCourseApplicationResponse> getReceivedApplications(AuthUserPrincipal authUser) {
        Long mentorId = extractCurrentUserId(authUser);
        ensureMentor(authUser);

        return mentorCourseApplicationRepository.findAllByCourse_Mentor_IdOrderByCreatedAtDescIdDesc(mentorId)
                .stream()
                .map(MentorCourseApplicationResponse::from)
                .toList();
    }

    @Transactional
    public MentorCourseApplicationResponse approveApplication(
            AuthUserPrincipal authUser,
            Long applicationId,
            MentorCourseApplicationReviewRequest request
    ) {
        Long mentorId = extractCurrentUserId(authUser);
        MentorCourseApplication application = getApplicationOrThrow(applicationId);

        if (!application.isMentor(mentorId)) {
            throw new MentorCourseApplicationAccessDeniedException(
                    "Only the mentor can approve this course application."
            );
        }

        long approvedCount = mentorCourseApplicationRepository.countByCourse_IdAndStatus(
                application.getCourse().getId(),
                MentorCourseApplicationStatus.APPROVED
        );

        if (approvedCount >= application.getCourse().getCapacity()) {
            throw new InvalidMentorCourseApplicationStateException("This course is already full.");
        }

        application.approve(normalizeReviewNote(request));
        return MentorCourseApplicationResponse.from(application);
    }

    @Transactional
    public MentorCourseApplicationResponse rejectApplication(
            AuthUserPrincipal authUser,
            Long applicationId,
            MentorCourseApplicationReviewRequest request
    ) {
        Long mentorId = extractCurrentUserId(authUser);
        MentorCourseApplication application = getApplicationOrThrow(applicationId);

        if (!application.isMentor(mentorId)) {
            throw new MentorCourseApplicationAccessDeniedException(
                    "Only the mentor can reject this course application."
            );
        }

        application.reject(normalizeReviewNote(request));
        return MentorCourseApplicationResponse.from(application);
    }

    @Transactional
    public MentorCourseApplicationResponse cancelApplication(AuthUserPrincipal authUser, Long applicationId) {
        Long applicantId = extractCurrentUserId(authUser);
        MentorCourseApplication application = getApplicationOrThrow(applicationId);

        if (!application.isApplicant(applicantId)) {
            throw new MentorCourseApplicationAccessDeniedException(
                    "Only the applicant can cancel this course application."
            );
        }

        application.cancel();
        return MentorCourseApplicationResponse.from(application);
    }

    private void ensureMentor(AuthUserPrincipal authUser) {
        if (authUser == null || (authUser.role() != UserRole.MENTOR && authUser.role() != UserRole.ADMIN)) {
            throw new MentorCourseApplicationAccessDeniedException(
                    "Only mentors can review course applications."
            );
        }
    }

    private Long extractCurrentUserId(AuthUserPrincipal authUser) {
        if (authUser == null || authUser.id() == null) {
            throw new MentorCourseApplicationAccessDeniedException("Authentication is required.");
        }

        return authUser.id();
    }

    private MentorCourse getCourseOrThrow(Long courseId) {
        return mentorCourseRepository.findById(courseId)
                .orElseThrow(() -> new MentorCourseNotFoundException(courseId));
    }

    private MentorCourseApplication getApplicationOrThrow(Long applicationId) {
        return mentorCourseApplicationRepository.findById(applicationId)
                .orElseThrow(() -> new MentorCourseApplicationNotFoundException(applicationId));
    }

    private String normalizeMessage(MentorCourseApplicationCreateRequest request) {
        if (request == null || request.message() == null) {
            return "";
        }

        return request.message().trim();
    }

    private String normalizeReviewNote(MentorCourseApplicationReviewRequest request) {
        if (request == null || request.reviewNote() == null) {
            return null;
        }

        String reviewNote = request.reviewNote().trim();
        return reviewNote.isBlank() ? null : reviewNote;
    }
}
