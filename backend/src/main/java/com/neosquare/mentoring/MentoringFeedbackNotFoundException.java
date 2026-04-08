package com.neosquare.mentoring;

public class MentoringFeedbackNotFoundException extends RuntimeException {

    public MentoringFeedbackNotFoundException(Long feedbackId) {
        super("Session feedback not found: " + feedbackId);
    }

    public MentoringFeedbackNotFoundException(String message) {
        super(message);
    }
}
