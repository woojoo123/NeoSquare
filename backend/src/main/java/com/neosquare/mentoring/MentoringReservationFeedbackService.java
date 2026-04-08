package com.neosquare.mentoring;

import java.util.List;
import java.util.Objects;

import com.neosquare.auth.AuthUserPrincipal;
import com.neosquare.user.User;
import com.neosquare.user.UserRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MentoringReservationFeedbackService {

    private final MentoringReservationFeedbackRepository mentoringReservationFeedbackRepository;
    private final MentoringReservationRepository mentoringReservationRepository;
    private final UserRepository userRepository;

    public MentoringReservationFeedbackService(
            MentoringReservationFeedbackRepository mentoringReservationFeedbackRepository,
            MentoringReservationRepository mentoringReservationRepository,
            UserRepository userRepository
    ) {
        this.mentoringReservationFeedbackRepository = mentoringReservationFeedbackRepository;
        this.mentoringReservationRepository = mentoringReservationRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public MentoringReservationFeedbackResponse createFeedback(
            AuthUserPrincipal authUser,
            MentoringReservationFeedbackCreateRequest request
    ) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringReservation reservation = getReservationOrThrow(request.reservationId());

        if (!reservation.isParticipant(currentUserId)) {
            throw new MentoringReservationFeedbackAccessDeniedException(
                    "You can only leave feedback for your own reservation session."
            );
        }

        if (mentoringReservationFeedbackRepository.existsByReservation_IdAndAuthor_Id(
                request.reservationId(),
                currentUserId
        )) {
            throw new DuplicateMentoringReservationFeedbackException(request.reservationId());
        }

        User author = userRepository.findById(currentUserId)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + currentUserId));
        User targetUser = resolveTargetUser(reservation, currentUserId);

        MentoringReservationFeedback reservationFeedback = MentoringReservationFeedback.create(
                reservation,
                author,
                targetUser,
                request.rating(),
                normalizeText(request.summary()),
                normalizeText(request.feedback())
        );
        MentoringReservationFeedback savedFeedback = mentoringReservationFeedbackRepository.save(reservationFeedback);

        return MentoringReservationFeedbackResponse.from(savedFeedback);
    }

    @Transactional(readOnly = true)
    public List<MentoringReservationFeedbackResponse> getMyFeedbacks(AuthUserPrincipal authUser) {
        Long currentUserId = extractCurrentUserId(authUser);

        return mentoringReservationFeedbackRepository.findAllByAuthor_IdOrderByCreatedAtDescIdDesc(currentUserId)
                .stream()
                .map(MentoringReservationFeedbackResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public MentoringReservationFeedbackResponse getFeedback(AuthUserPrincipal authUser, Long feedbackId) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringReservationFeedback reservationFeedback = getFeedbackOrThrow(feedbackId);

        if (!reservationFeedback.getReservation().isParticipant(currentUserId)) {
            throw new MentoringReservationFeedbackAccessDeniedException(
                    "You do not have access to this reservation feedback."
            );
        }

        return MentoringReservationFeedbackResponse.from(reservationFeedback);
    }

    @Transactional(readOnly = true)
    public MentoringReservationFeedbackResponse getFeedbackByReservation(
            AuthUserPrincipal authUser,
            Long reservationId
    ) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringReservation reservation = getReservationOrThrow(reservationId);

        if (!reservation.isParticipant(currentUserId)) {
            throw new MentoringReservationFeedbackAccessDeniedException(
                    "You do not have access to this reservation."
            );
        }

        MentoringReservationFeedback reservationFeedback =
                mentoringReservationFeedbackRepository.findDetailByReservation_IdAndAuthor_Id(
                                reservationId,
                                currentUserId
                        )
                        .orElseThrow(() -> new MentoringReservationFeedbackNotFoundException(
                                "Reservation feedback not found for reservation: " + reservationId
                        ));

        return MentoringReservationFeedbackResponse.from(reservationFeedback);
    }

    private Long extractCurrentUserId(AuthUserPrincipal authUser) {
        if (authUser == null || authUser.id() == null) {
            throw new MentoringReservationFeedbackAccessDeniedException("Authentication is required.");
        }

        return authUser.id();
    }

    private MentoringReservation getReservationOrThrow(Long reservationId) {
        return mentoringReservationRepository.findDetailById(reservationId)
                .orElseThrow(() -> new MentoringReservationNotFoundException(reservationId));
    }

    private MentoringReservationFeedback getFeedbackOrThrow(Long feedbackId) {
        return mentoringReservationFeedbackRepository.findDetailById(feedbackId)
                .orElseThrow(() -> new MentoringReservationFeedbackNotFoundException(feedbackId));
    }

    private User resolveTargetUser(MentoringReservation reservation, Long currentUserId) {
        if (Objects.equals(reservation.getRequester().getId(), currentUserId)) {
            return reservation.getMentor();
        }

        if (Objects.equals(reservation.getMentor().getId(), currentUserId)) {
            return reservation.getRequester();
        }

        throw new MentoringReservationFeedbackAccessDeniedException(
                "You can only leave feedback for your own reservation session."
        );
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim();
    }
}
