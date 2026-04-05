package com.neosquare.space;

public class SpaceNotFoundException extends RuntimeException {

    public SpaceNotFoundException(Long spaceId) {
        super("Space not found: " + spaceId);
    }
}
