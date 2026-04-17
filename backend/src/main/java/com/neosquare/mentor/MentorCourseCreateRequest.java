package com.neosquare.mentor;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record MentorCourseCreateRequest(
        @NotBlank(message = "title is required.")
        @Size(max = 120, message = "title must be at most 120 characters.")
        String title,
        @NotBlank(message = "summary is required.")
        @Size(max = 240, message = "summary must be at most 240 characters.")
        String summary,
        @NotBlank(message = "description is required.")
        @Size(max = 2000, message = "description must be at most 2000 characters.")
        String description,
        @NotBlank(message = "meetingType is required.")
        @Size(max = 40, message = "meetingType must be at most 40 characters.")
        String meetingType,
        @NotNull(message = "price is required.")
        @PositiveOrZero(message = "price must be zero or positive.")
        Integer price,
        @NotNull(message = "capacity is required.")
        @Positive(message = "capacity must be positive.")
        Integer capacity,
        @NotNull(message = "curriculumItems is required.")
        @Valid
        List<MentorCourseCurriculumItemRequest> curriculumItems,
        @NotNull(message = "scheduleItems is required.")
        @Valid
        List<MentorCourseScheduleItemRequest> scheduleItems,
        @NotNull(message = "status is required.")
        MentorCourseStatus status
) {
}
