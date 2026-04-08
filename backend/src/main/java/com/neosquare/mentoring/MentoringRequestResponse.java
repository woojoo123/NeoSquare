package com.neosquare.mentoring;

import java.time.Instant;

public record MentoringRequestResponse(
        Long id,
        Long requesterId,
        String requesterLabel,
        String requesterNickname,
        Long mentorId,
        String mentorLabel,
        String mentorNickname,
        String message,
        MentoringRequestStatus status,
        Instant createdAt,
        Instant completedAt
) {

    public static MentoringRequestResponse from(MentoringRequest mentoringRequest) {
        return new MentoringRequestResponse(
                mentoringRequest.getId(),
                mentoringRequest.getRequester().getId(),
                mentoringRequest.getRequester().getNickname(),
                mentoringRequest.getRequester().getNickname(),
                mentoringRequest.getMentor().getId(),
                mentoringRequest.getMentor().getNickname(),
                mentoringRequest.getMentor().getNickname(),
                mentoringRequest.getMessage(),
                mentoringRequest.getStatus(),
                mentoringRequest.getCreatedAt(),
                mentoringRequest.getCompletedAt()
        );
    }
}
