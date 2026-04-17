package com.neosquare.mentor;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MentorAvailabilitySlotRepository extends JpaRepository<MentorAvailabilitySlot, Long> {

    List<MentorAvailabilitySlot> findAllByMentor_Id(Long mentorId);

    void deleteAllByMentor_Id(Long mentorId);
}
