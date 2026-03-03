package org.editor.entity.dto;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CanvasMeta {

    private String id;

    private String title;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
