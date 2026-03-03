package org.editor.control.mapping;

import org.editor.entity.dto.CanvasDto;
import org.editor.entity.dto.CanvasMeta;
import org.editor.entity.mongo.Canvas;
import org.springframework.stereotype.Component;

@Component
public class CanvasMapper {

    public CanvasMeta mapToMeta(Canvas canvas) {
        return new CanvasMeta(canvas.getId(), canvas.getTitle(), canvas.getCreatedAt(), canvas.getUpdatedAt());
    }

    public Canvas mapToCanvas(String name, String state) {
        return new Canvas(name, state);
    }

    public CanvasDto mapToCanvasDto(Canvas canvas) {
        return CanvasDto.builder()
                .id(canvas.getId())
                .title(canvas.getTitle())
                .createdAt(canvas.getCreatedAt())
                .updatedAt(canvas.getUpdatedAt())
                .state(canvas.getState())
                .build();
    }
}
