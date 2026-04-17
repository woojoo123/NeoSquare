package com.neosquare.mentor;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MentorCourseQueryService {

    private final MentorCourseRepository mentorCourseRepository;
    private final MentorCourseApplicationRepository mentorCourseApplicationRepository;
    private final MentorCourseCurriculumItemRepository mentorCourseCurriculumItemRepository;

    public MentorCourseQueryService(
            MentorCourseRepository mentorCourseRepository,
            MentorCourseApplicationRepository mentorCourseApplicationRepository,
            MentorCourseCurriculumItemRepository mentorCourseCurriculumItemRepository
    ) {
        this.mentorCourseRepository = mentorCourseRepository;
        this.mentorCourseApplicationRepository = mentorCourseApplicationRepository;
        this.mentorCourseCurriculumItemRepository = mentorCourseCurriculumItemRepository;
    }

    @Transactional(readOnly = true)
    public MentorCourseDetailResponse getCourseDetail(Long courseId) {
        MentorCourse course = mentorCourseRepository.findById(courseId)
                .orElseThrow(() -> new MentorCourseNotFoundException(courseId));

        int approvedApplicationCount = Math.toIntExact(mentorCourseApplicationRepository.countByCourse_IdAndStatus(
                course.getId(),
                MentorCourseApplicationStatus.APPROVED
        ));

        List<MentorCourseCurriculumItemResponse> curriculumItems = mentorCourseCurriculumItemRepository
                .findAllByCourse_IdOrderBySequenceAscIdAsc(course.getId())
                .stream()
                .map(MentorCourseCurriculumItemResponse::from)
                .toList();

        return MentorCourseDetailResponse.of(
                course,
                course.getMentor(),
                approvedApplicationCount,
                curriculumItems
        );
    }
}
