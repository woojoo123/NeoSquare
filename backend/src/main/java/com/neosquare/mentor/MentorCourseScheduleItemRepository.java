package com.neosquare.mentor;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MentorCourseScheduleItemRepository extends JpaRepository<MentorCourseScheduleItem, Long> {

    List<MentorCourseScheduleItem> findAllByCourse_IdOrderBySequenceAscIdAsc(Long courseId);

    void deleteAllByCourse_Id(Long courseId);
}
