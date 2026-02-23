package org.editor.entity.dto;

public record Response(int code, String message, Object data) {

    public Response(int code, Object data) {
        this(code, null, data);
    }

    public Response(int code) {
        this(code, null);
    }
}