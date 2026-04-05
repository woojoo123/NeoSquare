package com.neosquare.space;

import java.util.List;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class SpaceDataInitializer implements CommandLineRunner {

    private final SpaceRepository spaceRepository;

    public SpaceDataInitializer(SpaceRepository spaceRepository) {
        this.spaceRepository = spaceRepository;
    }

    @Override
    public void run(String... args) {
        if (spaceRepository.count() > 0) {
            return;
        }

        spaceRepository.saveAll(List.of(
                Space.create(
                        "Main Square",
                        SpaceType.MAIN,
                        "The central plaza where users gather, explore, and start conversations.",
                        500,
                        true
                ),
                Space.create(
                        "Study Lounge",
                        SpaceType.STUDY,
                        "A focused space for study sessions, group work, and collaborative learning.",
                        120,
                        true
                ),
                Space.create(
                        "Mentoring Room",
                        SpaceType.MENTORING,
                        "A quieter room for scheduled mentoring and one-on-one guidance.",
                        40,
                        true
                )
        ));
    }
}
