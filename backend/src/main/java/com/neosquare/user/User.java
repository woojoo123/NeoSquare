package com.neosquare.user;

import java.util.Objects;

import com.neosquare.profile.Profile;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "users",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_users_email", columnNames = "email"),
                @UniqueConstraint(name = "uk_users_nickname", columnNames = "nickname")
        }
)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false, length = 255)
    private String password;

    @Column(nullable = false, unique = true, length = 50)
    private String nickname;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserRole role;

    @OneToOne(
            mappedBy = "user",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.LAZY,
            optional = false
    )
    private Profile profile;

    protected User() {
    }

    private User(String email, String password, String nickname, UserRole role) {
        this.email = Objects.requireNonNull(email);
        this.password = Objects.requireNonNull(password);
        this.nickname = Objects.requireNonNull(nickname);
        this.role = Objects.requireNonNull(role);
    }

    public static User create(String email, String password, String nickname) {
        return create(email, password, nickname, UserRole.USER);
    }

    public static User create(String email, String password, String nickname, UserRole role) {
        User user = new User(email, password, nickname, role);
        user.assignProfile(Profile.create());
        return user;
    }

    public void assignProfile(Profile profile) {
        this.profile = Objects.requireNonNull(profile);

        if (profile.getUser() != this) {
            profile.attachUser(this);
        }
    }

    public void changePassword(String password) {
        this.password = Objects.requireNonNull(password);
    }

    public void changeNickname(String nickname) {
        this.nickname = Objects.requireNonNull(nickname);
    }

    public void changeRole(UserRole role) {
        this.role = Objects.requireNonNull(role);
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPassword() {
        return password;
    }

    public String getNickname() {
        return nickname;
    }

    public UserRole getRole() {
        return role;
    }

    public Profile getProfile() {
        return profile;
    }
}
