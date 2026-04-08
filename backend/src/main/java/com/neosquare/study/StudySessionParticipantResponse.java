package com.neosquare.study;

import java.time.Instant;

public record StudySessionParticipantResponse(
        Long userId,
        String label,
        String nickname,
        StudySessionParticipantRole role,
        Instant joinedAt
) {

    public static StudySessionParticipantResponse from(StudySessionParticipant participant) {
        return new StudySessionParticipantResponse(
                participant.getUser().getId(),
                participant.getUser().getNickname(),
                participant.getUser().getNickname(),
                participant.getRole(),
                participant.getJoinedAt()
        );
    }
}
