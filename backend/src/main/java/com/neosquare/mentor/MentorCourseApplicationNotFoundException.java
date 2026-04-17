package com.neosquare.mentor;

public class MentorCourseApplicationNotFoundException extends RuntimeException {

    public MentorCourseApplicationNotFoundException(Long applicationId) {
        super("Course application not found: " + applicationId);
    }
}
