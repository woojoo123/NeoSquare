package com.neosquare.auth;

public class DuplicateNicknameException extends RuntimeException {

    public DuplicateNicknameException() {
        super("Nickname already exists.");
    }
}
