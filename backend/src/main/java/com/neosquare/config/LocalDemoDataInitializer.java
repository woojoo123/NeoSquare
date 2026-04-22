package com.neosquare.config;

import java.time.Instant;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.neosquare.mentoring.MentoringFeedback;
import com.neosquare.mentoring.MentoringFeedbackRepository;
import com.neosquare.mentoring.MentoringRequest;
import com.neosquare.mentoring.MentoringRequestRepository;
import com.neosquare.mentoring.MentoringReservation;
import com.neosquare.mentoring.MentoringReservationFeedback;
import com.neosquare.mentoring.MentoringReservationFeedbackRepository;
import com.neosquare.mentoring.MentoringReservationRepository;
import com.neosquare.notification.Notification;
import com.neosquare.notification.NotificationRepository;
import com.neosquare.notification.NotificationType;
import com.neosquare.mentor.MentorAvailabilitySlot;
import com.neosquare.mentor.MentorAvailabilitySlotRepository;
import com.neosquare.mentor.MentorCourse;
import com.neosquare.mentor.MentorCourseApplication;
import com.neosquare.mentor.MentorCourseApplicationRepository;
import com.neosquare.mentor.MentorCourseCurriculumItem;
import com.neosquare.mentor.MentorCourseCurriculumItemRepository;
import com.neosquare.mentor.MentorCourseRepository;
import com.neosquare.mentor.MentorCourseScheduleItem;
import com.neosquare.mentor.MentorCourseScheduleItemRepository;
import com.neosquare.mentor.MentorCourseStatus;
import com.neosquare.user.User;
import com.neosquare.user.UserRepository;
import com.neosquare.user.UserRole;

@Component
@ConditionalOnProperty(name = "app.seed-demo-data", havingValue = "true")
public class LocalDemoDataInitializer implements CommandLineRunner {

    private static final String DEMO_PASSWORD = "demo1234!";
    private static final String LOCAL_ADMIN_EMAIL = "admin@neosquare.local";
    private static final String LOCAL_ADMIN_NICKNAME = "관리자";

    private final UserRepository userRepository;
    private final MentoringRequestRepository mentoringRequestRepository;
    private final MentoringReservationRepository mentoringReservationRepository;
    private final MentoringFeedbackRepository mentoringFeedbackRepository;
    private final MentoringReservationFeedbackRepository mentoringReservationFeedbackRepository;
    private final NotificationRepository notificationRepository;
    private final MentorAvailabilitySlotRepository mentorAvailabilitySlotRepository;
    private final MentorCourseRepository mentorCourseRepository;
    private final MentorCourseApplicationRepository mentorCourseApplicationRepository;
    private final MentorCourseCurriculumItemRepository mentorCourseCurriculumItemRepository;
    private final MentorCourseScheduleItemRepository mentorCourseScheduleItemRepository;
    private final PasswordEncoder passwordEncoder;

