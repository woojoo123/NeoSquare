package com.neosquare.mentoring;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MentoringReservationFeedbackRepository extends JpaRepository<MentoringReservationFeedback, Long> {

    @EntityGraph(attributePaths = {
            "reservation",
            "reservation.requester",
            "reservation.mentor",
            "author",
            "targetUser"
    })
    List<MentoringReservationFeedback> findAllByAuthor_IdOrderByCreatedAtDescIdDesc(Long authorId);

    @EntityGraph(attributePaths = {
            "reservation",
            "reservation.requester",
            "reservation.mentor",
            "author",
            "targetUser"
    })
    Optional<MentoringReservationFeedback> findDetailById(Long id);

    @EntityGraph(attributePaths = {
            "reservation",
            "reservation.requester",
            "reservation.mentor",
            "author",
            "targetUser"
    })
    Optional<MentoringReservationFeedback> findDetailByReservation_IdAndAuthor_Id(Long reservationId, Long authorId);

    boolean existsByReservation_IdAndAuthor_Id(Long reservationId, Long authorId);
}
