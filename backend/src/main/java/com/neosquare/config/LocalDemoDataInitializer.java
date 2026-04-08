package com.neosquare.config;

import java.time.Instant;
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
import com.neosquare.mentoring.MentoringReservationRepository;
import com.neosquare.notification.Notification;
import com.neosquare.notification.NotificationRepository;
import com.neosquare.notification.NotificationType;
import com.neosquare.user.User;
import com.neosquare.user.UserRepository;
import com.neosquare.user.UserRole;

@Component
@ConditionalOnProperty(name = "app.seed-demo-data", havingValue = "true")
public class LocalDemoDataInitializer implements CommandLineRunner {

    private static final String DEMO_PASSWORD = "demo1234!";

    private final UserRepository userRepository;
    private final MentoringRequestRepository mentoringRequestRepository;
    private final MentoringReservationRepository mentoringReservationRepository;
    private final MentoringFeedbackRepository mentoringFeedbackRepository;
    private final NotificationRepository notificationRepository;
    private final PasswordEncoder passwordEncoder;

    public LocalDemoDataInitializer(
            UserRepository userRepository,
            MentoringRequestRepository mentoringRequestRepository,
            MentoringReservationRepository mentoringReservationRepository,
            MentoringFeedbackRepository mentoringFeedbackRepository,
            NotificationRepository notificationRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.mentoringRequestRepository = mentoringRequestRepository;
        this.mentoringReservationRepository = mentoringReservationRepository;
        this.mentoringFeedbackRepository = mentoringFeedbackRepository;
        this.notificationRepository = notificationRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        User mina = findOrCreateUser("mina@neosquare.local", "미나", UserRole.MENTOR);
        User jisu = findOrCreateUser("jisu@neosquare.local", "지수", UserRole.USER);
        User hyunwoo = findOrCreateUser("hyunwoo@neosquare.local", "현우", UserRole.USER);
        User seoyeon = findOrCreateUser("seoyeon@neosquare.local", "서연", UserRole.MENTOR);

        if (
                mentoringRequestRepository.count() > 0 ||
                mentoringReservationRepository.count() > 0 ||
                mentoringFeedbackRepository.count() > 0 ||
                notificationRepository.count() > 0
        ) {
            return;
        }

        RequestSeedData requestSeedData = seedMentoringRequests(mina, jisu, hyunwoo, seoyeon);
        ReservationSeedData reservationSeedData = seedReservations(mina, seoyeon);

        seedFeedbacks(requestSeedData.completedRequest(), jisu, seoyeon);
        seedNotifications(requestSeedData.acceptedRequest(), hyunwoo, reservationSeedData.acceptedReservation(), mina);
    }

    private User findOrCreateUser(String email, String nickname, UserRole role) {
        return userRepository.findByEmail(email)
                .orElseGet(() -> userRepository.save(
                        User.create(email, passwordEncoder.encode(DEMO_PASSWORD), nickname, role)
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

        mentoringReservationRepository.saveAll(List.of(acceptedReservation, pendingReservation));

        return new ReservationSeedData(acceptedReservation);
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
            MentoringReservation acceptedReservation
    ) {
    }
}
