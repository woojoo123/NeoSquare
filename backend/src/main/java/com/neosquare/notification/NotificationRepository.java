package com.neosquare.notification;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    @EntityGraph(attributePaths = {"recipient"})
    List<Notification> findAllByRecipient_IdOrderByReadAscCreatedAtDescIdDesc(Long recipientId);

    @EntityGraph(attributePaths = {"recipient"})
    List<Notification> findAllByRecipient_IdAndReadFalseOrderByCreatedAtDescIdDesc(Long recipientId);

    @EntityGraph(attributePaths = {"recipient"})
    Optional<Notification> findDetailById(Long id);
}
