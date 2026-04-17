package com.neosquare.user;

import java.util.List;
import java.util.Objects;

import com.neosquare.mentor.MentorAvailabilitySlotRepository;
import com.neosquare.mentor.MentorAvailabilitySlotResponse;
import com.neosquare.mentor.MentorCourseApplicationRepository;
import com.neosquare.mentor.MentorCourseApplicationStatus;
import com.neosquare.mentor.MentorCourseCurriculumItemRepository;
import com.neosquare.mentor.MentorCourseCurriculumItemResponse;
import com.neosquare.mentor.MentorCourseRepository;
import com.neosquare.mentor.MentorCourseScheduleItemRepository;
import com.neosquare.mentor.MentorCourseScheduleItemResponse;
import com.neosquare.mentor.MentorCourseResponse;
import com.neosquare.mentor.MentorCourseStatus;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final MentorAvailabilitySlotRepository mentorAvailabilitySlotRepository;
    private final MentorCourseRepository mentorCourseRepository;
    private final MentorCourseApplicationRepository mentorCourseApplicationRepository;
    private final MentorCourseCurriculumItemRepository mentorCourseCurriculumItemRepository;
    private final MentorCourseScheduleItemRepository mentorCourseScheduleItemRepository;

    public UserService(
            UserRepository userRepository,
            MentorAvailabilitySlotRepository mentorAvailabilitySlotRepository,
            MentorCourseRepository mentorCourseRepository,
            MentorCourseApplicationRepository mentorCourseApplicationRepository,
            MentorCourseCurriculumItemRepository mentorCourseCurriculumItemRepository,
            MentorCourseScheduleItemRepository mentorCourseScheduleItemRepository
    ) {
        this.userRepository = userRepository;
        this.mentorAvailabilitySlotRepository = mentorAvailabilitySlotRepository;
        this.mentorCourseRepository = mentorCourseRepository;
        this.mentorCourseApplicationRepository = mentorCourseApplicationRepository;
        this.mentorCourseCurriculumItemRepository = mentorCourseCurriculumItemRepository;
        this.mentorCourseScheduleItemRepository = mentorCourseScheduleItemRepository;
    }

    @Transactional(readOnly = true)
    public List<MentorProfileResponse> getMentors() {
        return userRepository.findAllByRoleInAndProfile_MentorEnabledTrueOrderByNicknameAsc(
                        List.of(UserRole.MENTOR, UserRole.ADMIN)
                )
                .stream()
                .map(this::toMentorProfileResponse)
                .toList();
    }

    private MentorProfileResponse toMentorProfileResponse(User mentor) {
        List<MentorAvailabilitySlotResponse> availabilitySlots = mentorAvailabilitySlotRepository
                .findAllByMentor_Id(mentor.getId())
                .stream()
                .sorted((leftSlot, rightSlot) -> MentorAvailabilitySlotResponse.compare(leftSlot, rightSlot))
                .map(MentorAvailabilitySlotResponse::from)
                .toList();

        List<MentorCourseResponse> courses = mentorCourseRepository
                .findAllByMentor_IdAndStatus(mentor.getId(), MentorCourseStatus.PUBLISHED)
                .stream()
                .sorted((leftCourse, rightCourse) -> MentorCourseResponse.compareForPublicList(leftCourse, rightCourse))
                .map(course -> MentorCourseResponse.from(
                        course,
                        Math.toIntExact(mentorCourseApplicationRepository.countByCourse_IdAndStatus(
                                course.getId(),
                                MentorCourseApplicationStatus.APPROVED
                        )),
                        mentorCourseCurriculumItemRepository.findAllByCourse_IdOrderBySequenceAscIdAsc(course.getId())
                                .stream()
                                .map(MentorCourseCurriculumItemResponse::from)
                                .toList(),
                        mentorCourseScheduleItemRepository.findAllByCourse_IdOrderBySequenceAscIdAsc(course.getId())
                                .stream()
                                .map(scheduleItem -> {
                                    List<String> approvedApplicantNicknames = mentorCourseApplicationRepository
                                            .findAllByCourse_IdAndStatusOrderByCreatedAtDescIdDesc(
                                                    course.getId(),
                                                    MentorCourseApplicationStatus.APPROVED
                                            )
                                            .stream()
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
                                .toList()
                ))
                .toList();

        return MentorProfileResponse.from(mentor, availabilitySlots, courses);
    }
}
