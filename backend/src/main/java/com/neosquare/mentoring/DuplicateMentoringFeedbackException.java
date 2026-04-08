package com.neosquare.mentoring;

public class DuplicateMentoringFeedbackException extends RuntimeException {

    public DuplicateMentoringFeedbackException(Long requestId) {
        super("Feedback already exists for request: " + requestId);
    }
}
