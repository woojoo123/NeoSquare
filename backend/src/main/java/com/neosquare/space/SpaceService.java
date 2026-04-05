package com.neosquare.space;

import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SpaceService {

    private final SpaceRepository spaceRepository;

    public SpaceService(SpaceRepository spaceRepository) {
        this.spaceRepository = spaceRepository;
    }

    @Transactional(readOnly = true)
    public List<SpaceResponse> getSpaces() {
        return spaceRepository.findAll(Sort.by(Sort.Direction.ASC, "id")).stream()
                .map(SpaceResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public SpaceResponse getSpace(Long spaceId) {
        Space space = spaceRepository.findById(spaceId)
                .orElseThrow(() -> new SpaceNotFoundException(spaceId));

        return SpaceResponse.from(space);
    }
}
