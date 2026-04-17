package com.neosquare.user;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.neosquare.common.ApiResponse;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/mentors")
    public ApiResponse<List<MentorProfileResponse>> getMentors() {
        return ApiResponse.success("Mentor profiles retrieved.", userService.getMentors());
    }
}
