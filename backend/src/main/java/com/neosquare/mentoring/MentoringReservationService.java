package com.neosquare.mentoring;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

import com.neosquare.auth.AuthUserPrincipal;
import com.neosquare.mentor.MentorManagementService;
import com.neosquare.notification.NotificationService;
import com.neosquare.user.User;
import com.neosquare.user.UserRepository;
import com.neosquare.user.UserRole;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MentoringReservationService {

    private final MentoringReservationRepository mentoringReservationRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final MentoringReservationSessionAccessPolicy mentoringReservationSessionAccessPolicy;
    private final MentoringReservationSchedulePolicy mentoringReservationSchedulePolicy;
    private final MentorManagementService mentorManagementService;

    public MentoringReservationService(
            MentoringReservationRepository mentoringReservationRepository,
            UserRepository userRepository,
            NotificationService notificationService,
            MentoringReservationSessionAccessPolicy mentoringReservationSessionAccessPolicy,
            MentoringReservationSchedulePolicy mentoringReservationSchedulePolicy,
            MentorManagementService mentorManagementService
    ) {
        this.mentoringReservationRepository = mentoringReservationRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.mentoringReservationSessionAccessPolicy = mentoringReservationSessionAccessPolicy;
        this.mentoringReservationSchedulePolicy = mentoringReservationSchedulePolicy;
        this.mentorManagementService = mentorManagementService;
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

        if (mentor.getRole() != UserRole.MENTOR && mentor.getRole() != UserRole.ADMIN) {
            throw new InvalidMentoringTargetRoleException();
        }

        mentorManagementService.validateReservationTime(mentor.getId(), request.reservedAt());

        mentoringReservationSchedulePolicy.validateCreation(
                request.reservedAt(),
                mentoringReservationRepository.findAllByRequester_IdAndStatusIn(
                        requesterId,
                        mentoringReservationSchedulePolicy.getCreateBlockingStatuses()
                ),
                mentoringReservationRepository.findAllByMentor_IdAndStatusIn(
                        mentor.getId(),
                        mentoringReservationSchedulePolicy.getCreateBlockingStatuses()
                )
        );

        String message = request.message() == null ? "" : request.message().trim();

        MentoringReservation reservation = MentoringReservation.create(
                requester,
                mentor,
                request.reservedAt(),
                message
        );
        MentoringReservation savedReservation = mentoringReservationRepository.save(reservation);

        return toResponse(savedReservation);
    }

    @Transactional(readOnly = true)
    public List<MentoringReservationResponse> getMyReservations(AuthUserPrincipal authUser) {
        Long requesterId = extractCurrentUserId(authUser);

        return mentoringReservationRepository.findAllByRequester_IdOrderByReservedAtAscCreatedAtDescIdDesc(requesterId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MentoringReservationResponse> getReceivedReservations(AuthUserPrincipal authUser) {
        Long mentorId = extractCurrentUserId(authUser);

        return mentoringReservationRepository.findAllByMentor_IdOrderByReservedAtAscCreatedAtDescIdDesc(mentorId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public MentoringReservationResponse getReservation(AuthUserPrincipal authUser, Long reservationId) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringReservation reservation = getReservationOrThrow(reservationId);

        if (!reservation.isParticipant(currentUserId)) {
            throw new MentoringReservationAccessDeniedException("You do not have access to this reservation.");
        }

        return toResponse(reservation);
    }

    @Transactional(readOnly = true)
    public MentoringReservationResponse getReservationSessionEntry(
            AuthUserPrincipal authUser,
            Long reservationId
    ) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringReservation reservation = getReservationOrThrow(reservationId);

        if (!reservation.isParticipant(currentUserId)) {
            throw new MentoringReservationAccessDeniedException("You do not have access to this reservation.");
        }

        mentoringReservationSessionAccessPolicy.validateSessionEntry(reservation);

        return toResponse(reservation);
    }

    @Transactional
    public MentoringReservationResponse acceptReservation(AuthUserPrincipal authUser, Long reservationId) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringReservation reservation = getReservationOrThrow(reservationId);

        if (!reservation.isMentor(currentUserId)) {
            throw new MentoringReservationAccessDeniedException("Only the mentor can accept this reservation.");
        }

        mentoringReservationSchedulePolicy.validateAcceptance(
                reservation,
                mentoringReservationRepository.findAllByRequester_IdAndStatusIn(
                        reservation.getRequester().getId(),
                        mentoringReservationSchedulePolicy.getAcceptBlockingStatuses()
                ),
                mentoringReservationRepository.findAllByMentor_IdAndStatusIn(
                        reservation.getMentor().getId(),
                        mentoringReservationSchedulePolicy.getAcceptBlockingStatuses()
                )
        );

        reservation.accept();
        notificationService.createReservationAcceptedNotification(reservation);

        return toResponse(reservation);
    }

    @Transactional
    public MentoringReservationResponse rejectReservation(AuthUserPrincipal authUser, Long reservationId) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringReservation reservation = getReservationOrThrow(reservationId);

        if (!reservation.isMentor(currentUserId)) {
            throw new MentoringReservationAccessDeniedException("Only the mentor can reject this reservation.");
        }

        reservation.reject();

        return toResponse(reservation);
    }

    @Transactional
    public MentoringReservationResponse cancelReservation(AuthUserPrincipal authUser, Long reservationId) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringReservation reservation = getReservationOrThrow(reservationId);

        if (!reservation.isRequester(currentUserId)) {
            throw new MentoringReservationAccessDeniedException("Only the requester can cancel this reservation.");
        }

        reservation.cancel();

        return toResponse(reservation);
    }

    @Transactional
    public MentoringReservationResponse completeReservation(AuthUserPrincipal authUser, Long reservationId) {
        Long currentUserId = extractCurrentUserId(authUser);
        MentoringReservation reservation = getReservationOrThrow(reservationId);

        if (!reservation.isParticipant(currentUserId)) {
            throw new MentoringReservationAccessDeniedException(
                    "Only session participants can complete this reservation."
            );
        }

        reservation.complete();

        return toResponse(reservation);
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

    private MentoringReservationResponse toResponse(MentoringReservation reservation) {
        return MentoringReservationResponse.from(
                reservation,
                mentoringReservationSessionAccessPolicy.resolveSessionWindow(reservation)
        );
    }
}
