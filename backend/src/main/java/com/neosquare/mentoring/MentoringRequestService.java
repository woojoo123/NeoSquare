package com.neosquare.mentoring;

import java.util.List;
import java.util.Objects;

import com.neosquare.auth.AuthUserPrincipal;
import com.neosquare.user.User;
import com.neosquare.user.UserRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MentoringRequestService {

    private final MentoringRequestRepository mentoringRequestRepository;
    private final UserRepository userRepository;

    public MentoringRequestService(
            MentoringRequestRepository mentoringRequestRepository,
            UserRepository userRepository
    ) {
        this.mentoringRequestRepository = mentoringRequestRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public MentoringRequestResponse createRequest(
            AuthUserPrincipal authUser,
            MentoringRequestCreateRequest request
    ) {
        Long requesterId = extractCurrentUserId(authUser);

        if (Objects.equals(requesterId, request.mentorId())) {
            throw new SelfMentoringRequestException();
        }

        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + requesterId));
        User mentor = userRepository.findById(request.mentorId())
                .orElseThrow(() -> new UserNotFoundException("Mentor not found: " + request.mentorId()));

        MentoringRequest mentoringRequest = MentoringRequest.create(
                requester,
                mentor,
                request.message().trim()
        );
        MentoringRequest savedRequest = mentoringRequestRepository.save(mentoringRequest);

        return MentoringRequestResponse.from(savedRequest);
    }

    @Transactional(readOnly = true)
    public List<MentoringRequestResponse> getSentRequests(AuthUserPrincipal authUser) {
        Long requesterId = extractCurrentUserId(authUser);

        return mentoringRequestRepository.findAllByRequester_IdOrderByCreatedAtDescIdDesc(requesterId).stream()
                .map(MentoringRequestResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MentoringRequestResponse> getReceivedRequests(AuthUserPrincipal authUser) {
        Long mentorId = extractCurrentUserId(authUser);

        return mentoringRequestRepository.findAllByMentor_IdOrderByCreatedAtDescIdDesc(mentorId).stream()
                .map(MentoringRequestResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public MentoringRequestResponse getRequest(AuthUserPrincipal authUser, Long requestId) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringRequest mentoringRequest = getRequestOrThrow(requestId);

        if (!mentoringRequest.isParticipant(currentUserId)) {
            throw new MentoringRequestAccessDeniedException("You do not have access to this mentoring request.");
        }

        return MentoringRequestResponse.from(mentoringRequest);
    }

    @Transactional
    public MentoringRequestResponse acceptRequest(AuthUserPrincipal authUser, Long requestId) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringRequest mentoringRequest = getRequestOrThrow(requestId);

        if (!mentoringRequest.isMentor(currentUserId)) {
            throw new MentoringRequestAccessDeniedException("Only the mentor can accept this mentoring request.");
        }

        mentoringRequest.accept();

        return MentoringRequestResponse.from(mentoringRequest);
    }

    @Transactional
    public MentoringRequestResponse rejectRequest(AuthUserPrincipal authUser, Long requestId) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringRequest mentoringRequest = getRequestOrThrow(requestId);

        if (!mentoringRequest.isMentor(currentUserId)) {
            throw new MentoringRequestAccessDeniedException("Only the mentor can reject this mentoring request.");
        }

        mentoringRequest.reject();

        return MentoringRequestResponse.from(mentoringRequest);
    }

    private Long extractCurrentUserId(AuthUserPrincipal authUser) {
        if (authUser == null || authUser.id() == null) {
            throw new MentoringRequestAccessDeniedException("Authentication is required.");
        }

        return authUser.id();
    }

    private MentoringRequest getRequestOrThrow(Long requestId) {
        return mentoringRequestRepository.findDetailById(requestId)
                .orElseThrow(() -> new MentoringRequestNotFoundException(requestId));
    }
}
