package com.neosquare.study;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

public record StudySessionResponse(
        Long id,
        Long spaceId,
        String spaceName,
        Long hostId,
        String hostLabel,
        String hostNickname,
        String title,
        String description,
        StudySessionStatus status,
        List<StudySessionParticipantResponse> participants,
        int participantCount,
        boolean joined,
        Instant createdAt,
        Instant completedAt
) {

    public static StudySessionResponse from(StudySession studySession, Long currentUserId) {
        List<StudySessionParticipantResponse> participantResponses = studySession.getParticipants().stream()
                .sorted(Comparator
                        .comparing(
                                StudySessionParticipant::getJoinedAt,
                                Comparator.nullsLast(Comparator.naturalOrder())
                        )
                        .thenComparing(
                                StudySessionParticipant::getId,
                                Comparator.nullsLast(Comparator.naturalOrder())
                        ))
                .map(StudySessionParticipantResponse::from)
                .toList();

        return new StudySessionResponse(
                studySession.getId(),
                studySession.getSpace().getId(),
                studySession.getSpace().getName(),
                studySession.getHost().getId(),
                studySession.getHost().getNickname(),
                studySession.getHost().getNickname(),
                studySession.getTitle(),
                studySession.getDescription(),
                studySession.getStatus(),
                participantResponses,
                studySession.getParticipantCount(),
                currentUserId != null && studySession.isParticipant(currentUserId),
                studySession.getCreatedAt(),
                studySession.getCompletedAt()
        );
    }
}
