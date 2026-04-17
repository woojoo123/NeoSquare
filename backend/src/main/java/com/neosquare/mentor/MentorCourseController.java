package com.neosquare.mentor;

import com.neosquare.common.ApiResponse;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mentor-courses")
public class MentorCourseController {

    private final MentorCourseQueryService mentorCourseQueryService;

    public MentorCourseController(MentorCourseQueryService mentorCourseQueryService) {
        this.mentorCourseQueryService = mentorCourseQueryService;
    }

    @GetMapping("/{courseId}")
    public ApiResponse<MentorCourseDetailResponse> getCourseDetail(@PathVariable Long courseId) {
        return ApiResponse.success(
                "Mentor course retrieved.",
                mentorCourseQueryService.getCourseDetail(courseId)
        );
    }
}
