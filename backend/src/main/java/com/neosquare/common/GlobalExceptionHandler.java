package com.neosquare.common;

import java.util.LinkedHashMap;
import java.util.Map;

import com.neosquare.admin.AdminAccessDeniedException;
import com.neosquare.auth.DuplicateEmailException;
import com.neosquare.auth.DuplicateNicknameException;
import com.neosquare.auth.InvalidCredentialsException;
import com.neosquare.auth.InvalidRefreshTokenException;
import com.neosquare.mentoring.DuplicateMentoringFeedbackException;
import com.neosquare.mentoring.DuplicateMentoringReservationFeedbackException;
import com.neosquare.mentoring.InvalidMentoringRequestStateException;
import com.neosquare.mentoring.InvalidMentoringReservationStateException;
import com.neosquare.mentoring.InvalidMentoringReservationSessionEntryException;
import com.neosquare.mentoring.InvalidMentoringTargetRoleException;
import com.neosquare.mentoring.InvalidReservationTimeException;
import com.neosquare.mentoring.MentoringFeedbackAccessDeniedException;
import com.neosquare.mentoring.MentoringFeedbackNotFoundException;
import com.neosquare.mentoring.MentoringRequestAccessDeniedException;
import com.neosquare.mentoring.MentoringRequestNotFoundException;
import com.neosquare.mentoring.MentoringReservationAccessDeniedException;
import com.neosquare.mentoring.MentoringReservationFeedbackAccessDeniedException;
import com.neosquare.mentoring.MentoringReservationFeedbackNotFoundException;
import com.neosquare.mentoring.MentoringReservationNotFoundException;
import com.neosquare.mentoring.MentoringReservationScheduleConflictException;
import com.neosquare.mentoring.SelfMentoringRequestException;
import com.neosquare.mentoring.SelfMentoringReservationException;
import com.neosquare.mentoring.UserNotFoundException;
import com.neosquare.mentor.InvalidMentorApplicationStateException;
import com.neosquare.mentor.InvalidMentorAvailabilityException;
import com.neosquare.mentor.InvalidMentorCourseApplicationStateException;
import com.neosquare.mentor.InvalidMentorCourseScheduleException;
import com.neosquare.mentor.InvalidMentorCourseSessionEntryException;
import com.neosquare.mentor.MentorApplicationAccessDeniedException;
import com.neosquare.mentor.MentorApplicationNotFoundException;
import com.neosquare.mentor.MentorCourseApplicationAccessDeniedException;
import com.neosquare.mentor.MentorCourseApplicationNotFoundException;
import com.neosquare.mentor.MentorCourseNotFoundException;
import com.neosquare.mentor.MentorManagementAccessDeniedException;
import com.neosquare.notification.InvalidNotificationStateException;
import com.neosquare.notification.NotificationAccessDeniedException;
import com.neosquare.notification.NotificationNotFoundException;
import com.neosquare.space.SpaceNotFoundException;
import com.neosquare.study.InvalidStudySessionRequestException;
import com.neosquare.study.InvalidStudySessionStateException;
import com.neosquare.study.StudySessionAccessDeniedException;
import com.neosquare.study.StudySessionNotFoundException;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleMethodArgumentNotValidException(
            MethodArgumentNotValidException exception
    ) {
        Map<String, String> errors = new LinkedHashMap<>();

        exception.getBindingResult().getFieldErrors()
                .forEach(fieldError -> errors.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage()));

        ErrorResponse response = ErrorResponse.of(
                HttpStatus.BAD_REQUEST,
                "Validation failed.",
                errors
        );

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleHttpMessageNotReadableException(
            HttpMessageNotReadableException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.BAD_REQUEST,
                "Request body is invalid."
        );

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(DuplicateEmailException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateEmailException(DuplicateEmailException exception) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.CONFLICT,
                "Validation failed.",
                Map.of("email", exception.getMessage())
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(DuplicateNicknameException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateNicknameException(DuplicateNicknameException exception) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.CONFLICT,
                "Validation failed.",
                Map.of("nickname", exception.getMessage())
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCredentialsException(InvalidCredentialsException exception) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.UNAUTHORIZED,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @ExceptionHandler(InvalidRefreshTokenException.class)
    public ResponseEntity<ErrorResponse> handleInvalidRefreshTokenException(InvalidRefreshTokenException exception) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.UNAUTHORIZED,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @ExceptionHandler(SpaceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleSpaceNotFoundException(SpaceNotFoundException exception) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.NOT_FOUND,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(StudySessionNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleStudySessionNotFoundException(
            StudySessionNotFoundException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.NOT_FOUND,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleUserNotFoundException(UserNotFoundException exception) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.NOT_FOUND,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(NotificationNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotificationNotFoundException(NotificationNotFoundException exception) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.NOT_FOUND,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(MentoringFeedbackNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleMentoringFeedbackNotFoundException(
            MentoringFeedbackNotFoundException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.NOT_FOUND,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(MentoringReservationFeedbackNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleMentoringReservationFeedbackNotFoundException(
            MentoringReservationFeedbackNotFoundException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.NOT_FOUND,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(MentoringRequestNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleMentoringRequestNotFoundException(
            MentoringRequestNotFoundException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.NOT_FOUND,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(SelfMentoringRequestException.class)
    public ResponseEntity<ErrorResponse> handleSelfMentoringRequestException(
            SelfMentoringRequestException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.BAD_REQUEST,
                exception.getMessage()
        );

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(SelfMentoringReservationException.class)
    public ResponseEntity<ErrorResponse> handleSelfMentoringReservationException(
            SelfMentoringReservationException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.BAD_REQUEST,
                exception.getMessage()
        );

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(InvalidMentoringTargetRoleException.class)
    public ResponseEntity<ErrorResponse> handleInvalidMentoringTargetRoleException(
            InvalidMentoringTargetRoleException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.BAD_REQUEST,
                exception.getMessage()
        );

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(InvalidMentorCourseScheduleException.class)
    public ResponseEntity<ErrorResponse> handleInvalidMentorCourseScheduleException(
            InvalidMentorCourseScheduleException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.BAD_REQUEST,
                exception.getMessage()
        );

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(InvalidMentorCourseSessionEntryException.class)
    public ResponseEntity<ErrorResponse> handleInvalidMentorCourseSessionEntryException(
            InvalidMentorCourseSessionEntryException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.CONFLICT,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(DuplicateMentoringFeedbackException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateMentoringFeedbackException(
            DuplicateMentoringFeedbackException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.CONFLICT,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(DuplicateMentoringReservationFeedbackException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateMentoringReservationFeedbackException(
            DuplicateMentoringReservationFeedbackException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.CONFLICT,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(MentoringFeedbackAccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleMentoringFeedbackAccessDeniedException(
            MentoringFeedbackAccessDeniedException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.FORBIDDEN,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(MentoringReservationFeedbackAccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleMentoringReservationFeedbackAccessDeniedException(
            MentoringReservationFeedbackAccessDeniedException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.FORBIDDEN,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(NotificationAccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleNotificationAccessDeniedException(
            NotificationAccessDeniedException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.FORBIDDEN,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(MentoringRequestAccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleMentoringRequestAccessDeniedException(
            MentoringRequestAccessDeniedException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.FORBIDDEN,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(StudySessionAccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleStudySessionAccessDeniedException(
            StudySessionAccessDeniedException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.FORBIDDEN,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(MentoringReservationAccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleMentoringReservationAccessDeniedException(
            MentoringReservationAccessDeniedException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.FORBIDDEN,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(MentorApplicationAccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleMentorApplicationAccessDeniedException(
            MentorApplicationAccessDeniedException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.FORBIDDEN,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(MentorManagementAccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleMentorManagementAccessDeniedException(
            MentorManagementAccessDeniedException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.FORBIDDEN,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(AdminAccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAdminAccessDeniedException(
            AdminAccessDeniedException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.FORBIDDEN,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(MentorCourseApplicationAccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleMentorCourseApplicationAccessDeniedException(
            MentorCourseApplicationAccessDeniedException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.FORBIDDEN,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(InvalidStudySessionRequestException.class)
    public ResponseEntity<ErrorResponse> handleInvalidStudySessionRequestException(
            InvalidStudySessionRequestException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.BAD_REQUEST,
                exception.getMessage()
        );

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(InvalidNotificationStateException.class)
    public ResponseEntity<ErrorResponse> handleInvalidNotificationStateException(
            InvalidNotificationStateException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.CONFLICT,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(InvalidStudySessionStateException.class)
    public ResponseEntity<ErrorResponse> handleInvalidStudySessionStateException(
            InvalidStudySessionStateException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.CONFLICT,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(InvalidMentoringRequestStateException.class)
    public ResponseEntity<ErrorResponse> handleInvalidMentoringRequestStateException(
            InvalidMentoringRequestStateException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.CONFLICT,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(MentoringReservationNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleMentoringReservationNotFoundException(
            MentoringReservationNotFoundException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.NOT_FOUND,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(MentorApplicationNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleMentorApplicationNotFoundException(
            MentorApplicationNotFoundException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.NOT_FOUND,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(MentorCourseNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleMentorCourseNotFoundException(
            MentorCourseNotFoundException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.NOT_FOUND,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(MentorCourseApplicationNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleMentorCourseApplicationNotFoundException(
            MentorCourseApplicationNotFoundException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.NOT_FOUND,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(InvalidMentoringReservationStateException.class)
    public ResponseEntity<ErrorResponse> handleInvalidMentoringReservationStateException(
            InvalidMentoringReservationStateException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.CONFLICT,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(InvalidMentoringReservationSessionEntryException.class)
    public ResponseEntity<ErrorResponse> handleInvalidMentoringReservationSessionEntryException(
            InvalidMentoringReservationSessionEntryException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.CONFLICT,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(InvalidReservationTimeException.class)
    public ResponseEntity<ErrorResponse> handleInvalidReservationTimeException(
            InvalidReservationTimeException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.BAD_REQUEST,
                exception.getMessage()
        );

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(MentoringReservationScheduleConflictException.class)
    public ResponseEntity<ErrorResponse> handleMentoringReservationScheduleConflictException(
            MentoringReservationScheduleConflictException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.CONFLICT,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(InvalidMentorApplicationStateException.class)
    public ResponseEntity<ErrorResponse> handleInvalidMentorApplicationStateException(
            InvalidMentorApplicationStateException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.CONFLICT,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(InvalidMentorAvailabilityException.class)
    public ResponseEntity<ErrorResponse> handleInvalidMentorAvailabilityException(
            InvalidMentorAvailabilityException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.BAD_REQUEST,
                exception.getMessage()
        );

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(InvalidMentorCourseApplicationStateException.class)
    public ResponseEntity<ErrorResponse> handleInvalidMentorCourseApplicationStateException(
            InvalidMentorCourseApplicationStateException exception
    ) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.CONFLICT,
                exception.getMessage()
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> handleRuntimeException(RuntimeException exception) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected error occurred."
        );

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleException(Exception exception) {
        ErrorResponse response = ErrorResponse.of(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected error occurred."
        );

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
}
