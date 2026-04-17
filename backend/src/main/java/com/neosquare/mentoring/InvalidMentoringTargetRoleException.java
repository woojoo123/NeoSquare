package com.neosquare.mentoring;

public class InvalidMentoringTargetRoleException extends RuntimeException {

    public InvalidMentoringTargetRoleException() {
        super("멘토링 요청과 예약은 멘토 계정에게만 보낼 수 있습니다.");
    }
}
