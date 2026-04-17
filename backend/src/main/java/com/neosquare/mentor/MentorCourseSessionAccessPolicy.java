package com.neosquare.mentor;

import java.time.Duration;
import java.time.Instant;

import org.springframework.stereotype.Component;

@Component
public class MentorCourseSessionAccessPolicy {

    private static final Duration ENTRY_OPEN_OFFSET = Duration.ofMinutes(10);
    private static final Duration ENTRY_CLOSE_OFFSET = Duration.ofMinutes(30);

    public MentorCourseSessionWindow resolveSessionWindow(MentorCourseApplication application) {
        MentorCourseScheduleItem assignedScheduleItem = application.getAssignedScheduleItem();

        if (assignedScheduleItem == null) {
            throw new InvalidMentorCourseSessionEntryException(
                    "This course application does not have an assigned session schedule yet."
            );
        }

        Instant sessionStartsAt = assignedScheduleItem.getStartsAt();
        Instant sessionEndsAt = assignedScheduleItem.getEndsAt();
        Instant sessionCloseBase = sessionEndsAt != null && sessionEndsAt.isAfter(sessionStartsAt)
                ? sessionEndsAt
                : sessionStartsAt;

        return new MentorCourseSessionWindow(
                sessionStartsAt.minus(ENTRY_OPEN_OFFSET),
                sessionCloseBase.plus(ENTRY_CLOSE_OFFSET)
        );
    }

    public MentorCourseSessionWindow resolveSessionWindowOrNull(MentorCourseApplication application) {
        if (application.getAssignedScheduleItem() == null) {
            return null;
        }

        return resolveSessionWindow(application);
    }

    public void validateSessionEntry(MentorCourseApplication application) {
        if (application.getStatus() != MentorCourseApplicationStatus.APPROVED) {
            throw new InvalidMentorCourseSessionEntryException(
                    "Only approved course applications can enter this session."
            );
        }

        MentorCourseSessionWindow sessionWindow = resolveSessionWindow(application);
        Instant now = Instant.now();

        if (now.isBefore(sessionWindow.entryOpenAt())) {
            throw new InvalidMentorCourseSessionEntryException(
                    "Course session entry is not open yet."
            );
        }

        if (now.isAfter(sessionWindow.entryCloseAt())) {
            throw new InvalidMentorCourseSessionEntryException(
                    "Course session entry window has expired."
            );
        }
    }
}
