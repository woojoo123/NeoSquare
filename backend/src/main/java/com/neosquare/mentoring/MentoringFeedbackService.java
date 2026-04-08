package com.neosquare.mentoring;

import java.util.List;
import java.util.Objects;

import com.neosquare.auth.AuthUserPrincipal;
import com.neosquare.user.User;
import com.neosquare.user.UserRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MentoringFeedbackService {

    private final MentoringFeedbackRepository mentoringFeedbackRepository;
    private final MentoringRequestRepository mentoringRequestRepository;
    private final UserRepository userRepository;

    public MentoringFeedbackService(
            MentoringFeedbackRepository mentoringFeedbackRepository,
            MentoringRequestRepository mentoringRequestRepository,
            UserRepository userRepository
    ) {
        this.mentoringFeedbackRepository = mentoringFeedbackRepository;
        this.mentoringRequestRepository = mentoringRequestRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public MentoringFeedbackResponse createFeedback(
            AuthUserPrincipal authUser,
            MentoringFeedbackCreateRequest request
    ) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringRequest mentoringRequest = getRequestOrThrow(request.requestId());

        if (!mentoringRequest.isParticipant(currentUserId)) {
            throw new MentoringFeedbackAccessDeniedException(
                    "You can only leave feedback for your own mentoring session."
            );
        }

        if (mentoringFeedbackRepository.existsByRequest_IdAndAuthor_Id(request.requestId(), currentUserId)) {
            throw new DuplicateMentoringFeedbackException(request.requestId());
        }

        User author = userRepository.findById(currentUserId)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + currentUserId));
        User targetUser = resolveTargetUser(mentoringRequest, currentUserId);

        MentoringFeedback mentoringFeedback = MentoringFeedback.create(
                mentoringRequest,
                author,
                targetUser,
                request.rating(),
                normalizeText(request.summary()),
                normalizeText(request.feedback())
        );
        MentoringFeedback savedFeedback = mentoringFeedbackRepository.save(mentoringFeedback);

        return MentoringFeedbackResponse.from(savedFeedback);
    }

    @Transactional(readOnly = true)
    public List<MentoringFeedbackResponse> getMyFeedbacks(AuthUserPrincipal authUser) {
        Long currentUserId = extractCurrentUserId(authUser);

        return mentoringFeedbackRepository.findAllByAuthor_IdOrderByCreatedAtDescIdDesc(currentUserId).stream()
                .map(MentoringFeedbackResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public MentoringFeedbackResponse getFeedback(AuthUserPrincipal authUser, Long feedbackId) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringFeedback mentoringFeedback = getFeedbackOrThrow(feedbackId);

        if (!mentoringFeedback.getRequest().isParticipant(currentUserId)) {
            throw new MentoringFeedbackAccessDeniedException("You do not have access to this session feedback.");
        }

        return MentoringFeedbackResponse.from(mentoringFeedback);
    }

    @Transactional(readOnly = true)
    public MentoringFeedbackResponse getFeedbackByRequest(AuthUserPrincipal authUser, Long requestId) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringRequest mentoringRequest = getRequestOrThrow(requestId);

        if (!mentoringRequest.isParticipant(currentUserId)) {
            throw new MentoringFeedbackAccessDeniedException("You do not have access to this mentoring request.");
        }

        MentoringFeedback mentoringFeedback = mentoringFeedbackRepository.findDetailByRequest_IdAndAuthor_Id(
                        requestId,
                        currentUserId
                )
                .orElseThrow(() -> new MentoringFeedbackNotFoundException(
                        "Session feedback not found for request: " + requestId
                ));

        return MentoringFeedbackResponse.from(mentoringFeedback);
    }

    private Long extractCurrentUserId(AuthUserPrincipal authUser) {
        if (authUser == null || authUser.id() == null) {
            throw new MentoringFeedbackAccessDeniedException("Authentication is required.");
        }

        return authUser.id();
    }

    private MentoringRequest getRequestOrThrow(Long requestId) {
        return mentoringRequestRepository.findDetailById(requestId)
                .orElseThrow(() -> new MentoringRequestNotFoundException(requestId));
    }

    private MentoringFeedback getFeedbackOrThrow(Long feedbackId) {
        return mentoringFeedbackRepository.findDetailById(feedbackId)
                .orElseThrow(() -> new MentoringFeedbackNotFoundException(feedbackId));
    }

    private User resolveTargetUser(MentoringRequest mentoringRequest, Long currentUserId) {
        if (Objects.equals(mentoringRequest.getRequester().getId(), currentUserId)) {
            return mentoringRequest.getMentor();
        }

        if (Objects.equals(mentoringRequest.getMentor().getId(), currentUserId)) {
            return mentoringRequest.getRequester();
        }

        throw new MentoringFeedbackAccessDeniedException(
                "You can only leave feedback for your own mentoring session."
        );
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim();
    }
}
