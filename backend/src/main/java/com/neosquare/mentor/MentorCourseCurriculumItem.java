package com.neosquare.mentor;

import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "mentor_course_curriculum_items")
public class MentorCourseCurriculumItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private MentorCourse course;

    @Column(nullable = false)
    private int sequence;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 1000)
    private String description;

    protected MentorCourseCurriculumItem() {
    }

    private MentorCourseCurriculumItem(MentorCourse course, int sequence, String title, String description) {
        this.course = Objects.requireNonNull(course);
        this.sequence = sequence;
        this.title = Objects.requireNonNull(title);
        this.description = Objects.requireNonNull(description);
    }

    public static MentorCourseCurriculumItem create(
            MentorCourse course,
            int sequence,
            String title,
            String description
    ) {
        return new MentorCourseCurriculumItem(course, sequence, title, description);
    }

    public Long getId() {
        return id;
    }

    public MentorCourse getCourse() {
        return course;
    }

    public int getSequence() {
        return sequence;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }
}
