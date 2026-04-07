package com.neosquare.mentoring;

public class SelfMentoringRequestException extends RuntimeException {

    public SelfMentoringRequestException() {
        super("You cannot send a mentoring request to yourself.");
    }
}
