package com.neosquare.profile;

import java.util.Objects;

import com.neosquare.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "profiles")
public class Profile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 1000)
    private String bio;

    @Column(length = 500)
    private String interests;

    @Column(length = 500)
    private String specialties;

    @Column(length = 500)
    private String avatarUrl;

    @Column(nullable = false)
    private boolean mentorEnabled;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    protected Profile() {
    }

    private Profile(
            String bio,
            String interests,
            String specialties,
            String avatarUrl,
            boolean mentorEnabled
    ) {
        this.bio = bio;
        this.interests = interests;
        this.specialties = specialties;
        this.avatarUrl = avatarUrl;
        this.mentorEnabled = mentorEnabled;
    }

    public static Profile create() {
        return new Profile(null, null, null, null, false);
    }

    public static Profile create(
            String bio,
            String interests,
            String specialties,
            String avatarUrl,
            boolean mentorEnabled
    ) {
        return new Profile(bio, interests, specialties, avatarUrl, mentorEnabled);
    }

    public void attachUser(User user) {
        this.user = Objects.requireNonNull(user);

        if (user.getProfile() != this) {
            user.assignProfile(this);
        }
    }

    public void update(
            String bio,
            String interests,
            String specialties,
            String avatarUrl,
            boolean mentorEnabled
    ) {
        this.bio = bio;
        this.interests = interests;
        this.specialties = specialties;
        this.avatarUrl = avatarUrl;
        this.mentorEnabled = mentorEnabled;
    }

    public void enableMentoring() {
        this.mentorEnabled = true;
    }

    public void disableMentoring() {
        this.mentorEnabled = false;
    }

    public Long getId() {
        return id;
    }

    public String getBio() {
        return bio;
    }

    public String getInterests() {
        return interests;
    }

    public String getSpecialties() {
        return specialties;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public boolean isMentorEnabled() {
        return mentorEnabled;
    }

    public User getUser() {
        return user;
    }
}
