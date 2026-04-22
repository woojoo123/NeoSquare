package com.neosquare.study;

import java.util.List;

import com.neosquare.auth.AuthUserPrincipal;
import com.neosquare.mentoring.UserNotFoundException;
import com.neosquare.space.Space;
import com.neosquare.space.SpaceNotFoundException;
import com.neosquare.space.SpaceRepository;
import com.neosquare.space.SpaceType;
import com.neosquare.user.User;
import com.neosquare.user.UserRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StudySessionService {

    private final StudySessionRepository studySessionRepository;
    private final UserRepository userRepository;
    private final SpaceRepository spaceRepository;

    public StudySessionService(
            StudySessionRepository studySessionRepository,
            UserRepository userRepository,
            SpaceRepository spaceRepository
    ) {
        this.studySessionRepository = studySessionRepository;
        this.userRepository = userRepository;
        this.spaceRepository = spaceRepository;
    }

    @Transactional
    public StudySessionResponse createStudySession(
            AuthUserPrincipal authUser,
            StudySessionCreateRequest request
    ) {
        Long currentUserId = extractCurrentUserId(authUser);
        User host = getUserOrThrow(currentUserId);
        Space space = getStudySpaceOrThrow(request.spaceId());
        String description = request.description() == null ? "" : request.description().trim();

        StudySession studySession = StudySession.create(
                host,
                space,
                request.title().trim(),
                description
        );

        StudySession savedStudySession = studySessionRepository.save(studySession);

        return StudySessionResponse.from(savedStudySession, currentUserId);
    }

    @Transactional(readOnly = true)
    public List<StudySessionResponse> getMyStudySessions(AuthUserPrincipal authUser) {
        Long currentUserId = extractCurrentUserId(authUser);

        return studySessionRepository.findAllByParticipantUserIdOrderByCreatedAtDescIdDesc(currentUserId).stream()
                .map(studySession -> StudySessionResponse.from(studySession, currentUserId))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StudySessionResponse> getStudySessionsBySpace(AuthUserPrincipal authUser, Long spaceId) {
        Long currentUserId = extractCurrentUserId(authUser);
        getStudySpaceOrThrow(spaceId);

        return studySessionRepository.findAllBySpace_IdAndStatusOrderByCreatedAtDescIdDesc(
                        spaceId,
                        StudySessionStatus.ACTIVE
                ).stream()
                .map(studySession -> StudySessionResponse.from(studySession, currentUserId))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StudySessionResponse> getOpenStudySessionsBySpace(AuthUserPrincipal authUser, Long spaceId) {
        Long currentUserId = extractCurrentUserId(authUser);
        getStudySpaceOrThrow(spaceId);

        return studySessionRepository.findAllBySpace_IdAndStatusInOrderByCreatedAtDescIdDesc(
                        spaceId,
                        List.of(StudySessionStatus.RECRUITING, StudySessionStatus.READY)
                ).stream()
                .map(studySession -> StudySessionResponse.from(studySession, currentUserId))
                .toList();
    }

    @Transactional(readOnly = true)
    public StudySessionResponse getStudySession(AuthUserPrincipal authUser, Long studySessionId) {
        Long currentUserId = extractCurrentUserId(authUser);
        StudySession studySession = getStudySessionOrThrow(studySessionId);

        if (!studySession.isParticipant(currentUserId)) {
            throw new StudySessionAccessDeniedException(
                    "Only study session participants can view this study session."
            );
        }

        return StudySessionResponse.from(studySession, currentUserId);
    }

    @Transactional
    public StudySessionResponse joinStudySession(AuthUserPrincipal authUser, Long studySessionId) {
        Long currentUserId = extractCurrentUserId(authUser);
        StudySession studySession = getStudySessionOrThrow(studySessionId);
        User participant = getUserOrThrow(currentUserId);

        studySession.join(participant);

        return StudySessionResponse.from(studySession, currentUserId);
    }

    @Transactional
    public StudySessionResponse startStudySession(AuthUserPrincipal authUser, Long studySessionId) {
        Long currentUserId = extractCurrentUserId(authUser);
        StudySession studySession = getStudySessionOrThrow(studySessionId);

        if (!studySession.isHost(currentUserId)) {
            throw new StudySessionAccessDeniedException("Only the host can start this study session.");
        }

        studySession.start();

        return StudySessionResponse.from(studySession, currentUserId);
    }

    @Transactional
    public StudySessionResponse completeStudySession(AuthUserPrincipal authUser, Long studySessionId) {
        Long currentUserId = extractCurrentUserId(authUser);
        StudySession studySession = getStudySessionOrThrow(studySessionId);

        if (!studySession.isHost(currentUserId)) {
            throw new StudySessionAccessDeniedException("Only the host can complete this study session.");
        }

        studySession.complete();

        return StudySessionResponse.from(studySession, currentUserId);
    }

    private Long extractCurrentUserId(AuthUserPrincipal authUser) {
        if (authUser == null || authUser.id() == null) {
            throw new StudySessionAccessDeniedException("Authentication is required.");
        }

        return authUser.id();
    }

    private User getUserOrThrow(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + userId));
    }

    private Space getStudySpaceOrThrow(Long spaceId) {
        Space space = spaceRepository.findById(spaceId)
                .orElseThrow(() -> new SpaceNotFoundException(spaceId));

        if (space.getType() != SpaceType.STUDY) {
            throw new InvalidStudySessionRequestException("Study sessions can only be created in study spaces.");
        }

        return space;
    }

    private StudySession getStudySessionOrThrow(Long studySessionId) {
        return studySessionRepository.findDetailById(studySessionId)
                .orElseThrow(() -> new StudySessionNotFoundException(studySessionId));
    }
}
