package com.neosquare.mentor;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import com.neosquare.auth.AuthUserPrincipal;
import com.neosquare.mentoring.InvalidReservationTimeException;
import com.neosquare.mentoring.UserNotFoundException;
import com.neosquare.user.User;
import com.neosquare.user.UserRepository;
import com.neosquare.user.UserRole;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MentorManagementService {

    private static final ZoneId DEFAULT_ZONE_ID = ZoneId.systemDefault();
    private static final Comparator<MentorAvailabilitySlotRequest> AVAILABILITY_REQUEST_COMPARATOR = Comparator
            .comparing(MentorAvailabilitySlotRequest::dayOfWeek)
            .thenComparing(MentorAvailabilitySlotRequest::startTime)
            .thenComparing(MentorAvailabilitySlotRequest::endTime);

    private final UserRepository userRepository;
    private final MentorAvailabilitySlotRepository mentorAvailabilitySlotRepository;
    private final MentorCourseRepository mentorCourseRepository;
    private final MentorCourseApplicationRepository mentorCourseApplicationRepository;
    private final MentorCourseCurriculumItemRepository mentorCourseCurriculumItemRepository;

    public MentorManagementService(
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
    public MentorManagementProfileResponse getMyProfile(AuthUserPrincipal authUser) {
        User mentor = getMentorUserOrThrow(authUser);
        return toManagementProfileResponse(mentor);
    }

    @Transactional
    public MentorManagementProfileResponse updateMyProfile(
            AuthUserPrincipal authUser,
            MentorManagementProfileUpdateRequest request
    ) {
        User mentor = getMentorUserOrThrow(authUser);
        mentor.getProfile().update(
                normalizeOptionalText(request.bio()),
                normalizeOptionalText(request.interests()),
                normalizeOptionalText(request.specialties()),
                normalizeOptionalText(request.avatarUrl()),
                request.mentorEnabled()
        );

        return toManagementProfileResponse(mentor);
    }

    @Transactional(readOnly = true)
    public List<MentorAvailabilitySlotResponse> getMyAvailability(AuthUserPrincipal authUser) {
        User mentor = getMentorUserOrThrow(authUser);
        return getAvailabilityResponses(mentor.getId());
    }

    @Transactional
    public List<MentorAvailabilitySlotResponse> updateMyAvailability(
            AuthUserPrincipal authUser,
            MentorAvailabilityUpdateRequest request
    ) {
        User mentor = getMentorUserOrThrow(authUser);
        List<MentorAvailabilitySlotRequest> requestedSlots = new ArrayList<>(request.slots());
        requestedSlots.sort(AVAILABILITY_REQUEST_COMPARATOR);
        validateAvailabilityRequests(requestedSlots);

        mentorAvailabilitySlotRepository.deleteAllByMentor_Id(mentor.getId());

        if (requestedSlots.isEmpty()) {
            return List.of();
        }

        List<MentorAvailabilitySlot> slotsToSave = requestedSlots.stream()
                .map(slotRequest -> MentorAvailabilitySlot.create(
                        mentor,
                        slotRequest.dayOfWeek(),
                        slotRequest.startTime(),
                        slotRequest.endTime()
                ))
                .toList();

        return mentorAvailabilitySlotRepository.saveAll(slotsToSave)
                .stream()
                .sorted((leftSlot, rightSlot) -> MentorAvailabilitySlotResponse.compare(leftSlot, rightSlot))
                .map(MentorAvailabilitySlotResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MentorCourseResponse> getMyCourses(AuthUserPrincipal authUser) {
        User mentor = getMentorUserOrThrow(authUser);
        return getOwnerCourseResponses(mentor.getId());
    }

    @Transactional
    public MentorCourseResponse createCourse(AuthUserPrincipal authUser, MentorCourseCreateRequest request) {
        User mentor = getMentorUserOrThrow(authUser);
        MentorCourse course = mentorCourseRepository.save(MentorCourse.create(
                mentor,
                request.title().trim(),
                request.summary().trim(),
                request.description().trim(),
                request.meetingType().trim(),
                request.price(),
                request.capacity(),
                request.status()
        ));

        syncCourseCurriculum(course, request.curriculumItems());

        return MentorCourseResponse.from(
                course,
                0,
                loadCurriculumResponses(course.getId())
        );
    }

    @Transactional
    public MentorCourseResponse updateCourse(
            AuthUserPrincipal authUser,
            Long courseId,
            MentorCourseUpdateRequest request
    ) {
        User mentor = getMentorUserOrThrow(authUser);
        MentorCourse course = mentorCourseRepository.findByIdAndMentor_Id(courseId, mentor.getId())
                .orElseThrow(() -> new MentorCourseNotFoundException(courseId));

        course.update(
                request.title().trim(),
                request.summary().trim(),
                request.description().trim(),
                request.meetingType().trim(),
                request.price(),
                request.capacity(),
                request.status()
        );

        syncCourseCurriculum(course, request.curriculumItems());

        return MentorCourseResponse.from(
                course,
                Math.toIntExact(mentorCourseApplicationRepository.countByCourse_IdAndStatus(
                        course.getId(),
                        MentorCourseApplicationStatus.APPROVED
                )),
                loadCurriculumResponses(course.getId())
        );
    }

    @Transactional(readOnly = true)
    public void validateReservationTime(Long mentorId, Instant reservedAt) {
        List<MentorAvailabilitySlot> availabilitySlots = mentorAvailabilitySlotRepository.findAllByMentor_Id(mentorId);

        if (availabilitySlots.isEmpty()) {
            return;
        }

        ZonedDateTime requestedDateTime = reservedAt.atZone(DEFAULT_ZONE_ID);
        DayOfWeek requestedDayOfWeek = requestedDateTime.getDayOfWeek();
        LocalTime requestedTime = requestedDateTime.toLocalTime();

        boolean matches = availabilitySlots.stream()
                .anyMatch(slot -> slot.matches(requestedDayOfWeek, requestedTime));

        if (!matches) {
            throw new InvalidReservationTimeException(
                    "This mentor is not available at the requested time."
            );
        }
    }

    private void validateAvailabilityRequests(List<MentorAvailabilitySlotRequest> requestedSlots) {
        List<MentorAvailabilitySlotRequest> normalizedSlots = new ArrayList<>();

        for (MentorAvailabilitySlotRequest requestedSlot : requestedSlots) {
            if (!requestedSlot.startTime().isBefore(requestedSlot.endTime())) {
                throw new InvalidMentorAvailabilityException(
                        "Availability start time must be before end time."
                );
            }

            for (MentorAvailabilitySlotRequest existingSlot : normalizedSlots) {
                boolean overlaps = requestedSlot.dayOfWeek() == existingSlot.dayOfWeek()
                        && requestedSlot.startTime().isBefore(existingSlot.endTime())
                        && existingSlot.startTime().isBefore(requestedSlot.endTime());

                if (overlaps) {
                    throw new InvalidMentorAvailabilityException(
                            "Availability slots cannot overlap on the same day."
                    );
                }
            }

            normalizedSlots.add(requestedSlot);
        }
    }

    private MentorManagementProfileResponse toManagementProfileResponse(User mentor) {
        return MentorManagementProfileResponse.of(
                mentor,
                getAvailabilityResponses(mentor.getId()),
                getOwnerCourseResponses(mentor.getId())
        );
    }

    private List<MentorAvailabilitySlotResponse> getAvailabilityResponses(Long mentorId) {
        return mentorAvailabilitySlotRepository.findAllByMentor_Id(mentorId)
                .stream()
                .sorted((leftSlot, rightSlot) -> MentorAvailabilitySlotResponse.compare(leftSlot, rightSlot))
                .map(MentorAvailabilitySlotResponse::from)
                .toList();
    }

    private List<MentorCourseResponse> getOwnerCourseResponses(Long mentorId) {
        return mentorCourseRepository.findAllByMentor_Id(mentorId)
                .stream()
                .sorted((leftCourse, rightCourse) -> MentorCourseResponse.compareForOwnerList(leftCourse, rightCourse))
                .map(course -> MentorCourseResponse.from(
                        course,
                        Math.toIntExact(mentorCourseApplicationRepository.countByCourse_IdAndStatus(
                                course.getId(),
                                MentorCourseApplicationStatus.APPROVED
                        )),
                        loadCurriculumResponses(course.getId())
                ))
                .toList();
    }

    private void syncCourseCurriculum(
            MentorCourse course,
            List<MentorCourseCurriculumItemRequest> curriculumItems
    ) {
        mentorCourseCurriculumItemRepository.deleteAllByCourse_Id(course.getId());

        if (curriculumItems == null || curriculumItems.isEmpty()) {
            return;
        }

        List<MentorCourseCurriculumItem> itemsToSave = new ArrayList<>();

        for (int index = 0; index < curriculumItems.size(); index++) {
            MentorCourseCurriculumItemRequest itemRequest = curriculumItems.get(index);
            itemsToSave.add(MentorCourseCurriculumItem.create(
                    course,
                    index + 1,
                    itemRequest.title().trim(),
                    itemRequest.description().trim()
            ));
        }

        mentorCourseCurriculumItemRepository.saveAll(itemsToSave);
    }

    private List<MentorCourseCurriculumItemResponse> loadCurriculumResponses(Long courseId) {
        return mentorCourseCurriculumItemRepository.findAllByCourse_IdOrderBySequenceAscIdAsc(courseId)
                .stream()
                .map(MentorCourseCurriculumItemResponse::from)
                .toList();
    }

    private User getMentorUserOrThrow(AuthUserPrincipal authUser) {
        if (authUser == null || authUser.id() == null) {
            throw new MentorManagementAccessDeniedException("Authentication is required.");
        }

        if (authUser.role() != UserRole.MENTOR && authUser.role() != UserRole.ADMIN) {
            throw new MentorManagementAccessDeniedException("Only mentors can manage mentor settings.");
        }

        return userRepository.findById(authUser.id())
                .orElseThrow(() -> new UserNotFoundException("User not found: " + authUser.id()));
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }
}
