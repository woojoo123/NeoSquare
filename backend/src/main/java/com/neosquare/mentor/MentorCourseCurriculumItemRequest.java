package com.neosquare.mentor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MentorCourseCurriculumItemRequest(
        @NotBlank(message = "curriculumItems.title is required.")
        @Size(max = 120, message = "curriculumItems.title must be at most 120 characters.")
        String title,
        @NotBlank(message = "curriculumItems.description is required.")
        @Size(max = 1000, message = "curriculumItems.description must be at most 1000 characters.")
        String description
) {
}
