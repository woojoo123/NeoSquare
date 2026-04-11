package com.neosquare.auth;

public class DuplicateEmailException extends RuntimeException {

    public DuplicateEmailException() {
        super("Email already exists.");
    }
}
