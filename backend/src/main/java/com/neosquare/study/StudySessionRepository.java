package com.neosquare.study;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudySessionRepository extends JpaRepository<StudySession, Long> {

    @EntityGraph(attributePaths = {"host", "space", "participants", "participants.user"})
    Optional<StudySession> findDetailById(Long id);

    @EntityGraph(attributePaths = {"host", "space", "participants", "participants.user"})
    List<StudySession> findAllBySpace_IdAndStatusOrderByCreatedAtDescIdDesc(
            Long spaceId,
            StudySessionStatus status
    );

    @EntityGraph(attributePaths = {"host", "space", "participants", "participants.user"})
    List<StudySession> findAllBySpace_IdAndStatusInOrderByCreatedAtDescIdDesc(
            Long spaceId,
            List<StudySessionStatus> statuses
    );

    @EntityGraph(attributePaths = {"host", "space", "participants", "participants.user"})
    @Query("""
            select distinct studySession
            from StudySession studySession
            join studySession.participants participant
            where participant.user.id = :userId
            order by studySession.createdAt desc, studySession.id desc
            """)
    List<StudySession> findAllByParticipantUserIdOrderByCreatedAtDescIdDesc(@Param("userId") Long userId);
}