    public LocalDemoDataInitializer(
            UserRepository userRepository,
            MentoringRequestRepository mentoringRequestRepository,
            MentoringReservationRepository mentoringReservationRepository,
            MentoringFeedbackRepository mentoringFeedbackRepository,
            MentoringReservationFeedbackRepository mentoringReservationFeedbackRepository,
            NotificationRepository notificationRepository,
            MentorAvailabilitySlotRepository mentorAvailabilitySlotRepository,
            MentorCourseRepository mentorCourseRepository,
            MentorCourseApplicationRepository mentorCourseApplicationRepository,
            MentorCourseCurriculumItemRepository mentorCourseCurriculumItemRepository,
            MentorCourseScheduleItemRepository mentorCourseScheduleItemRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.mentoringRequestRepository = mentoringRequestRepository;
        this.mentoringReservationRepository = mentoringReservationRepository;
        this.mentoringFeedbackRepository = mentoringFeedbackRepository;
        this.mentoringReservationFeedbackRepository = mentoringReservationFeedbackRepository;
        this.notificationRepository = notificationRepository;
        this.mentorAvailabilitySlotRepository = mentorAvailabilitySlotRepository;
        this.mentorCourseRepository = mentorCourseRepository;
        this.mentorCourseApplicationRepository = mentorCourseApplicationRepository;
        this.mentorCourseCurriculumItemRepository = mentorCourseCurriculumItemRepository;
        this.mentorCourseScheduleItemRepository = mentorCourseScheduleItemRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        findOrCreateUser(LOCAL_ADMIN_EMAIL, LOCAL_ADMIN_NICKNAME, UserRole.ADMIN);
        User mina = findOrCreateUser("mina@neosquare.local", "미나", UserRole.MENTOR);
        User jisu = findOrCreateUser("jisu@neosquare.local", "지수", UserRole.USER);
        User hyunwoo = findOrCreateUser("hyunwoo@neosquare.local", "현우", UserRole.USER);
        User seoyeon = findOrCreateUser("seoyeon@neosquare.local", "서연", UserRole.MENTOR);

        seedMentorProfiles(mina, seoyeon);
        seedMentorAvailability(mina, seoyeon);
        seedMentorCourses(mina, seoyeon);
        seedMentorCourseCurriculum();
        seedMentorCourseSchedules();
        seedMentorCourseApplications(mina, seoyeon, jisu, hyunwoo);

        if (
                mentoringRequestRepository.count() > 0 ||
                mentoringReservationRepository.count() > 0 ||
                mentoringFeedbackRepository.count() > 0 ||
                mentoringReservationFeedbackRepository.count() > 0 ||
                notificationRepository.count() > 0
        ) {
            return;
        }

        RequestSeedData requestSeedData = seedMentoringRequests(mina, jisu, hyunwoo, seoyeon);
        ReservationSeedData reservationSeedData = seedReservations(mina, seoyeon);

        seedFeedbacks(requestSeedData.completedRequest(), jisu, seoyeon);
        seedReservationFeedbacks(reservationSeedData.completedReservation(), mina, seoyeon);
        seedNotifications(requestSeedData.acceptedRequest(), hyunwoo, reservationSeedData.acceptedReservation(), mina);
    }

    private User findOrCreateUser(String email, String nickname, UserRole role) {
        User user = userRepository.findByEmail(email)
                .orElseGet(() -> userRepository.save(
                        User.create(email, passwordEncoder.encode(DEMO_PASSWORD), nickname, role)
                ));

        if (role == UserRole.MENTOR || role == UserRole.ADMIN) {
            user.getProfile().enableMentoring();
        }

        return user;
    }

    private void seedMentorProfiles(User mina, User seoyeon) {
        mina.getProfile().update(
                "백엔드 설계와 실무 면접 준비를 함께 정리하는 멘토입니다.",
                "API 설계, 테스트 코드, 커리어 상담",
                "Spring Boot, JPA, 시스템 설계",
                mina.getProfile().getAvatarUrl(),
                true
        );

        seoyeon.getProfile().update(
                "프론트엔드 구조와 포트폴리오 흐름을 함께 다듬는 멘토입니다.",
                "React, UI 구조, 발표 준비",
                "React, TypeScript, 포트폴리오 리뷰",
                seoyeon.getProfile().getAvatarUrl(),
                true
        );
    }

    private void seedMentorAvailability(User mina, User seoyeon) {
        if (mentorAvailabilitySlotRepository.count() > 0) {
            return;
        }

        mentorAvailabilitySlotRepository.saveAll(List.of(
                MentorAvailabilitySlot.create(mina, DayOfWeek.MONDAY, LocalTime.of(19, 0), LocalTime.of(22, 0)),
                MentorAvailabilitySlot.create(mina, DayOfWeek.THURSDAY, LocalTime.of(20, 0), LocalTime.of(23, 0)),
                MentorAvailabilitySlot.create(seoyeon, DayOfWeek.TUESDAY, LocalTime.of(19, 30), LocalTime.of(22, 30)),
                MentorAvailabilitySlot.create(seoyeon, DayOfWeek.SATURDAY, LocalTime.of(10, 0), LocalTime.of(13, 0))
        ));
    }

    private void seedMentorCourses(User mina, User seoyeon) {
        if (mentorCourseRepository.count() > 0) {
            return;
        }

        mentorCourseRepository.saveAll(List.of(
                MentorCourse.create(
                        mina,
                        "백엔드 API 구조 리뷰",
                        "실전 프로젝트 기준으로 API 설계와 예외 처리 패턴을 점검합니다.",
                        "컨트롤러, 서비스, 예외 처리, 테스트 코드까지 실제 프로젝트 구조를 기준으로 리뷰합니다.",
                        "ONLINE",
                        0,
                        5,
                        MentorCourseStatus.PUBLISHED
                ),
                MentorCourse.create(
                        mina,
                        "시스템 설계 면접 준비",
                        "주니어 개발자용 시스템 설계 면접 대비 세션입니다.",
                        "요구사항 정리, 트레이드오프 설명, 설계 발표 흐름까지 단계별로 연습합니다.",
                        "ONLINE",
                        0,
                        4,
                        MentorCourseStatus.PUBLISHED
                ),
                MentorCourse.create(
                        seoyeon,
                        "프론트 포트폴리오 구조 정리",
                        "React 포트폴리오를 사용자 흐름 관점에서 리빌드합니다.",
                        "섹션 구성, 프로젝트 설명 방식, 발표 흐름까지 같이 정리하는 실습형 멘토링입니다.",
                        "HYBRID",
                        0,
                        6,
                        MentorCourseStatus.PUBLISHED
                )
        ));
    }

