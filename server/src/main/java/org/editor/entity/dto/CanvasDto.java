package org.editor.entity.dto;

import java.time.LocalDateTime;
import lombok.Builder;

@Builder
public record CanvasDto(String id, String title, LocalDateTime createdAt, LocalDateTime updatedAt, String state) {}
