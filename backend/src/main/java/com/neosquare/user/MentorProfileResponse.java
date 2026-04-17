package com.neosquare.user;

import java.util.List;

import com.neosquare.mentor.MentorAvailabilitySlotResponse;
import com.neosquare.mentor.MentorCourseResponse;
import com.neosquare.profile.Profile;

public record MentorProfileResponse(
        Long id,
        String nickname,
        UserRole role,
        String bio,
        String interests,
        String specialties,
        String avatarUrl,
        boolean mentorEnabled,
        List<MentorAvailabilitySlotResponse> availabilitySlots,
        List<MentorCourseResponse> courses
) {

    public static MentorProfileResponse from(
            User user,
            List<MentorAvailabilitySlotResponse> availabilitySlots,
            List<MentorCourseResponse> courses
    ) {
        Profile profile = user.getProfile();

        return new MentorProfileResponse(
                user.getId(),
                user.getNickname(),
                user.getRole(),
                profile.getBio(),
                profile.getInterests(),
                profile.getSpecialties(),
                profile.getAvatarUrl(),
                profile.isMentorEnabled(),
                availabilitySlots,
                courses
        );
    }
}
