package com.neosquare.user;

import java.util.List;

import com.neosquare.mentor.MentorAvailabilitySlotRepository;
import com.neosquare.mentor.MentorAvailabilitySlotResponse;
import com.neosquare.mentor.MentorCourseApplicationRepository;
import com.neosquare.mentor.MentorCourseApplicationStatus;
import com.neosquare.mentor.MentorCourseCurriculumItemRepository;
import com.neosquare.mentor.MentorCourseCurriculumItemResponse;
import com.neosquare.mentor.MentorCourseRepository;
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

    public UserService(
            UserRepository userRepository,
            MentorAvailabilitySlotRepository mentorAvailabilitySlotRepository,
            MentorCourseRepository mentorCourseRepository,
            MentorCourseApplicationRepository mentorCourseApplicationRepository,
            MentorCourseCurriculumItemRepository mentorCourseCurriculumItemRepository
    ) {
        this.userRepository = userRepository;
        this.mentorAvailabilitySlotRepository = mentorAvailabilitySlotRepository;
        this.mentorCourseRepository = mentorCourseRepository;
        this.mentorCourseApplicationRepository = mentorCourseApplicationRepository;
        this.mentorCourseCurriculumItemRepository = mentorCourseCurriculumItemRepository;
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
                                .toList()
                ))
                .toList();

        return MentorProfileResponse.from(mentor, availabilitySlots, courses);
    }
}
