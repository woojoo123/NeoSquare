package com.neosquare.space;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import jakarta.transaction.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SpaceIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SpaceRepository spaceRepository;

    @Test
    void getSpacesReturnsSeededSpaces() throws Exception {
        mockMvc.perform(get("/api/spaces"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Space list retrieved."))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(3))
                .andExpect(jsonPath("$.data[0].name").value("Main Square"))
                .andExpect(jsonPath("$.data[1].name").value("Study Lounge"))
                .andExpect(jsonPath("$.data[2].name").value("Mentoring Room"));
    }

    @Test
    void getSpaceReturnsSingleSpace() throws Exception {
        List<Space> spaces = spaceRepository.findAll();
        Space mainSquare = spaces.stream()
                .filter(space -> space.getName().equals("Main Square"))
                .findFirst()
                .orElseThrow();

        mockMvc.perform(get("/api/spaces/{spaceId}", mainSquare.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Space retrieved."))
                .andExpect(jsonPath("$.data.id").value(mainSquare.getId()))
                .andExpect(jsonPath("$.data.name").value("Main Square"))
                .andExpect(jsonPath("$.data.type").value(SpaceType.MAIN.name()))
                .andExpect(jsonPath("$.data.description").value(
                        "The central plaza where users gather, explore, and start conversations."
                ))
                .andExpect(jsonPath("$.data.maxCapacity").value(500))
                .andExpect(jsonPath("$.data.isPublic").value(true));
    }

    @Test
    void getSpaceWithUnknownIdReturnsNotFound() throws Exception {
        Long missingId = spaceRepository.findAll().stream()
                .mapToLong(Space::getId)
                .max()
                .orElse(0L) + 100L;

        mockMvc.perform(get("/api/spaces/{spaceId}", missingId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Space not found: " + missingId))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void seededSpacesExistInRepository() {
        List<Space> spaces = spaceRepository.findAll();

        assertThat(spaces).hasSize(3);
        assertThat(spaces)
                .extracting(Space::getName)
                .containsExactlyInAnyOrder("Main Square", "Study Lounge", "Mentoring Room");
    }
}
