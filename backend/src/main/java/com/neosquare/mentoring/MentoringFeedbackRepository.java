package com.neosquare.mentoring;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MentoringFeedbackRepository extends JpaRepository<MentoringFeedback, Long> {

    @EntityGraph(attributePaths = {"request", "request.requester", "request.mentor", "author", "targetUser"})
    List<MentoringFeedback> findAllByAuthor_IdOrderByCreatedAtDescIdDesc(Long authorId);

    @EntityGraph(attributePaths = {"request", "request.requester", "request.mentor", "author", "targetUser"})
    Optional<MentoringFeedback> findDetailById(Long id);

    @EntityGraph(attributePaths = {"request", "request.requester", "request.mentor", "author", "targetUser"})
    Optional<MentoringFeedback> findDetailByRequest_IdAndAuthor_Id(Long requestId, Long authorId);

    boolean existsByRequest_IdAndAuthor_Id(Long requestId, Long authorId);
}
