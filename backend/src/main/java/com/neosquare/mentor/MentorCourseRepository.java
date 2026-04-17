package com.neosquare.mentor;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MentorCourseRepository extends JpaRepository<MentorCourse, Long> {

    List<MentorCourse> findAllByMentor_Id(Long mentorId);

    List<MentorCourse> findAllByMentor_IdAndStatus(Long mentorId, MentorCourseStatus status);

    Optional<MentorCourse> findByIdAndMentor_Id(Long courseId, Long mentorId);
}
