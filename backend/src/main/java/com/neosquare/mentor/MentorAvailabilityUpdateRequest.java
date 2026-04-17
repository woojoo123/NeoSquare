package com.neosquare.mentor;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record MentorAvailabilityUpdateRequest(
        @NotNull(message = "slots is required.")
        @Valid
        List<MentorAvailabilitySlotRequest> slots
) {
}
