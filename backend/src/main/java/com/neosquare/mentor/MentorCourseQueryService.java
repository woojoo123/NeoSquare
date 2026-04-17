package com.neosquare.mentor;

import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MentorCourseQueryService {

    private final MentorCourseRepository mentorCourseRepository;
    private final MentorCourseApplicationRepository mentorCourseApplicationRepository;
    private final MentorCourseCurriculumItemRepository mentorCourseCurriculumItemRepository;
    private final MentorCourseScheduleItemRepository mentorCourseScheduleItemRepository;

    public MentorCourseQueryService(
            MentorCourseRepository mentorCourseRepository,
            MentorCourseApplicationRepository mentorCourseApplicationRepository,
            MentorCourseCurriculumItemRepository mentorCourseCurriculumItemRepository,
            MentorCourseScheduleItemRepository mentorCourseScheduleItemRepository
    ) {
        this.mentorCourseRepository = mentorCourseRepository;
        this.mentorCourseApplicationRepository = mentorCourseApplicationRepository;
        this.mentorCourseCurriculumItemRepository = mentorCourseCurriculumItemRepository;
        this.mentorCourseScheduleItemRepository = mentorCourseScheduleItemRepository;
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
        List<MentorCourseApplication> approvedApplications = mentorCourseApplicationRepository
                .findAllByCourse_IdAndStatusOrderByCreatedAtDescIdDesc(
                        course.getId(),
                        MentorCourseApplicationStatus.APPROVED
                );

        List<MentorCourseScheduleItemResponse> scheduleItems = mentorCourseScheduleItemRepository
                .findAllByCourse_IdOrderBySequenceAscIdAsc(course.getId())
                .stream()
                .map(scheduleItem -> {
                    List<String> approvedApplicantNicknames = approvedApplications.stream()
                            .filter(application -> application.getAssignedScheduleItem() != null)
                            .filter(application ->
                                    Objects.equals(
                                            application.getAssignedScheduleItem().getId(),
                                            scheduleItem.getId()
                                    )
                            )
                            .map(application -> application.getApplicant().getNickname())
                            .toList();

                    return MentorCourseScheduleItemResponse.from(
                            scheduleItem,
                            approvedApplicantNicknames.size(),
                            approvedApplicantNicknames
                    );
                })
                .toList();

        return MentorCourseDetailResponse.of(
                course,
                course.getMentor(),
                approvedApplicationCount,
                curriculumItems,
                scheduleItems
        );
    }
}
