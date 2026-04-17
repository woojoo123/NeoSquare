package com.neosquare.admin;

import java.util.Comparator;
import java.util.List;

import com.neosquare.auth.AuthUserPrincipal;
import com.neosquare.mentor.MentorApplication;
import com.neosquare.mentor.MentorApplicationRepository;
import com.neosquare.mentor.MentorApplicationResponse;
import com.neosquare.mentor.MentorApplicationStatus;
import com.neosquare.mentor.MentorCourse;
import com.neosquare.mentor.MentorCourseApplication;
import com.neosquare.mentor.MentorCourseApplicationRepository;
import com.neosquare.mentor.MentorCourseApplicationResponse;
import com.neosquare.mentor.MentorCourseApplicationStatus;
import com.neosquare.mentor.MentorCourseNotFoundException;
import com.neosquare.mentor.MentorCourseRepository;
import com.neosquare.mentor.MentorCourseStatus;
import com.neosquare.mentoring.UserNotFoundException;
import com.neosquare.user.User;
import com.neosquare.user.UserRepository;
import com.neosquare.user.UserRole;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminDashboardService {

    private final UserRepository userRepository;
    private final MentorApplicationRepository mentorApplicationRepository;
    private final MentorCourseRepository mentorCourseRepository;
    private final MentorCourseApplicationRepository mentorCourseApplicationRepository;

    public AdminDashboardService(
            UserRepository userRepository,
            MentorApplicationRepository mentorApplicationRepository,
            MentorCourseRepository mentorCourseRepository,
            MentorCourseApplicationRepository mentorCourseApplicationRepository
    ) {
        this.userRepository = userRepository;
        this.mentorApplicationRepository = mentorApplicationRepository;
        this.mentorCourseRepository = mentorCourseRepository;
        this.mentorCourseApplicationRepository = mentorCourseApplicationRepository;
    }

    @Transactional(readOnly = true)
    public AdminDashboardResponse getDashboard(AuthUserPrincipal authUser) {
        ensureAdmin(authUser);

        List<User> mentors = userRepository.findAllByRoleInOrderByNicknameAsc(List.of(UserRole.MENTOR, UserRole.ADMIN));
        List<MentorApplication> pendingMentorApplications = mentorApplicationRepository
                .findAllByStatusOrderByCreatedAtAscIdAsc(MentorApplicationStatus.PENDING);
        List<MentorCourse> courses = mentorCourseRepository.findAll().stream()
                .sorted(Comparator.comparing(MentorCourse::getUpdatedAt).reversed())
                .toList();
        List<MentorCourseApplication> pendingCourseApplications = mentorCourseApplicationRepository.findAll().stream()
                .filter(application -> application.getStatus() == MentorCourseApplicationStatus.PENDING)
                .sorted(Comparator.comparing(MentorCourseApplication::getCreatedAt).reversed())
                .toList();

        return new AdminDashboardResponse(
                mentors.size(),
                (int) mentors.stream().filter(mentor -> mentor.getProfile().isMentorEnabled()).count(),
                (int) courses.stream().filter(course -> course.getStatus() == MentorCourseStatus.PUBLISHED).count(),
                pendingMentorApplications.size(),
                pendingCourseApplications.size(),
                pendingMentorApplications.stream().map(MentorApplicationResponse::from).toList(),
                pendingCourseApplications.stream().map(MentorCourseApplicationResponse::from).toList(),
                mentors.stream().map(this::toAdminMentorOverview).toList(),
                courses.stream().map(this::toAdminCourseOverview).toList()
        );
    }

    @Transactional
    public AdminMentorOverviewResponse updateMentorVisibility(
            AuthUserPrincipal authUser,
            Long mentorId,
            AdminMentorVisibilityUpdateRequest request
    ) {
        ensureAdmin(authUser);
        User mentor = userRepository.findById(mentorId)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + mentorId));

        if (mentor.getRole() != UserRole.MENTOR && mentor.getRole() != UserRole.ADMIN) {
            throw new AdminAccessDeniedException("Only mentor accounts can have mentor visibility updated.");
        }

        if (request.mentorEnabled()) {
            mentor.getProfile().enableMentoring();
        } else {
            mentor.getProfile().disableMentoring();
        }

        return toAdminMentorOverview(mentor);
    }

    @Transactional
    public AdminCourseOverviewResponse updateCourseStatus(
            AuthUserPrincipal authUser,
            Long courseId,
            AdminCourseStatusUpdateRequest request
    ) {
        ensureAdmin(authUser);
        MentorCourse course = mentorCourseRepository.findById(courseId)
                .orElseThrow(() -> new MentorCourseNotFoundException(courseId));

        course.update(
                course.getTitle(),
                course.getSummary(),
                course.getDescription(),
                course.getMeetingType(),
                course.getPrice(),
                course.getCapacity(),
                request.status()
        );

        return toAdminCourseOverview(course);
    }

    private AdminMentorOverviewResponse toAdminMentorOverview(User mentor) {
        List<MentorCourse> mentorCourses = mentorCourseRepository.findAllByMentor_Id(mentor.getId());

        return new AdminMentorOverviewResponse(
                mentor.getId(),
                mentor.getNickname(),
                mentor.getEmail(),
                mentor.getProfile().isMentorEnabled(),
                mentor.getProfile().getSpecialties(),
                mentorCourses.size(),
                (int) mentorCourses.stream().filter(course -> course.getStatus() == MentorCourseStatus.PUBLISHED).count(),
                mentorCourseApplicationRepository.findAllByCourse_Mentor_IdOrderByCreatedAtDescIdDesc(mentor.getId())
                        .stream()
                        .filter(application -> application.getStatus() == MentorCourseApplicationStatus.PENDING)
                        .count()
        );
    }

    private AdminCourseOverviewResponse toAdminCourseOverview(MentorCourse course) {
        int approvedApplicationCount = Math.toIntExact(mentorCourseApplicationRepository.countByCourse_IdAndStatus(
                course.getId(),
                MentorCourseApplicationStatus.APPROVED
        ));
        long pendingApplicationCount = mentorCourseApplicationRepository.findAll().stream()
                .filter(application -> application.getCourse().getId().equals(course.getId()))
                .filter(application -> application.getStatus() == MentorCourseApplicationStatus.PENDING)
                .count();

        return new AdminCourseOverviewResponse(
                course.getId(),
                course.getTitle(),
                course.getMentor().getId(),
                course.getMentor().getNickname(),
                course.getStatus(),
                course.getPrice(),
                course.getCapacity(),
                approvedApplicationCount,
                Math.max(course.getCapacity() - approvedApplicationCount, 0),
                pendingApplicationCount
        );
    }

    private void ensureAdmin(AuthUserPrincipal authUser) {
        if (authUser == null || authUser.role() != UserRole.ADMIN) {
            throw new AdminAccessDeniedException("Only admins can access the admin dashboard.");
        }
    }
}
