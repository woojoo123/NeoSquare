package com.neosquare.space;

import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "spaces")
public class Space {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SpaceType type;

    @Column(nullable = false, length = 1000)
    private String description;

    @Column(nullable = false)
    private int maxCapacity;

    @Column(name = "is_public", nullable = false)
    private boolean isPublic;

    protected Space() {
    }

    private Space(
            String name,
            SpaceType type,
            String description,
            int maxCapacity,
            boolean isPublic
    ) {
        this.name = Objects.requireNonNull(name);
        this.type = Objects.requireNonNull(type);
        this.description = Objects.requireNonNull(description);
        this.maxCapacity = maxCapacity;
        this.isPublic = isPublic;
    }

    public static Space create(
            String name,
            SpaceType type,
            String description,
            int maxCapacity,
            boolean isPublic
    ) {
        return new Space(name, type, description, maxCapacity, isPublic);
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public SpaceType getType() {
        return type;
    }

    public String getDescription() {
        return description;
    }

    public int getMaxCapacity() {
        return maxCapacity;
    }

    public boolean isPublic() {
        return isPublic;
    }
}
