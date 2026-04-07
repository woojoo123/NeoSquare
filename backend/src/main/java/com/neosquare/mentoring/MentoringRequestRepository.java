package com.neosquare.mentoring;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MentoringRequestRepository extends JpaRepository<MentoringRequest, Long> {

    @EntityGraph(attributePaths = {"requester", "mentor"})
    List<MentoringRequest> findAllByRequester_IdOrderByCreatedAtDescIdDesc(Long requesterId);

    @EntityGraph(attributePaths = {"requester", "mentor"})
    List<MentoringRequest> findAllByMentor_IdOrderByCreatedAtDescIdDesc(Long mentorId);

    @EntityGraph(attributePaths = {"requester", "mentor"})
    Optional<MentoringRequest> findDetailById(Long id);
}
