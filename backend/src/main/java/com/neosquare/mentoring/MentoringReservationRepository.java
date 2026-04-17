package com.neosquare.mentoring;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MentoringReservationRepository extends JpaRepository<MentoringReservation, Long> {

    @EntityGraph(attributePaths = {"requester", "mentor"})
    List<MentoringReservation> findAllByRequester_IdOrderByReservedAtAscCreatedAtDescIdDesc(Long requesterId);

    @EntityGraph(attributePaths = {"requester", "mentor"})
    List<MentoringReservation> findAllByRequester_IdAndStatusIn(Long requesterId, Set<MentoringReservationStatus> statuses);

    @EntityGraph(attributePaths = {"requester", "mentor"})
    List<MentoringReservation> findAllByMentor_IdOrderByReservedAtAscCreatedAtDescIdDesc(Long mentorId);

    @EntityGraph(attributePaths = {"requester", "mentor"})
    List<MentoringReservation> findAllByMentor_IdAndStatusIn(Long mentorId, Set<MentoringReservationStatus> statuses);

    @EntityGraph(attributePaths = {"requester", "mentor"})
    Optional<MentoringReservation> findDetailById(Long id);
}
