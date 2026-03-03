package org.editor.control.handler;

import org.editor.control.handler.exception.EditorException;
import org.editor.entity.dto.Response;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.ResponseStatus;

@ControllerAdvice
public class EditorHandler {

    @ExceptionHandler
    @ResponseBody
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Response catchException(EditorException e) {
        return new Response(HttpStatus.BAD_REQUEST.value(), e.getMessage());
    }
}
