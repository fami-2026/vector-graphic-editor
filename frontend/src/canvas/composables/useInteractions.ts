import { ref, watch, type Ref } from 'vue';
import type { Shape, Point, BoundingBox, LineShape } from '@/canvas/types';
import { useCanvasStore } from '@/stores/canvas';
import { useToolsStore, type ToolType } from '@/stores/tools';
import { SELECTION_PADDING } from '@/canvas/types';

type ResizeHandle =
    | 'l'
    | 'r'
    | 't'
    | 'b'
    | 'lt'
    | 'rt'
    | 'lb'
    | 'rb'
    | 's'
    | 'e'
    | 'rot';

/**
 * Composable для управления взаимодействиями пользователя (мышь, drag&drop).
 */

export function useInteractions(
    canvasRef: Ref<HTMLCanvasElement | null>,
    shapes: Ref<Shape[]>,
    zoom: Ref<number>,
    pan: Ref<{ x: number; y: number }>
) {
    const canvasStore = useCanvasStore();
    const toolsStore = useToolsStore();

    const isDragging = ref(false);
    const isResizing = ref(false);
    const isCreating = ref(false);
    const isPanning = ref(false);

    const dragStart = ref<Point>({ x: 0, y: 0 });
    const panStart = ref<Point>({ x: 0, y: 0 });
    const activeShape = ref<Shape | null>(null);
    const resizeHandle = ref<ResizeHandle | null>(null);

    const resizeStartLocalBox = ref<BoundingBox | null>(null);
    const resizeStartMatrix = ref<DOMMatrix | null>(null);
    const resizeStartInverse = ref<DOMMatrix | null>(null);
    const resizeStartScale = ref<Point>({ x: 1, y: 1 });
    const lineStartLocal = ref<Point | null>(null);
    const hasRecordedInteraction = ref(false);
    const createStart = ref<Point | null>(null);
    const createToolType = ref<ToolType | null>(null);
    const createParams = ref<Record<string, unknown> | null>(null);

    // Синхронизация выделенной фигуры из стора
    watch(
        [() => canvasStore.selectedId, shapes],
        () => {
            if (isCreating.value) return;
            const selected =
                shapes.value.find(
                    (shape) => shape.id === canvasStore.selectedId
                ) ?? null;
            activeShape.value = selected;

            if (!selected) {
                isDragging.value = false;
                isResizing.value = false;
                resizeHandle.value = null;
                resizeStartLocalBox.value = null;
                resizeStartMatrix.value = null;
                resizeStartInverse.value = null;
                lineStartLocal.value = null;
                createStart.value = null;
                createToolType.value = null;
                createParams.value = null;
            }
        },
        { immediate: true }
    );

    /**
     * Конвертирует экранные координаты события мыши в локальные координаты холста.
     */
    function getLocalPoint(e: MouseEvent): Point {
        const rect = canvasRef.value?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };

        const zoomFactor = zoom.value / 100;
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        return {
            x: centerX + (screenX - centerX - pan.value.x) / zoomFactor,
            y: centerY + (screenY - centerY - pan.value.y) / zoomFactor,
        };
    }

    function onWheel(e: WheelEvent) {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();

            const rect = canvasRef.value?.getBoundingClientRect();
            if (!rect) return;

            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const oldZoom = zoom.value;

            const worldX = getLocalPoint(e).x;
            const worldY = getLocalPoint(e).y;

            const delta =
                e.deltaY > 0 ? -canvasStore.ZOOM_STEP : canvasStore.ZOOM_STEP;
            const newZoom = Math.max(
                canvasStore.MIN_ZOOM,
                Math.min(canvasStore.MAX_ZOOM, oldZoom + delta)
            );
            const newZoomFactor = newZoom / 100;

            const newPanX =
                screenX - centerX - (worldX - centerX) * newZoomFactor;
            const newPanY =
                screenY - centerY - (worldY - centerY) * newZoomFactor;

            zoom.value = newZoom;
            pan.value = { x: newPanX, y: newPanY };
            return;
        }

        e.preventDefault();

        if (e.shiftKey) {
            pan.value.x -= e.deltaY;
        } else {
            pan.value.y -= e.deltaY;
        }
    }

    /**
     * Находит фигуру под курсором (слои проверяются с последней на первую).
     */
    function hitTest(point: Point): Shape | null {
        for (let i = shapes.value.length - 1; i >= 0; i--) {
            const shape = shapes.value[i];
            if (shape?.hitTest(point)) return shape;
        }
        return null;
    }

    /**
     * Определяет, находится ли курсор над управляющей ручкой выделенной фигуры.
     * Учитывает масштаб фигуры и паддинг выделения.
     */
    function detectResizeHandle(
        shape: Shape,
        globalPoint: Point
    ): ResizeHandle | null {
        const localPoint = shape.toLocalPoint(globalPoint);
        const edgeX = 4 / Math.abs(shape.scaleX);
        const edgeY = 4 / Math.abs(shape.scaleY);

        if (shape.type === 'line') {
            const line = shape as LineShape;
            if (line.localEndPoint) {
                const vInv = line.getInverseVMatrix();
                const vPt = new DOMPoint(
                    globalPoint.x,
                    globalPoint.y
                ).matrixTransform(vInv);

                const ex = line.localEndPoint.x * line.scaleX;
                const ey = line.localEndPoint.y * line.scaleY;

                if (Math.hypot(vPt.x, vPt.y) <= 8) return 's';
                if (Math.hypot(vPt.x - ex, vPt.y - ey) <= 8) return 'e';
            }
            return null;
        }
        const box = shape.getLocalBox();

        const padX = SELECTION_PADDING / Math.max(Math.abs(shape.scaleX), 0.01);
        const padY = SELECTION_PADDING / Math.max(Math.abs(shape.scaleY), 0.01);

        const paddedBox = {
            minX: box.minX - padX,
            maxX: box.maxX + padX,
            minY: box.minY - padY,
            maxY: box.maxY + padY,
        };

        const isFlippedY = shape.scaleY < 0;
        const localAnchorY = isFlippedY ? paddedBox.maxY : paddedBox.minY;
        const rotOffset = (20 - SELECTION_PADDING) / shape.scaleY;
        const rotY = localAnchorY - rotOffset;

        const diffX = (localPoint.x - 0) * shape.scaleX;
        const diffY = (localPoint.y - rotY) * shape.scaleY;
        if (Math.hypot(diffX, diffY) <= 8) return 'rot';

        const nearLeft = Math.abs(localPoint.x - paddedBox.minX) <= edgeX;
        const nearRight = Math.abs(localPoint.x - paddedBox.maxX) <= edgeX;
        const nearTop = Math.abs(localPoint.y - paddedBox.minY) <= edgeY;
        const nearBottom = Math.abs(localPoint.y - paddedBox.maxY) <= edgeY;
        const inY =
            localPoint.y >= paddedBox.minY - edgeY &&
            localPoint.y <= paddedBox.maxY + edgeY;
        const inX =
            localPoint.x >= paddedBox.minX - edgeX &&
            localPoint.x <= paddedBox.maxX + edgeX;

        if (nearLeft && nearTop) return 'lt';
        if (nearRight && nearTop) return 'rt';
        if (nearLeft && nearBottom) return 'lb';
        if (nearRight && nearBottom) return 'rb';
        if (nearLeft && inY) return 'l';
        if (nearRight && inY) return 'r';
        if (nearTop && inX) return 't';
        if (nearBottom && inX) return 'b';

        return null;
    }

    /**
     * Вычисляет подходящий CSS-курсор с учетом поворота и отражения фигуры.
     */
    function getCursorStyle(handle: string, shape: Shape): string {
        if (handle === 's' || handle === 'e') return 'crosshair';
        if (handle === 'rot') return 'grabbing';

        const handleAngles: Partial<Record<ResizeHandle, number>> = {
            t: 0,
            rt: 45,
            r: 90,
            rb: 135,
            b: 180,
            lb: 225,
            l: 270,
            lt: 315,
        };

        let baseAngle = handleAngles[handle as ResizeHandle];
        if (baseAngle === undefined) return 'default';

        if (shape.scaleX < 0) baseAngle = (360 - baseAngle) % 360;
        if (shape.scaleY < 0) baseAngle = (180 - baseAngle + 360) % 360;

        const totalAngle = (baseAngle + shape.rotation) % 360;
        const index = Math.round(totalAngle / 45) % 8;

        const cursors = [
            'ns-resize',
            'nesw-resize',
            'ew-resize',
            'nwse-resize',
            'ns-resize',
            'nesw-resize',
            'ew-resize',
            'nwse-resize',
        ];

        return cursors[index] ?? 'default';
    }

    function onMouseDown(e: MouseEvent) {
        const canvas = canvasRef.value;

        if (
            e.button === 1 ||
            (toolsStore.activeTool === 'hand' && e.button === 0)
        ) {
            e.preventDefault();
            isPanning.value = true;
            panStart.value = { x: e.clientX, y: e.clientY };
            if (canvas) {
                canvas.style.cursor = 'grabbing';
            }
            return;
        }

        const point = getLocalPoint(e);
        const topShape = hitTest(point);

        if (toolsStore.activeTool === 'eraser') {
            if (topShape) {
                canvasStore.deleteShape(topShape.id);
                if (activeShape.value?.id === topShape.id) {
                    activeShape.value = null;
                }
            }
            return;
        }

        if (toolsStore.activeTool !== 'select') {
            canvasStore.selectShape(null);
            activeShape.value = null;
            isCreating.value = true;
            createStart.value = point;
            createToolType.value = toolsStore.activeTool;
            if ('creationParams' in toolsStore) {
                const store = toolsStore as {
                    creationParams?: Record<string, unknown> | null;
                };
                createParams.value = store.creationParams ?? null;
            } else {
                createParams.value = null;
            }
            return;
        }

        if (activeShape.value) {
            const handle = detectResizeHandle(activeShape.value, point);

            if (handle) {
                isResizing.value = true;
                resizeHandle.value = handle;

                resizeStartLocalBox.value = activeShape.value.getLocalBox();
                resizeStartMatrix.value = activeShape.value.getMatrix();
                resizeStartInverse.value = activeShape.value.getInverseMatrix();

                if (activeShape.value.type === 'line') {
                    const line = activeShape.value as LineShape;
                    if (line.localEndPoint)
                        lineStartLocal.value = { ...line.localEndPoint };
                }
                return;
            }
        }

        canvasStore.selectShape(topShape?.id ?? null);
        activeShape.value = topShape;

        if (topShape) {
            isDragging.value = true;
            dragStart.value = point;
        }
    }

    function onMouseMove(e: MouseEvent) {
        const point = getLocalPoint(e);
        const canvas = canvasRef.value;
        if (!canvas) return;

        if (isPanning.value) {
            const dx = e.clientX - panStart.value.x;
            const dy = e.clientY - panStart.value.y;
            if (dx !== 0 || dy !== 0) {
                canvasStore.movePan({ x: dx, y: dy });
                panStart.value = { x: e.clientX, y: e.clientY };
            }
            canvas.style.cursor = 'grabbing';
            return;
        }

        if (isCreating.value && createStart.value) {
            const start = createStart.value;

            let current = { ...point };
            let dx = current.x - start.x;
            let dy = current.y - start.y;
            const distanceSq = dx * dx + dy * dy;

            const MIN_DRAG_DISTANCE_SQ = 4;
            if (distanceSq < MIN_DRAG_DISTANCE_SQ) {
                return;
            }

            if (!activeShape.value) {
                if (!createToolType.value) return;

                if (!hasRecordedInteraction.value) {
                    canvasStore.startInteraction();
                    hasRecordedInteraction.value = true;
                }

                const newShape = canvasStore.addShape(
                    createToolType.value,
                    { x: start.x, y: start.y },
                    createParams.value ?? undefined,
                    false
                );

                canvasStore.selectShape(newShape.id);
                activeShape.value = newShape;
            }

            if (!activeShape.value) return;

            if (e.shiftKey) {
                if (activeShape.value.type === 'line') {
                    const length = Math.sqrt(distanceSq);
                    if (length > 0) {
                        const angle = Math.atan2(dy, dx);
                        const snap =
                            Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
                        dx = length * Math.cos(snap);
                        dy = length * Math.sin(snap);
                        current = { x: start.x + dx, y: start.y + dy };
                    }
                } else {
                    const size = Math.max(Math.abs(dx), Math.abs(dy));
                    const signX = dx >= 0 ? 1 : -1;
                    const signY = dy >= 0 ? 1 : -1;
                    dx = signX * size;
                    dy = signY * size;
                    current = { x: start.x + dx, y: start.y + dy };
                }
            }

            if (activeShape.value.type === 'line') {
                const line = activeShape.value as LineShape;
                line.position = { x: start.x, y: start.y };
                line.localEndPoint = {
                    x: current.x - start.x,
                    y: current.y - start.y,
                };
            } else {
                const width = Math.max(1, Math.abs(current.x - start.x));
                const height = Math.max(1, Math.abs(current.y - start.y));
                const centerX = (start.x + current.x) / 2;
                const centerY = (start.y + current.y) / 2;

                activeShape.value.position = { x: centerX, y: centerY };
                activeShape.value.setSize(width, height);
            }

            canvas.style.cursor = 'crosshair';
            return;
        }

        if (isResizing.value && activeShape.value && resizeHandle.value) {
            const handle = resizeHandle.value;
            const shift = e.shiftKey;

            // 1. Поворот
            if (handle === 'rot') {
                if (!hasRecordedInteraction.value) {
                    canvasStore.startInteraction();
                    hasRecordedInteraction.value = true;
                }
                const center = activeShape.value.position;
                const angle = Math.atan2(
                    point.y - center.y,
                    point.x - center.x
                );

                const deg = (angle + Math.PI / 2) * (180 / Math.PI);

                activeShape.value.rotation = (deg + 360) % 360;

                canvas.style.cursor = getCursorStyle(handle, activeShape.value);
                return;
            }

            if (
                !resizeStartInverse.value ||
                !resizeStartMatrix.value ||
                !resizeStartLocalBox.value
            )
                return;

            const mInv = resizeStartInverse.value;
            const mStart = resizeStartMatrix.value;
            const startBox = resizeStartLocalBox.value;

            const localMouse = new DOMPoint(point.x, point.y).matrixTransform(
                mInv
            );

            // 2. Специфичный ресайз линии (за точки)
            if (
                activeShape.value.type === 'line' &&
                (handle === 's' || handle === 'e')
            ) {
                if (!hasRecordedInteraction.value) {
                    canvasStore.startInteraction();
                    hasRecordedInteraction.value = true;
                }
                const line = activeShape.value as LineShape;

                if (lineStartLocal.value) {
                    if (handle === 's') {
                        line.position = { x: point.x, y: point.y };

                        const oldGlobalEnd = new DOMPoint(
                            lineStartLocal.value.x,
                            lineStartLocal.value.y
                        ).matrixTransform(mStart);
                        const newInv = activeShape.value.getInverseMatrix();
                        const newLocalEnd =
                            oldGlobalEnd.matrixTransform(newInv);
                        line.localEndPoint = {
                            x: newLocalEnd.x,
                            y: newLocalEnd.y,
                        };
                    } else if (handle === 'e') {
                        line.localEndPoint = {
                            x: localMouse.x,
                            y: localMouse.y,
                        };
                    }
                }
                canvas.style.cursor = 'crosshair';
                return;
            }

            // 3. Общий ресайз рамкой (для всего остального)
            if (!hasRecordedInteraction.value) {
                canvasStore.startInteraction();
                hasRecordedInteraction.value = true;
            }
            let nMinX = startBox.minX,
                nMaxX = startBox.maxX;
            let nMinY = startBox.minY,
                nMaxY = startBox.maxY;

            let moveX = localMouse.x;
            let moveY = localMouse.y;

            if (shift && ['lt', 'rt', 'lb', 'rb'].includes(handle)) {
                const origW = startBox.maxX - startBox.minX;
                const origH = startBox.maxY - startBox.minY;

                const fixedX = handle.includes('l')
                    ? startBox.maxX
                    : startBox.minX;
                const fixedY = handle.includes('t')
                    ? startBox.maxY
                    : startBox.minY;

                const deltaX = localMouse.x - fixedX;
                const deltaY = localMouse.y - fixedY;
                const kx = origW === 0 ? 1 : Math.abs(deltaX) / origW;
                const ky = origH === 0 ? 1 : Math.abs(deltaY) / origH;
                const ratio = Math.max(kx, ky, 0.01);

                moveX = fixedX + Math.sign(deltaX || 1) * origW * ratio;
                moveY = fixedY + Math.sign(deltaY || 1) * origH * ratio;

                nMinX = Math.min(fixedX, moveX);
                nMaxX = Math.max(fixedX, moveX);
                nMinY = Math.min(fixedY, moveY);
                nMaxY = Math.max(fixedY, moveY);
            } else {
                if (handle.includes('l')) {
                    moveX = localMouse.x;
                    nMinX = Math.min(startBox.maxX, moveX);
                    nMaxX = Math.max(startBox.maxX, moveX);
                }
                if (handle.includes('r')) {
                    moveX = localMouse.x;
                    nMinX = Math.min(startBox.minX, moveX);
                    nMaxX = Math.max(startBox.minX, moveX);
                }
                if (handle.includes('t')) {
                    moveY = localMouse.y;
                    nMinY = Math.min(startBox.maxY, moveY);
                    nMaxY = Math.max(startBox.maxY, moveY);
                }
                if (handle.includes('b')) {
                    moveY = localMouse.y;
                    nMinY = Math.min(startBox.minY, moveY);
                    nMaxY = Math.max(startBox.minY, moveY);
                }
            }

            const newWidth = Math.abs(nMaxX - nMinX);
            const newHeight = Math.abs(nMaxY - nMinY);

            activeShape.value.setSize(
                Math.max(1, newWidth),
                Math.max(1, newHeight)
            );

            const localCenterX = (nMinX + nMaxX) / 2;
            const localCenterY = (nMinY + nMaxY) / 2;
            const newGlobalCenter = new DOMPoint(
                localCenterX,
                localCenterY
            ).matrixTransform(mStart);

            activeShape.value.position.x = newGlobalCenter.x;
            activeShape.value.position.y = newGlobalCenter.y;

            const startScaleX = resizeStartScale.value.x;
            const startScaleY = resizeStartScale.value.y;

            if (handle.includes('l') || handle.includes('r')) {
                const fixedX = handle.includes('l')
                    ? startBox.maxX
                    : startBox.minX;
                const expectedDir = handle.includes('l') ? -1 : 1;
                const actualDir = Math.sign(moveX - fixedX) || expectedDir;
                const sign = actualDir === expectedDir ? 1 : -1;
                activeShape.value.scaleX = startScaleX * sign;
            }

            if (handle.includes('t') || handle.includes('b')) {
                const fixedY = handle.includes('t')
                    ? startBox.maxY
                    : startBox.minY;
                const expectedDir = handle.includes('t') ? -1 : 1;
                const actualDir = Math.sign(moveY - fixedY) || expectedDir;
                const sign = actualDir === expectedDir ? 1 : -1;
                activeShape.value.scaleY = startScaleY * sign;
            }

            canvas.style.cursor = getCursorStyle(handle, activeShape.value);
            return;
        }

        if (isDragging.value && activeShape.value) {
            const dx = point.x - dragStart.value.x;
            const dy = point.y - dragStart.value.y;
            if (!hasRecordedInteraction.value && (dx !== 0 || dy !== 0)) {
                canvasStore.startInteraction();
                hasRecordedInteraction.value = true;
            }
            activeShape.value.move({ x: dx, y: dy });
            dragStart.value = point;
            canvas.style.cursor = 'grabbing';
            return;
        }

        if (activeShape.value) {
            const handle = detectResizeHandle(activeShape.value, point);
            if (handle) {
                canvas.style.cursor = getCursorStyle(handle, activeShape.value);
                return;
            }
        }

        const topShape = hitTest(point);
        if (toolsStore.activeTool === 'hand') {
            canvas.style.cursor = 'grab';
            return;
        }
        canvas.style.cursor = topShape ? 'grab' : 'default';
    }

    function onMouseUp(e: MouseEvent) {
        if (isPanning.value) {
            isPanning.value = false;
            const canvas = canvasRef.value;
            if (canvas) {
                canvas.style.cursor =
                    toolsStore.activeTool === 'hand' ? 'grab' : 'default';
            }
            return;
        }

        if (isCreating.value) {
            if (activeShape.value) {
                if (hasRecordedInteraction.value) {
                    canvasStore.endInteraction();
                    hasRecordedInteraction.value = false;
                }
                toolsStore.setActiveTool('select');
                if ('setCreationParams' in toolsStore) {
                    const store = toolsStore as {
                        setCreationParams?: (
                            params: Record<string, unknown> | null
                        ) => void;
                    };
                    store.setCreationParams?.(null);
                }
            }

            isCreating.value = false;
            createStart.value = null;
            createToolType.value = null;
            createParams.value = null;
            const canvas = canvasRef.value;
            if (canvas) {
                canvas.style.cursor = 'default';
            }
            return;
        }

        if (hasRecordedInteraction.value) {
            canvasStore.endInteraction();
        }
        hasRecordedInteraction.value = false;
        isDragging.value = false;
        isResizing.value = false;
        resizeHandle.value = null;
        resizeStartLocalBox.value = null;
        resizeStartMatrix.value = null;
        resizeStartInverse.value = null;
        lineStartLocal.value = null;

        onMouseMove(e);
    }

    function onAuxClick(event: MouseEvent) {
        if (event.button === 1) {
            event.preventDefault();
        }
    }

    function attachListeners() {
        const el = canvasRef.value;
        if (!el) return;
        el.addEventListener('mousedown', onMouseDown);
        el.addEventListener('auxclick', onAuxClick);
        el.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            el.removeEventListener('mousedown', onMouseDown);
            el.removeEventListener('wheel', onWheel);
            el.removeEventListener('auxclick', onAuxClick);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }

    return { attachListeners };
}