    private void seedMentorCourseApplications(User mina, User seoyeon, User jisu, User hyunwoo) {
        if (mentorCourseApplicationRepository.count() > 0 || mentorCourseRepository.count() == 0) {
            return;
        }

        MentorCourse backendReviewCourse = mentorCourseRepository.findAll().stream()
                .filter(course -> "백엔드 API 구조 리뷰".equals(course.getTitle()))
                .findFirst()
                .orElseThrow();
        MentorCourse portfolioCourse = mentorCourseRepository.findAll().stream()
                .filter(course -> "프론트 포트폴리오 구조 정리".equals(course.getTitle()))
                .findFirst()
                .orElseThrow();

        MentorCourseApplication pendingApplication = MentorCourseApplication.create(
                backendReviewCourse,
                jisu,
                null,
                "현재 진행 중인 스프링 프로젝트 구조를 같이 리뷰받고 싶어요."
        );

        MentorCourseApplication approvedApplication = MentorCourseApplication.create(
                portfolioCourse,
                hyunwoo,
                null,
                "포트폴리오 발표 흐름과 프로젝트 설명 방식을 점검받고 싶습니다."
        );
        approvedApplication.approve(null, "이번 주 토요일 세션으로 진행해 봅시다.");

        mentorCourseApplicationRepository.saveAll(List.of(pendingApplication, approvedApplication));
    }

    private void seedMentorCourseCurriculum() {
        if (mentorCourseCurriculumItemRepository.count() > 0 || mentorCourseRepository.count() == 0) {
            return;
        }

        MentorCourse backendReviewCourse = mentorCourseRepository.findAll().stream()
                .filter(course -> "백엔드 API 구조 리뷰".equals(course.getTitle()))
                .findFirst()
                .orElseThrow();
        MentorCourse systemDesignCourse = mentorCourseRepository.findAll().stream()
                .filter(course -> "시스템 설계 면접 준비".equals(course.getTitle()))
                .findFirst()
                .orElseThrow();
        MentorCourse portfolioCourse = mentorCourseRepository.findAll().stream()
                .filter(course -> "프론트 포트폴리오 구조 정리".equals(course.getTitle()))
                .findFirst()
                .orElseThrow();

        mentorCourseCurriculumItemRepository.saveAll(List.of(
                MentorCourseCurriculumItem.create(
                        backendReviewCourse,
                        1,
                        "현재 프로젝트 구조 진단",
                        "컨트롤러, 서비스, 예외 처리, 테스트 코드 구조를 함께 점검합니다."
                ),
                MentorCourseCurriculumItem.create(
                        backendReviewCourse,
                        2,
                        "리팩터링 우선순위 정리",
                        "중복 제거, 계층 분리, 예외 응답 규칙을 우선순위 기준으로 정리합니다."
                ),
                MentorCourseCurriculumItem.create(
                        systemDesignCourse,
                        1,
                        "요구사항 해석 연습",
                        "문제를 빠르게 구조화하고 핵심 제약 조건을 뽑아내는 법을 연습합니다."
                ),
                MentorCourseCurriculumItem.create(
                        systemDesignCourse,
                        2,
                        "설계 발표 구조 만들기",
                        "면접 답변 흐름과 트레이드오프 설명 순서를 정리합니다."
                ),
                MentorCourseCurriculumItem.create(
                        portfolioCourse,
                        1,
                        "포트폴리오 흐름 재구성",
                        "첫 화면, 프로젝트 순서, 섹션 강조점을 사용자 관점으로 다시 짭니다."
                ),
                MentorCourseCurriculumItem.create(
                        portfolioCourse,
                        2,
                        "프로젝트 설명 문장 다듬기",
                        "문제 정의, 해결 과정, 기술 선택 이유를 짧고 강하게 전달하는 방식으로 정리합니다."
                )
        ));
    }

