package com.neosquare.space;

import java.util.List;

import com.neosquare.common.ApiResponse;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/spaces")
public class SpaceController {

    private final SpaceService spaceService;

    public SpaceController(SpaceService spaceService) {
        this.spaceService = spaceService;
    }

    @GetMapping
    public ApiResponse<List<SpaceResponse>> getSpaces() {
        return ApiResponse.success(
                "Space list retrieved.",
                spaceService.getSpaces()
        );
    }

    @GetMapping("/{spaceId}")
    public ApiResponse<SpaceResponse> getSpace(@PathVariable Long spaceId) {
        return ApiResponse.success(
                "Space retrieved.",
                spaceService.getSpace(spaceId)
        );
    }
}
