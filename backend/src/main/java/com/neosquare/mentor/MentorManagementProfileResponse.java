package com.neosquare.mentor;

import java.util.List;

import com.neosquare.user.User;
import com.neosquare.user.UserRole;

public record MentorManagementProfileResponse(
        Long userId,
        String email,
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

    public static MentorManagementProfileResponse of(
            User user,
            List<MentorAvailabilitySlotResponse> availabilitySlots,
            List<MentorCourseResponse> courses
    ) {
        return new MentorManagementProfileResponse(
                user.getId(),
                user.getEmail(),
                user.getNickname(),
                user.getRole(),
                user.getProfile().getBio(),
                user.getProfile().getInterests(),
                user.getProfile().getSpecialties(),
                user.getProfile().getAvatarUrl(),
                user.getProfile().isMentorEnabled(),
                availabilitySlots,
                courses
        );
    }
}