    private void seedMentorCourseSchedules() {
        if (mentorCourseScheduleItemRepository.count() > 0 || mentorCourseRepository.count() == 0) {
            return;
        }

        MentorCourse backendReviewCourse = mentorCourseRepository.findAll().stream()
                .filter(course -> "백엔드 API 구조 리뷰".equals(course.getTitle()))
                .findFirst()
                .orElseThrow();
        MentorCourse systemDesignCourse = mentorCourseRepository.findAll().stream()
                .filter(course -> "시스템 설계 면접 준비".equals(course.getTitle()))
                .findFirst()
                .orElseThrow();
        MentorCourse portfolioCourse = mentorCourseRepository.findAll().stream()
                .filter(course -> "프론트 포트폴리오 구조 정리".equals(course.getTitle()))
                .findFirst()
                .orElseThrow();

        Instant now = Instant.now().truncatedTo(ChronoUnit.HOURS);

        mentorCourseScheduleItemRepository.saveAll(List.of(
                MentorCourseScheduleItem.create(
                        backendReviewCourse,
                        1,
                        "1회차 · 현재 API 구조 진단",
                        "현재 프로젝트 구조와 예외 응답 설계를 함께 점검합니다.",
                        now.plus(3, ChronoUnit.DAYS),
                        now.plus(3, ChronoUnit.DAYS).plus(90, ChronoUnit.MINUTES)
                ),
                MentorCourseScheduleItem.create(
                        backendReviewCourse,
                        2,
                        "2회차 · 리팩터링 우선순위 정리",
                        "서비스 분리와 테스트 보강 포인트를 정리합니다.",
                        now.plus(10, ChronoUnit.DAYS),
                        now.plus(10, ChronoUnit.DAYS).plus(90, ChronoUnit.MINUTES)
                ),
                MentorCourseScheduleItem.create(
                        systemDesignCourse,
                        1,
                        "1회차 · 요구사항 분석",
                        "면접 문제를 요구사항과 제약 조건으로 분해합니다.",
                        now.plus(5, ChronoUnit.DAYS),
                        now.plus(5, ChronoUnit.DAYS).plus(120, ChronoUnit.MINUTES)
                ),
                MentorCourseScheduleItem.create(
                        systemDesignCourse,
                        2,
                        "2회차 · 설계 발표 리허설",
                        "설계 근거와 트레이드오프 설명을 발표 흐름으로 다듬습니다.",
                        now.plus(12, ChronoUnit.DAYS),
                        now.plus(12, ChronoUnit.DAYS).plus(120, ChronoUnit.MINUTES)
                ),
                MentorCourseScheduleItem.create(
                        portfolioCourse,
                        1,
                        "1회차 · 포트폴리오 구조 리뷰",
                        "전체 섹션 흐름과 프로젝트 배열을 점검합니다.",
                        now.plus(4, ChronoUnit.DAYS),
                        now.plus(4, ChronoUnit.DAYS).plus(100, ChronoUnit.MINUTES)
                ),
                MentorCourseScheduleItem.create(
                        portfolioCourse,
                        2,
                        "2회차 · 발표 스토리라인 정리",
                        "프로젝트 설명 순서와 전달력을 함께 다듬습니다.",
                        now.plus(11, ChronoUnit.DAYS),
                        now.plus(11, ChronoUnit.DAYS).plus(100, ChronoUnit.MINUTES)
                )
        ));
    }

    private RequestSeedData seedMentoringRequests(User mina, User jisu, User hyunwoo, User seoyeon) {
        MentoringRequest pendingRequest = MentoringRequest.create(
                jisu,
                mina,
                "이력서와 포트폴리오 방향을 같이 점검받고 싶어요."
        );

        MentoringRequest acceptedRequest = MentoringRequest.create(
                hyunwoo,
                mina,
                "Spring Boot API 구조와 예외 처리 설계를 같이 보고 싶습니다."
        );
        acceptedRequest.accept();

        MentoringRequest completedRequest = MentoringRequest.create(
                jisu,
                seoyeon,
                "React 상태 관리와 컴포넌트 분리 방향을 정리하고 싶어요."
        );
        completedRequest.accept();
        completedRequest.complete();

        mentoringRequestRepository.saveAll(List.of(pendingRequest, acceptedRequest, completedRequest));

        return new RequestSeedData(acceptedRequest, completedRequest);
    }

