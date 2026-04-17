package com.neosquare.mentor;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MentorCourseApplicationRepository extends JpaRepository<MentorCourseApplication, Long> {

    List<MentorCourseApplication> findAllByApplicant_IdOrderByCreatedAtDescIdDesc(Long applicantId);

    List<MentorCourseApplication> findAllByCourse_Mentor_IdOrderByCreatedAtDescIdDesc(Long mentorId);

    List<MentorCourseApplication> findAllByCourse_IdAndStatusOrderByCreatedAtDescIdDesc(
            Long courseId,
            MentorCourseApplicationStatus status
    );

    @EntityGraph(attributePaths = {"course", "course.mentor", "applicant", "preferredScheduleItem", "assignedScheduleItem"})
    Optional<MentorCourseApplication> findDetailById(Long applicationId);

    Optional<MentorCourseApplication> findByCourse_IdAndApplicant_Id(Long courseId, Long applicantId);

    long countByCourse_IdAndStatus(Long courseId, MentorCourseApplicationStatus status);
}
