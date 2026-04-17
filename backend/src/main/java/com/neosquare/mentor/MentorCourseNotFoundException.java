package com.neosquare.mentor;

public class MentorCourseNotFoundException extends RuntimeException {

    public MentorCourseNotFoundException(Long courseId) {
        super("Mentor course not found: " + courseId);
    }
}
