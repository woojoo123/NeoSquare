package com.neosquare.health;

import java.util.Map;

import com.neosquare.common.ApiResponse;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    @GetMapping
    public ApiResponse<Map<String, String>> health() {
        return ApiResponse.success(
                "Health check succeeded.",
                Map.of(
                        "status", "ok",
                        "service", "NeoSquare"
                )
        );
    }
}
