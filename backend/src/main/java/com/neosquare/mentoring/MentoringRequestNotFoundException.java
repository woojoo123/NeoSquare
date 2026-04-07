package com.neosquare.mentoring;

public class MentoringRequestNotFoundException extends RuntimeException {

    public MentoringRequestNotFoundException(Long requestId) {
        super("Mentoring request not found: " + requestId);
    }
}
