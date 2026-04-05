package com.neosquare.auth;

public class DuplicateEmailException extends RuntimeException {

    public DuplicateEmailException(String email) {
        super("Email already exists: " + email);
    }
}
