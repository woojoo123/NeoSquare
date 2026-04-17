package com.neosquare.mentor;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MentorCourseCurriculumItemRepository extends JpaRepository<MentorCourseCurriculumItem, Long> {

    List<MentorCourseCurriculumItem> findAllByCourse_IdOrderBySequenceAscIdAsc(Long courseId);

    void deleteAllByCourse_Id(Long courseId);
}
