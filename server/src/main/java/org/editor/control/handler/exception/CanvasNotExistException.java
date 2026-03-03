package org.editor.control.handler.exception;

public class CanvasNotExistException extends EditorException {
    public CanvasNotExistException(String message) {
        super(message);
    }

    public CanvasNotExistException() {
        super("Canvas not exist");
    }
}
