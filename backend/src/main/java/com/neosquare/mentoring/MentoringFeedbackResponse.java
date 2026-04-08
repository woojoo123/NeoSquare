package com.neosquare.mentoring;

import java.time.Instant;
import java.util.Objects;

public record MentoringFeedbackResponse(
        Long id,
        Long requestId,
        Long authorId,
        String authorLabel,
        String authorRole,
        Long targetUserId,
        String targetUserLabel,
        int rating,
        String summary,
        String feedback,
        String sessionSource,
        Instant createdAt
) {

    public static MentoringFeedbackResponse from(MentoringFeedback mentoringFeedback) {
        String authorRole = Objects.equals(
                mentoringFeedback.getAuthor().getId(),
                mentoringFeedback.getRequest().getRequester().getId()
        ) ? "Requester" : "Mentor";

        return new MentoringFeedbackResponse(
                mentoringFeedback.getId(),
                mentoringFeedback.getRequest().getId(),
                mentoringFeedback.getAuthor().getId(),
                mentoringFeedback.getAuthor().getNickname(),
                authorRole,
                mentoringFeedback.getTargetUser().getId(),
                mentoringFeedback.getTargetUser().getNickname(),
                mentoringFeedback.getRating(),
                mentoringFeedback.getSummary(),
                mentoringFeedback.getFeedback(),
                "request",
                mentoringFeedback.getCreatedAt()
        );
    }
}
