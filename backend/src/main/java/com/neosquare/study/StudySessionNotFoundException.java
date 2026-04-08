package com.neosquare.study;

public class StudySessionNotFoundException extends RuntimeException {

    public StudySessionNotFoundException(Long studySessionId) {
        super("Study session not found: " + studySessionId);
    }
}
