package com.neosquare.mentor;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MentorApplicationRepository extends JpaRepository<MentorApplication, Long> {

    @EntityGraph(attributePaths = {"user"})
    Optional<MentorApplication> findByUser_Id(Long userId);

    @EntityGraph(attributePaths = {"user"})
    List<MentorApplication> findAllByStatusOrderByCreatedAtAscIdAsc(MentorApplicationStatus status);
}
