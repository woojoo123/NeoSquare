package com.neosquare.mentor;

public class MentorApplicationNotFoundException extends RuntimeException {

    public MentorApplicationNotFoundException(Long mentorApplicationId) {
        super("Mentor application not found: " + mentorApplicationId);
    }
}
