package com.neosquare.mentor;

public record MentorCourseCurriculumItemResponse(
        Long id,
        int sequence,
        String title,
        String description
) {

    public static MentorCourseCurriculumItemResponse from(MentorCourseCurriculumItem item) {
        return new MentorCourseCurriculumItemResponse(
                item.getId(),
                item.getSequence(),
                item.getTitle(),
                item.getDescription()
        );
    }
}