    private ReservationSeedData seedReservations(User mina, User seoyeon) {
        MentoringReservation acceptedReservation = MentoringReservation.create(
                mina,
                seoyeon,
                Instant.now().plus(5, ChronoUnit.MINUTES),
                "5분 뒤에 포트폴리오 발표 흐름을 같이 리허설하고 싶어요."
        );
        acceptedReservation.accept();

        MentoringReservation pendingReservation = MentoringReservation.create(
                seoyeon,
                mina,
                Instant.now().plus(1, ChronoUnit.DAYS),
                "내일 저녁에 프론트 구조 리뷰 시간을 잡고 싶어요."
        );

        MentoringReservation completedReservation = MentoringReservation.create(
                mina,
                seoyeon,
                Instant.now().minus(2, ChronoUnit.DAYS),
                "지난주에 포트폴리오 발표 흐름을 같이 점검했어요."
        );
        completedReservation.accept();
        completedReservation.complete();

        mentoringReservationRepository.saveAll(List.of(
                acceptedReservation,
                pendingReservation,
                completedReservation
        ));

        return new ReservationSeedData(acceptedReservation, completedReservation);
    }

    private void seedFeedbacks(MentoringRequest completedRequest, User jisu, User seoyeon) {
        MentoringFeedback requesterFeedback = MentoringFeedback.create(
                completedRequest,
                jisu,
                seoyeon,
                5,
                "상태 관리와 컴포넌트 분리 기준을 명확히 정리했다.",
                "구조를 기능 단위로 나누는 기준을 이해하는 데 큰 도움이 됐습니다."
        );

        MentoringFeedback mentorFeedback = MentoringFeedback.create(
                completedRequest,
                seoyeon,
                jisu,
                4,
                "질문 포인트가 분명해서 리뷰 흐름이 매끄러웠다.",
                "다음에는 실제 컴포넌트 분리 전후 코드를 같이 보면 더 빠르게 정리할 수 있을 것 같습니다."
        );

        mentoringFeedbackRepository.saveAll(List.of(requesterFeedback, mentorFeedback));
    }

    private void seedReservationFeedbacks(MentoringReservation completedReservation, User mina, User seoyeon) {
        MentoringReservationFeedback requesterFeedback = MentoringReservationFeedback.create(
                completedReservation,
                mina,
                seoyeon,
                5,
                "예약 멘토링 흐름을 자연스럽게 정리했다.",
                "발표 전에 예약 세션으로 리허설할 수 있어서 큰 도움이 됐습니다."
        );

        MentoringReservationFeedback mentorFeedback = MentoringReservationFeedback.create(
                completedReservation,
                seoyeon,
                mina,
                4,
                "목표가 분명해서 짧은 시간 안에 핵심을 짚을 수 있었다.",
                "다음에는 발표 자료 초안을 함께 보면서 더 구체적으로 다듬어 보면 좋겠습니다."
        );

        mentoringReservationFeedbackRepository.saveAll(List.of(requesterFeedback, mentorFeedback));
    }

    private void seedNotifications(
            MentoringRequest acceptedRequest,
            User requestRecipient,
            MentoringReservation acceptedReservation,
            User reservationRecipient
    ) {
        Notification requestAcceptedNotification = Notification.create(
                requestRecipient,
                NotificationType.REQUEST_ACCEPTED,
                "멘토링 요청이 수락되었습니다",
                "미나 님이 요청을 수락했습니다. 지금 세션 화면으로 이동할 수 있습니다.",
                acceptedRequest.getId()
        );

        Notification reservationAcceptedNotification = Notification.create(
                reservationRecipient,
                NotificationType.RESERVATION_ACCEPTED,
                "멘토링 예약이 확정되었습니다",
                "서연 님과의 예약이 확정되었습니다. 시작 시간이 가까워지면 로비에서 바로 입장할 수 있습니다.",
                acceptedReservation.getId()
        );

        Notification readSampleNotification = Notification.create(
                requestRecipient,
                NotificationType.REQUEST_ACCEPTED,
                "이전 멘토링 세션 기록",
                "이전에 수락된 멘토링 요청 기록입니다.",
                acceptedRequest.getId()
        );
        readSampleNotification.markAsRead();

        notificationRepository.saveAll(List.of(
                requestAcceptedNotification,
                reservationAcceptedNotification,
                readSampleNotification
        ));
    }

    private record RequestSeedData(
            MentoringRequest acceptedRequest,
            MentoringRequest completedRequest
    ) {
    }

    private record ReservationSeedData(
            MentoringReservation acceptedReservation,
            MentoringReservation completedReservation
    ) {
    }
}
