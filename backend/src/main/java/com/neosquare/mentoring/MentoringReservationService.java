package com.neosquare.mentoring;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

import com.neosquare.auth.AuthUserPrincipal;
import com.neosquare.user.User;
import com.neosquare.user.UserRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MentoringReservationService {

    private final MentoringReservationRepository mentoringReservationRepository;
    private final UserRepository userRepository;

    public MentoringReservationService(
            MentoringReservationRepository mentoringReservationRepository,
            UserRepository userRepository
    ) {
        this.mentoringReservationRepository = mentoringReservationRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public MentoringReservationResponse createReservation(
            AuthUserPrincipal authUser,
            MentoringReservationCreateRequest request
    ) {
        Long requesterId = extractCurrentUserId(authUser);

        if (Objects.equals(requesterId, request.mentorId())) {
            throw new SelfMentoringReservationException();
        }

        if (!request.reservedAt().isAfter(Instant.now())) {
            throw new InvalidReservationTimeException("Reservation time must be in the future.");
        }

        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + requesterId));
        User mentor = userRepository.findById(request.mentorId())
                .orElseThrow(() -> new UserNotFoundException("Mentor not found: " + request.mentorId()));

        String message = request.message() == null ? "" : request.message().trim();

        MentoringReservation reservation = MentoringReservation.create(
                requester,
                mentor,
                request.reservedAt(),
                message
        );
        MentoringReservation savedReservation = mentoringReservationRepository.save(reservation);

        return MentoringReservationResponse.from(savedReservation);
    }

    @Transactional(readOnly = true)
    public List<MentoringReservationResponse> getMyReservations(AuthUserPrincipal authUser) {
        Long requesterId = extractCurrentUserId(authUser);

        return mentoringReservationRepository.findAllByRequester_IdOrderByReservedAtAscCreatedAtDescIdDesc(requesterId)
                .stream()
                .map(MentoringReservationResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MentoringReservationResponse> getReceivedReservations(AuthUserPrincipal authUser) {
        Long mentorId = extractCurrentUserId(authUser);

        return mentoringReservationRepository.findAllByMentor_IdOrderByReservedAtAscCreatedAtDescIdDesc(mentorId)
                .stream()
                .map(MentoringReservationResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public MentoringReservationResponse getReservation(AuthUserPrincipal authUser, Long reservationId) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringReservation reservation = getReservationOrThrow(reservationId);

        if (!reservation.isParticipant(currentUserId)) {
            throw new MentoringReservationAccessDeniedException("You do not have access to this reservation.");
        }

        return MentoringReservationResponse.from(reservation);
    }

    @Transactional
    public MentoringReservationResponse acceptReservation(AuthUserPrincipal authUser, Long reservationId) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringReservation reservation = getReservationOrThrow(reservationId);

        if (!reservation.isMentor(currentUserId)) {
            throw new MentoringReservationAccessDeniedException("Only the mentor can accept this reservation.");
        }

        reservation.accept();

        return MentoringReservationResponse.from(reservation);
    }

    @Transactional
    public MentoringReservationResponse rejectReservation(AuthUserPrincipal authUser, Long reservationId) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringReservation reservation = getReservationOrThrow(reservationId);

        if (!reservation.isMentor(currentUserId)) {
            throw new MentoringReservationAccessDeniedException("Only the mentor can reject this reservation.");
        }

        reservation.reject();

        return MentoringReservationResponse.from(reservation);
    }

    @Transactional
    public MentoringReservationResponse cancelReservation(AuthUserPrincipal authUser, Long reservationId) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringReservation reservation = getReservationOrThrow(reservationId);

        if (!reservation.isRequester(currentUserId)) {
            throw new MentoringReservationAccessDeniedException("Only the requester can cancel this reservation.");
        }

        reservation.cancel();

        return MentoringReservationResponse.from(reservation);
    }

    private Long extractCurrentUserId(AuthUserPrincipal authUser) {
        if (authUser == null || authUser.id() == null) {
            throw new MentoringReservationAccessDeniedException("Authentication is required.");
        }

        return authUser.id();
    }

    private MentoringReservation getReservationOrThrow(Long reservationId) {
        return mentoringReservationRepository.findDetailById(reservationId)
                .orElseThrow(() -> new MentoringReservationNotFoundException(reservationId));
    }
}
