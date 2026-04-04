package com.neosquare.common;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)  // null 인 필드는 JSON에서 빼기
public record ApiResponse<T>(
        boolean success,
        String message,
        T data
) {

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, null, data);
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<>(true, message, data);
    }

    public static ApiResponse<Void> success(String message) {
        return new ApiResponse<>(true, message, null);
    }
}
