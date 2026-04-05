package com.neosquare.space;

public record SpaceResponse(
        Long id,
        String name,
        SpaceType type,
        String description,
        int maxCapacity,
        boolean isPublic
) {

    public static SpaceResponse from(Space space) {
        return new SpaceResponse(
                space.getId(),
                space.getName(),
                space.getType(),
                space.getDescription(),
                space.getMaxCapacity(),
                space.isPublic()
        );
    }
}
