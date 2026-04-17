package com.neosquare.user;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByNickname(String nickname);

    List<User> findAllByRoleInOrderByNicknameAsc(List<UserRole> roles);

    List<User> findAllByRoleInAndProfile_MentorEnabledTrueOrderByNicknameAsc(List<UserRole> roles);
}
