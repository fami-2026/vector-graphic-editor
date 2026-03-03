package org.editor.control.service;

import static java.util.Objects.*;

import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.editor.control.dao.CanvasRepository;
import org.editor.control.handler.exception.CanvasNotExistException;
import org.editor.control.handler.exception.EditorValidationException;
import org.editor.control.mapping.CanvasMapper;
import org.editor.entity.dto.CanvasMeta;
import org.editor.entity.mongo.Canvas;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class CanvasServiceImpl implements CanvasService {

    private final CanvasRepository canvasRepository;

    private final CanvasMapper canvasMapper;

    @Override
    public List<CanvasMeta> getAllMeta() {
        return canvasRepository.findAll().stream().map(canvasMapper::mapToMeta).toList();
    }

    @Override
    public Canvas get(String id) {
        return canvasRepository.findById(id).orElseThrow(CanvasNotExistException::new);
    }

    @Override
    public CanvasMeta create(String title, String state) {
        if (isNull(title) || isNull(state) || title.isBlank() || state.isBlank()) {
            throw new EditorValidationException("Not all required fields are represented");
        }

        Canvas canvas = canvasRepository.save(canvasMapper.mapToCanvas(title, state));
        return canvasMapper.mapToMeta(canvas);
    }

    @Override
    public CanvasMeta update(String id, String title, String state) {
        Canvas canvas = get(id);

        if (nonNull(title)) {
            canvas.setTitle(title);
        }

        if (nonNull(canvas.getState())) {
            canvas.setState(canvas.getState());
        }

        canvas = canvasRepository.save(canvas);
        return canvasMapper.mapToMeta(canvas);
    }

    @Override
    public void delete(String id) {
        canvasRepository.delete(get(id));
    }
}
