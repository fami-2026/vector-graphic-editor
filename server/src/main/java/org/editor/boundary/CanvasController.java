package org.editor.boundary;

import lombok.RequiredArgsConstructor;
import org.editor.control.mapping.CanvasMapper;
import org.editor.control.service.CanvasService;
import org.editor.entity.dto.CanvasDto;
import org.editor.entity.dto.Response;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/canvas")
@RequiredArgsConstructor
public class CanvasController {

    private final CanvasService canvasService;
    private final CanvasMapper canvasMapper;

    @GetMapping
    public Response getCanvasesMeta() {
        return new Response(HttpStatus.OK.value(), canvasService.getAllMeta());
    }

    @GetMapping("/{id}")
    public Response getCanvas(@PathVariable String id) {
        return new Response(HttpStatus.OK.value(), null, canvasMapper.mapToCanvasDto(canvasService.get(id)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Response createCanvas(@RequestBody CanvasDto canvasDto) {
        return new Response(HttpStatus.CREATED.value(), canvasService.create(canvasDto.title(), canvasDto.state()));
    }

    @PutMapping("/{id}")
    public Response updateCanvas(@PathVariable String id, @RequestBody CanvasDto canvasDto) {
        return new Response(HttpStatus.OK.value(), canvasService.update(id, canvasDto.title(), canvasDto.state()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Response deleteCanvas(@PathVariable String id) {
        canvasService.delete(id);
        return new Response(HttpStatus.NO_CONTENT.value());
    }
}
