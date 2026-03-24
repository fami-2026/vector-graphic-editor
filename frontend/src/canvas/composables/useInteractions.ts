import { ref, watch, type Ref } from 'vue';
import type {
    Shape,
    Point,
    BoundingBox,
    LineShape,
    PencilShape,
} from '@/canvas/types';
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

interface ShapeResizeState {
    shape: Shape;
    startLocalBox: BoundingBox;
    startMatrix: DOMMatrix;
    startInverse: DOMMatrix;
    startScale: Point;
    startRotation: number;
    startPosition: Point;
    startLocalEndPoint?: Point;
}

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
    const isDraggingMultiple = ref(false);
    const isResizingMultiple = ref(false);

    const dragStart = ref<Point>({ x: 0, y: 0 });
    const dragStartPosition = ref<Point>({ x: 0, y: 0 });
    const panStart = ref<Point>({ x: 0, y: 0 });
    const activeShape = ref<Shape | null>(null);
    const resizeHandle = ref<ResizeHandle | null>(null);

    const resizeStartLocalBox = ref<BoundingBox | null>(null);
    const resizeStartMatrix = ref<DOMMatrix | null>(null);
    const resizeStartInverse = ref<DOMMatrix | null>(null);
    const resizeStartScale = ref<Point>({ x: 1, y: 1 });
    const resizeStartRotation = ref<number>(0);
    const lineStartLocal = ref<Point | null>(null);
    const hasRecordedInteraction = ref(false);
    const hasMoved = ref(false);
    const createStart = ref<Point | null>(null);
    const createToolType = ref<ToolType | null>(null);
    const createParams = ref<Record<string, unknown> | null>(null);

    const multiResizeStates = ref<Map<string, ShapeResizeState>>(new Map());
    const selectionStartBox = ref<BoundingBox | null>(null);
    const dragStartPositions = ref<Map<string, Point>>(new Map());

    const DRAG_THRESHOLD = 3;

    watch(
        () => toolsStore.activeTool,
        (newTool) => {
            if (newTool !== 'select') {
                canvasStore.clearSelection();
                activeShape.value = null;
            }
        }
    );

    watch(
        [() => canvasStore.selectedId, shapes],
        () => {
            if (isCreating.value) return;
            const selected =
                shapes.value.find(
                    (shape) => shape.id === canvasStore.selectedId
                ) ?? null;
            activeShape.value = selected;

            if (!selected && canvasStore.selectedIds.length === 0) {
                isDragging.value = false;
                isResizing.value = false;
                isDraggingMultiple.value = false;
                isResizingMultiple.value = false;
                resizeHandle.value = null;
                resizeStartLocalBox.value = null;
                resizeStartMatrix.value = null;
                resizeStartInverse.value = null;
                lineStartLocal.value = null;
                multiResizeStates.value.clear();
                selectionStartBox.value = null;
                dragStartPositions.value.clear();
                createStart.value = null;
                createToolType.value = null;
                createParams.value = null;
                hasMoved.value = false;
            }
        },
        { immediate: true }
    );

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

    function hitTest(point: Point): Shape | null {
        for (let i = shapes.value.length - 1; i >= 0; i--) {
            const shape = shapes.value[i];
            if (shape?.hitTest(point)) return shape;
        }
        return null;
    }

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

        const vLocalPoint = shape.toVLocalPoint(globalPoint);
        const rawY = Math.min(box.minY * shape.scaleY, box.maxY * shape.scaleY);
        const rectY = rawY - SELECTION_PADDING;
        const visualRotY = rectY - 20 + SELECTION_PADDING;

        const diffX = vLocalPoint.x;
        const diffY = vLocalPoint.y - visualRotY;
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

    function getGlobalCursorStyle(handle: string): string {
        const map: Record<string, string> = {
            t: 'ns-resize',
            b: 'ns-resize',
            l: 'ew-resize',
            r: 'ew-resize',
            lt: 'nwse-resize',
            rb: 'nwse-resize',
            rt: 'nesw-resize',
            lb: 'nesw-resize',
        };
        return map[handle] ?? 'default';
    }

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

    function getVisualSelectionBox(): BoundingBox | null {
        if (!canvasStore.selectionRect || canvasStore.selectedIds.length === 0)
            return null;

        return {
            minX: Math.min(
                canvasStore.selectionRect.start.x,
                canvasStore.selectionRect.end.x
            ),
            minY: Math.min(
                canvasStore.selectionRect.start.y,
                canvasStore.selectionRect.end.y
            ),
            maxX: Math.max(
                canvasStore.selectionRect.start.x,
                canvasStore.selectionRect.end.x
            ),
            maxY: Math.max(
                canvasStore.selectionRect.start.y,
                canvasStore.selectionRect.end.y
            ),
        };
    }

    function hitTestSelectionBox(point: Point): {
        handle: ResizeHandle | null;
        isInside: boolean;
    } {
        const selectionBox = getVisualSelectionBox();
        if (!selectionBox) return { handle: null, isInside: false };

        const padding = SELECTION_PADDING;
        const edgeThreshold = 8;

        const expandedBox = {
            minX: selectionBox.minX - padding,
            maxX: selectionBox.maxX + padding,
            minY: selectionBox.minY - padding,
            maxY: selectionBox.maxY + padding,
        };

        const isInside =
            point.x >= expandedBox.minX &&
            point.x <= expandedBox.maxX &&
            point.y >= expandedBox.minY &&
            point.y <= expandedBox.maxY;

        const nearLeft = Math.abs(point.x - selectionBox.minX) <= edgeThreshold;
        const nearRight =
            Math.abs(point.x - selectionBox.maxX) <= edgeThreshold;
        const nearTop = Math.abs(point.y - selectionBox.minY) <= edgeThreshold;
        const nearBottom =
            Math.abs(point.y - selectionBox.maxY) <= edgeThreshold;

        const inY = point.y >= expandedBox.minY && point.y <= expandedBox.maxY;
        const inX = point.x >= expandedBox.minX && point.x <= expandedBox.maxX;

        if (nearLeft && nearTop && isInside)
            return { handle: 'lt', isInside: false };
        if (nearRight && nearTop && isInside)
            return { handle: 'rt', isInside: false };
        if (nearLeft && nearBottom && isInside)
            return { handle: 'lb', isInside: false };
        if (nearRight && nearBottom && isInside)
            return { handle: 'rb', isInside: false };

        if (nearLeft && inY && isInside)
            return { handle: 'l', isInside: false };
        if (nearRight && inY && isInside)
            return { handle: 'r', isInside: false };
        if (nearTop && inX && isInside) return { handle: 't', isInside: false };
        if (nearBottom && inX && isInside)
            return { handle: 'b', isInside: false };

        return { handle: null, isInside };
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
                if (canvasStore.selectedIds.includes(topShape.id)) {
                    canvasStore.deleteSelectedShapes();
                } else {
                    canvasStore.deleteShape(topShape.id);
                }
            }
            return;
        }

        if (toolsStore.activeTool === 'pencil') {
            canvasStore.clearSelection();
            activeShape.value = null;

            isCreating.value = true;
            createStart.value = point;
            createToolType.value = 'pencil';

            if ('creationParams' in toolsStore) {
                const store = toolsStore as {
                    creationParams?: Record<string, unknown> | null;
                };
                createParams.value = store.creationParams ?? null;
            } else {
                createParams.value = null;
            }

            if (!hasRecordedInteraction.value) {
                canvasStore.startInteraction();
                hasRecordedInteraction.value = true;
            }

            const newShape = canvasStore.addShape(
                'pencil',
                { x: point.x, y: point.y },
                createParams.value ?? undefined,
                false
            ) as PencilShape;

            newShape.stroke = toolsStore.pencilDefaults.stroke;
            newShape.strokeOpacity = toolsStore.pencilDefaults.strokeOpacity;
            newShape.strokeWidth = toolsStore.pencilDefaults.strokeWidth;

            activeShape.value = newShape;

            if (canvas) {
                canvas.style.cursor = 'crosshair';
            }
            return;
        }

        const creatingTools: ToolType[] = [
            'rect',
            'circle',
            'line',
            'triangle',
            'polygon',
            'star',
            'hexagon',
            'arrow',
        ];

        if (creatingTools.includes(toolsStore.activeTool)) {
            canvasStore.clearSelection();
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

        if (toolsStore.activeTool === 'select') {
            if (canvasStore.selectedIds.length === 1 && activeShape.value) {
                const handle = detectResizeHandle(activeShape.value, point);
                if (handle) {
                    e.preventDefault();
                    isResizing.value = true;
                    resizeHandle.value = handle;
                    hasMoved.value = false;

                    resizeStartLocalBox.value = activeShape.value.getLocalBox();
                    resizeStartMatrix.value = activeShape.value.getMatrix();
                    resizeStartInverse.value =
                        activeShape.value.getInverseMatrix();
                    resizeStartScale.value = {
                        x: activeShape.value.scaleX,
                        y: activeShape.value.scaleY,
                    };

                    if (activeShape.value.type === 'line') {
                        const line = activeShape.value as LineShape;
                        if (line.localEndPoint)
                            lineStartLocal.value = { ...line.localEndPoint };
                    }

                    if (canvas) {
                        canvas.style.cursor = getCursorStyle(
                            handle,
                            activeShape.value
                        );
                    }
                    return;
                }
            }

            if (canvasStore.selectedIds.length > 1) {
                const { handle, isInside } = hitTestSelectionBox(point);

                if (handle) {
                    e.preventDefault();
                    isResizingMultiple.value = true;
                    resizeHandle.value = handle;
                    hasMoved.value = false;

                    multiResizeStates.value.clear();
                    canvasStore.selectedShapes.forEach((shape) => {
                        multiResizeStates.value.set(shape.id, {
                            shape,
                            startLocalBox: shape.getLocalBox(),
                            startMatrix: shape.getMatrix(),
                            startInverse: shape.getInverseMatrix(),
                            startScale: { x: shape.scaleX, y: shape.scaleY },
                            startRotation: shape.rotation,
                            startPosition: {
                                x: shape.position.x,
                                y: shape.position.y,
                            },
                            startLocalEndPoint:
                                shape.type === 'line'
                                    ? { ...(shape as LineShape).localEndPoint }
                                    : undefined,
                        });
                    });

                    selectionStartBox.value = getVisualSelectionBox();
                    dragStart.value = point;

                    if (canvas) {
                        canvas.style.cursor = getGlobalCursorStyle(handle);
                    }
                    return;
                }

                if (isInside) {
                    e.preventDefault();
                    isDraggingMultiple.value = true;
                    dragStart.value = point;
                    hasMoved.value = false;

                    dragStartPositions.value.clear();
                    canvasStore.selectedShapes.forEach((shape) => {
                        dragStartPositions.value.set(shape.id, {
                            x: shape.position.x,
                            y: shape.position.y,
                        });
                    });

                    selectionStartBox.value = getVisualSelectionBox();

                    if (canvas) {
                        canvas.style.cursor = 'grabbing';
                    }
                    return;
                }
            }

            if (topShape) {
                const isSelected = canvasStore.selectedIds.includes(
                    topShape.id
                );

                if (!isSelected) {
                    if (e.shiftKey) {
                        canvasStore.selectShapeWithAdd(topShape.id, true);
                    } else {
                        canvasStore.selectShapeWithAdd(topShape.id, false);
                    }
                }

                if (
                    canvasStore.selectedIds.length === 1 &&
                    canvasStore.selectedIds.includes(topShape.id)
                ) {
                    e.preventDefault();
                    isDragging.value = true;
                    dragStart.value = point;
                    dragStartPosition.value = {
                        x: topShape.position.x,
                        y: topShape.position.y,
                    };
                    activeShape.value = topShape;
                    hasMoved.value = false;

                    if (canvas) {
                        canvas.style.cursor = 'grabbing';
                    }
                }
            } else {
                if (!e.shiftKey) {
                    canvasStore.clearSelection();
                }
                canvasStore.startSelection(point);
            }
            return;
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

        if (isDraggingMultiple.value) {
            if (!dragStartPositions.value.size || !selectionStartBox.value) {
                return;
            }

            const dx = point.x - dragStart.value.x;
            const dy = point.y - dragStart.value.y;

            if (!hasMoved.value) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < DRAG_THRESHOLD) {
                    return;
                }
                hasMoved.value = true;
            }

            if (!hasRecordedInteraction.value && hasMoved.value) {
                canvasStore.startInteraction();
                hasRecordedInteraction.value = true;
            }

            dragStartPositions.value.forEach((startPos, id) => {
                const shape = shapes.value.find((s) => s.id === id);
                if (shape) {
                    shape.position.x = startPos.x + dx;
                    shape.position.y = startPos.y + dy;
                }
            });

            if (canvasStore.selectionRect && selectionStartBox.value) {
                canvasStore.selectionRect.start.x =
                    selectionStartBox.value.minX + dx;
                canvasStore.selectionRect.start.y =
                    selectionStartBox.value.minY + dy;
                canvasStore.selectionRect.end.x =
                    selectionStartBox.value.maxX + dx;
                canvasStore.selectionRect.end.y =
                    selectionStartBox.value.maxY + dy;
            }

            canvas.style.cursor = 'grabbing';
            return;
        }

        if (
            isResizingMultiple.value &&
            resizeHandle.value &&
            selectionStartBox.value
        ) {
            const dx = point.x - dragStart.value.x;
            const dy = point.y - dragStart.value.y;

            if (!hasMoved.value) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < DRAG_THRESHOLD) {
                    return;
                }
                hasMoved.value = true;
            }

            if (!hasRecordedInteraction.value && hasMoved.value) {
                canvasStore.startInteraction();
                hasRecordedInteraction.value = true;
            }

            const handle = resizeHandle.value;
            const shift = e.shiftKey;
            const startBox = selectionStartBox.value;

            const origW = Math.max(0.1, startBox.maxX - startBox.minX);
            const origH = Math.max(0.1, startBox.maxY - startBox.minY);

            let hasRotated = false;
            multiResizeStates.value.forEach((state) => {
                if (Math.abs(state.shape.rotation % 180) > 0) {
                    hasRotated = true;
                }
            });

            const forceProportional = shift || hasRotated;

            let newMinX = startBox.minX,
                newMaxX = startBox.maxX;
            let newMinY = startBox.minY,
                newMaxY = startBox.maxY;

            if (forceProportional) {
                const ratioX = handle.includes('l')
                    ? (startBox.maxX - point.x) / origW
                    : handle.includes('r')
                      ? (point.x - startBox.minX) / origW
                      : 1;

                const ratioY = handle.includes('t')
                    ? (startBox.maxY - point.y) / origH
                    : handle.includes('b')
                      ? (point.y - startBox.minY) / origH
                      : 1;

                let ratio = 1;
                if (['l', 'r'].includes(handle)) {
                    ratio = Math.abs(ratioX);
                } else if (['t', 'b'].includes(handle)) {
                    ratio = Math.abs(ratioY);
                } else {
                    ratio = Math.max(Math.abs(ratioX), Math.abs(ratioY));
                }

                ratio = Math.max(0.01, ratio);

                const dirX = Math.sign(ratioX) || 1;
                const dirY = Math.sign(ratioY) || 1;

                if (handle.includes('l')) {
                    newMinX = startBox.maxX - origW * ratio * dirX;
                } else if (handle.includes('r')) {
                    newMaxX = startBox.minX + origW * ratio * dirX;
                } else {
                    const halfW = (origW * ratio) / 2;
                    const cx = (startBox.minX + startBox.maxX) / 2;
                    newMinX = cx - halfW;
                    newMaxX = cx + halfW;
                }

                if (handle.includes('t')) {
                    newMinY = startBox.maxY - origH * ratio * dirY;
                } else if (handle.includes('b')) {
                    newMaxY = startBox.minY + origH * ratio * dirY;
                } else {
                    const halfH = (origH * ratio) / 2;
                    const cy = (startBox.minY + startBox.maxY) / 2;
                    newMinY = cy - halfH;
                    newMaxY = cy + halfH;
                }
            } else {
                const deltaX = point.x - dragStart.value.x;
                const deltaY = point.y - dragStart.value.y;

                if (handle.includes('l')) newMinX = startBox.minX + deltaX;
                if (handle.includes('r')) newMaxX = startBox.maxX + deltaX;
                if (handle.includes('t')) newMinY = startBox.minY + deltaY;
                if (handle.includes('b')) newMaxY = startBox.maxY + deltaY;
            }

            let signX = 1;
            let signY = 1;

            if (newMinX > newMaxX) {
                signX = -1;
                [newMinX, newMaxX] = [newMaxX, newMinX];
            }
            if (newMinY > newMaxY) {
                signY = -1;
                [newMinY, newMaxY] = [newMaxY, newMinY];
            }

            const newWidth = Math.max(1, newMaxX - newMinX);
            const newHeight = Math.max(1, newMaxY - newMinY);

            const absScaleX = newWidth / origW;
            const absScaleY = newHeight / origH;

            multiResizeStates.value.forEach((state) => {
                const shape = state.shape;

                const oldCenterX = (startBox.minX + startBox.maxX) / 2;
                const oldCenterY = (startBox.minY + startBox.maxY) / 2;

                const newCenterX = (newMinX + newMaxX) / 2;
                const newCenterY = (newMinY + newMaxY) / 2;

                const relX = (state.startPosition.x - oldCenterX) / (origW / 2);
                const relY = (state.startPosition.y - oldCenterY) / (origH / 2);

                shape.position.x = newCenterX + relX * signX * (newWidth / 2);
                shape.position.y = newCenterY + relY * signY * (newHeight / 2);

                shape.scaleX = state.startScale.x * signX;
                shape.scaleY = state.startScale.y * signY;

                if (shape.type !== 'line') {
                    let newRot = state.startRotation;

                    if (signX === -1) {
                        newRot = (360 - newRot) % 360;
                    }
                    if (signY === -1) {
                        newRot = (360 - newRot) % 360;
                    }
                    shape.rotation = newRot;

                    const localBox = state.startLocalBox;
                    const newLocalWidth =
                        (localBox.maxX - localBox.minX) * absScaleX;
                    const newLocalHeight =
                        (localBox.maxY - localBox.minY) * absScaleY;
                    shape.setSize(
                        Math.max(1, newLocalWidth),
                        Math.max(1, newLocalHeight)
                    );
                } else {
                    const line = shape as LineShape;
                    if (line.localEndPoint && state.startLocalEndPoint) {
                        line.localEndPoint.x =
                            state.startLocalEndPoint.x * absScaleX;
                        line.localEndPoint.y =
                            state.startLocalEndPoint.y * absScaleY;
                    }
                }
            });

            if (canvasStore.selectionRect) {
                canvasStore.selectionRect.start = { x: newMinX, y: newMinY };
                canvasStore.selectionRect.end = { x: newMaxX, y: newMaxY };
            }

            canvas.style.cursor = getGlobalCursorStyle(handle);
            return;
        }

        if (canvasStore.isSelecting) {
            canvasStore.updateSelection(point);
            return;
        }

        if (isCreating.value && createStart.value) {
            if (createToolType.value === 'pencil') {
                if (!activeShape.value || activeShape.value.type !== 'pencil') {
                    return;
                }

                const pencil = activeShape.value as PencilShape;
                const localPoint = pencil.toVLocalPoint(point);
                const lastPoint = pencil.points[pencil.points.length - 1];

                if (
                    !lastPoint ||
                    Math.hypot(
                        localPoint.x - lastPoint.x,
                        localPoint.y - lastPoint.y
                    ) >= 1
                ) {
                    pencil.addPoint(point);
                }

                canvas.style.cursor = 'crosshair';
                return;
            }

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

            const dx = point.x - dragStart.value.x;
            const dy = point.y - dragStart.value.y;

            if (!hasMoved.value) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < DRAG_THRESHOLD) {
                    return;
                }
                hasMoved.value = true;
            }

            if (!hasRecordedInteraction.value && hasMoved.value) {
                canvasStore.startInteraction();
                hasRecordedInteraction.value = true;
            }

            if (handle === 'rot') {
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
            ) {
                return;
            }

            const mInv = resizeStartInverse.value;
            const mStart = resizeStartMatrix.value;
            const startBox = resizeStartLocalBox.value;

            const localMouse = new DOMPoint(point.x, point.y).matrixTransform(
                mInv
            );

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
                const signX = actualDir === expectedDir ? 1 : -1;
                activeShape.value.scaleX = startScaleX * signX;
            }

            if (handle.includes('t') || handle.includes('b')) {
                const fixedY = handle.includes('t')
                    ? startBox.maxY
                    : startBox.minY;
                const expectedDir = handle.includes('t') ? -1 : 1;
                const actualDir = Math.sign(moveY - fixedY) || expectedDir;
                const signY = actualDir === expectedDir ? 1 : -1;
                activeShape.value.scaleY = startScaleY * signY;
            }

            canvas.style.cursor = getCursorStyle(handle, activeShape.value);
            return;
        }

        if (isDragging.value && activeShape.value) {
            const dx = point.x - dragStart.value.x;
            const dy = point.y - dragStart.value.y;

            if (!hasMoved.value) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < DRAG_THRESHOLD) {
                    return;
                }
                hasMoved.value = true;
            }

            if (!hasRecordedInteraction.value && hasMoved.value) {
                canvasStore.startInteraction();
                hasRecordedInteraction.value = true;
            }

            activeShape.value.position.x = dragStartPosition.value.x + dx;
            activeShape.value.position.y = dragStartPosition.value.y + dy;

            canvas.style.cursor = 'grabbing';
            return;
        }

        if (canvasStore.selectedIds.length > 0 && canvasStore.selectionRect) {
            const selectionBox = {
                minX: Math.min(
                    canvasStore.selectionRect.start.x,
                    canvasStore.selectionRect.end.x
                ),
                minY: Math.min(
                    canvasStore.selectionRect.start.y,
                    canvasStore.selectionRect.end.y
                ),
                maxX: Math.max(
                    canvasStore.selectionRect.start.x,
                    canvasStore.selectionRect.end.x
                ),
                maxY: Math.max(
                    canvasStore.selectionRect.start.y,
                    canvasStore.selectionRect.end.y
                ),
            };

            const padding = SELECTION_PADDING;
            const edgeThreshold = 8;

            const expandedBox = {
                minX: selectionBox.minX - padding,
                maxX: selectionBox.maxX + padding,
                minY: selectionBox.minY - padding,
                maxY: selectionBox.maxY + padding,
            };

            const nearLeft =
                Math.abs(point.x - selectionBox.minX) <= edgeThreshold;
            const nearRight =
                Math.abs(point.x - selectionBox.maxX) <= edgeThreshold;
            const nearTop =
                Math.abs(point.y - selectionBox.minY) <= edgeThreshold;
            const nearBottom =
                Math.abs(point.y - selectionBox.maxY) <= edgeThreshold;

            const inY =
                point.y >= expandedBox.minY && point.y <= expandedBox.maxY;
            const inX =
                point.x >= expandedBox.minX && point.x <= expandedBox.maxX;
            const isInside =
                point.x >= expandedBox.minX &&
                point.x <= expandedBox.maxX &&
                point.y >= expandedBox.minY &&
                point.y <= expandedBox.maxY;

            if (isInside) {
                let cursorHandle: ResizeHandle | null = null;

                if (nearLeft && nearTop) cursorHandle = 'lt';
                else if (nearRight && nearTop) cursorHandle = 'rt';
                else if (nearLeft && nearBottom) cursorHandle = 'lb';
                else if (nearRight && nearBottom) cursorHandle = 'rb';
                else if (nearLeft && inY) cursorHandle = 'l';
                else if (nearRight && inY) cursorHandle = 'r';
                else if (nearTop && inX) cursorHandle = 't';
                else if (nearBottom && inX) cursorHandle = 'b';

                if (cursorHandle) {
                    canvas.style.cursor = getGlobalCursorStyle(cursorHandle);
                    return;
                }

                canvas.style.cursor = 'grab';
                return;
            }
        }

        if (activeShape.value && canvasStore.selectedIds.length === 1) {
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

        if (toolsStore.activeTool === 'select') {
            canvas.style.cursor = topShape ? 'grab' : 'default';
        } else {
            canvas.style.cursor = 'default';
        }
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

        if (canvasStore.isSelecting) {
            canvasStore.endSelection();

            if (canvasStore.selectedIds.length === 1) {
                const singleId = canvasStore.selectedIds[0];

                if (singleId) canvasStore.selectShape(singleId);

                canvasStore.selectionRect = null;
            }
        }

        if (hasMoved.value) {
            if (hasRecordedInteraction.value) {
                canvasStore.endInteraction();
            }
        } else {
            if (hasRecordedInteraction.value) {
                hasRecordedInteraction.value = false;
            }
        }

        if (isDraggingMultiple.value || isResizingMultiple.value) {
            if (hasRecordedInteraction.value) {
                canvasStore.endInteraction();
            }
            isDraggingMultiple.value = false;
            isResizingMultiple.value = false;
            multiResizeStates.value.clear();
            selectionStartBox.value = null;
            dragStartPositions.value.clear();
        }

        if (isCreating.value) {
            if (activeShape.value) {
                if (activeShape.value.type === 'pencil') {
                    const pencil = activeShape.value as PencilShape;
                    const point = getLocalPoint(e);
                    pencil.addPoint(point);
                    pencil.recenterToBoundingBox();
                }

                if (hasRecordedInteraction.value) {
                    canvasStore.endInteraction();
                    hasRecordedInteraction.value = false;
                }

                canvasStore.clearSelection();
                activeShape.value = null;

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

        hasMoved.value = false;
        hasRecordedInteraction.value = false;
        isDragging.value = false;
        isResizing.value = false;
        resizeHandle.value = null;
        resizeStartLocalBox.value = null;
        resizeStartMatrix.value = null;
        resizeStartInverse.value = null;
        resizeStartRotation.value = 0;
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
