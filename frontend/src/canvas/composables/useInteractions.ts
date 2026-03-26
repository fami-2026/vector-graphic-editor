import { ref, watch, type Ref } from 'vue';
import type {
    Shape,
    Point,
    BoundingBox,
    LineShape,
    PencilShape,
} from '@/canvas/types';
import { useCanvasStore } from '@/stores/canvas';
import { useToolsStore } from '@/stores/tools';
import { SHAPE_CREATION_TOOLS, type ToolType } from '@/config/tools';
import {
    detectResizeHandle,
    getCursorStyle,
    getGlobalCursorStyle,
    getSelectionBox,
    hitTestSelectionBox,
    type ResizeHandle,
} from './useInteractions.helpers';

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
    const rotateLastPointerAngle = ref<number | null>(null);
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
    const MIN_RESIZE_BASE_SIZE = 0.1;
    const MIN_SHAPE_SIZE = 1;
    const MIN_PROPORTIONAL_RATIO = 0.01;
    const MIN_CREATE_DRAG_DISTANCE_SQ = 4;
    const MIN_PENCIL_POINT_DISTANCE = 1;
    const LINE_SNAP_ANGLE_STEP = Math.PI / 4;
    const DIRECTIONAL_HANDLE_MAX_LENGTH = 2;
    const FULL_ROTATION_DEGREES = 360;
    type HandleFlags = Readonly<{
        left: boolean;
        right: boolean;
        top: boolean;
        bottom: boolean;
    }>;
    type NormalizedBounds = Readonly<{
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        width: number;
        height: number;
        signX: -1 | 1;
        signY: -1 | 1;
    }>;
    type AxisBounds = Readonly<{ min: number; max: number }>;

    function setCanvasCursor(cursor: string) {
        const canvas = canvasRef.value;
        if (!canvas) return;
        canvas.style.cursor = cursor;
    }

    function startInteractionIfNeeded() {
        if (hasRecordedInteraction.value) return;
        // Один жест = одна запись в историю.
        // Так drag/resize не превращаются в сотни шагов undo.
        canvasStore.startInteraction();
        hasRecordedInteraction.value = true;
    }

    /**
     * Фильтрует микродвижения мыши, чтобы не стартовать drag/resize от случайного дрожания курсора.
     */
    function passDragThreshold(dx: number, dy: number): boolean {
        if (hasMoved.value) return true;

        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) {
            return false;
        }

        hasMoved.value = true;
        return true;
    }

    function readCreationParams(): Record<string, unknown> | null {
        return toolsStore.creationParams;
    }

    function clearToolCreationParams() {
        toolsStore.clearCreationParams();
    }

    function beginCreation(tool: ToolType, point: Point) {
        canvasStore.clearSelection();
        activeShape.value = null;
        isCreating.value = true;
        createStart.value = point;
        createToolType.value = tool;
        createParams.value = readCreationParams();
    }

    function startPanInteraction(event: MouseEvent) {
        isPanning.value = true;
        panStart.value = { x: event.clientX, y: event.clientY };
        setCanvasCursor('grabbing');
    }

    function handleEraserInteraction(topShape: Shape | null) {
        if (!topShape) {
            return;
        }

        if (canvasStore.selectedIds.includes(topShape.id)) {
            canvasStore.deleteSelectedShapes();
            return;
        }

        canvasStore.deleteShape(topShape.id);
    }

    function startPencilCreation(point: Point) {
        beginCreation('pencil', point);
        startInteractionIfNeeded();

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
        setCanvasCursor('crosshair');
    }

    function getCurrentSelectionBox(): BoundingBox | null {
        return getSelectionBox(
            canvasStore.selectionRect,
            canvasStore.selectedIds.length
        );
    }

    /**
     * Преобразует код хэндла (lt/rb/...) в набор осевых флагов для математики ресайза.
     */
    function getHandleFlags(handle: ResizeHandle): HandleFlags {
        const directionalHandle =
            handle.length <= DIRECTIONAL_HANDLE_MAX_LENGTH ? handle : '';
        return {
            left: directionalHandle.includes('l'),
            right: directionalHandle.includes('r'),
            top: directionalHandle.includes('t'),
            bottom: directionalHandle.includes('b'),
        };
    }

    function isCornerHandle(flags: HandleFlags): boolean {
        return (flags.left || flags.right) && (flags.top || flags.bottom);
    }

    /**
     * Проверяет, есть ли среди выделения повернутые фигуры.
     * Это важно для принудительного пропорционального ресайза группы.
     */
    function hasRotatedShapes(states: Map<string, ShapeResizeState>): boolean {
        for (const state of states.values()) {
            if (Math.abs(state.shape.rotation % 180) > 0) {
                return true;
            }
        }
        return false;
    }

    function applyFlipRotation(
        startRotation: number,
        flipX: boolean,
        flipY: boolean
    ): number {
        let nextRotation = startRotation;
        if (flipX) {
            nextRotation =
                (FULL_ROTATION_DEGREES - nextRotation) % FULL_ROTATION_DEGREES;
        }
        if (flipY) {
            nextRotation =
                (FULL_ROTATION_DEGREES - nextRotation) % FULL_ROTATION_DEGREES;
        }
        return nextRotation;
    }

    /**
     * Вычисляет знак масштаба при пересечении курсором фиксированной оси.
     * Используется для корректного отражения фигуры при ресайзе.
     */
    function resolveScaleSign(
        pointer: number,
        anchor: number,
        expectedDirection: -1 | 1
    ): -1 | 1 {
        const actualDirection = Math.sign(pointer - anchor) || expectedDirection;
        return actualDirection === expectedDirection ? 1 : -1;
    }

    function updateSelectionRectBounds(
        minX: number,
        minY: number,
        maxX: number,
        maxY: number
    ) {
        if (!canvasStore.selectionRect) return;
        canvasStore.selectionRect.start = { x: minX, y: minY };
        canvasStore.selectionRect.end = { x: maxX, y: maxY };
    }

    function moveSelectionRectFromStart(
        startBox: BoundingBox,
        deltaX: number,
        deltaY: number
    ) {
        updateSelectionRectBounds(
            startBox.minX + deltaX,
            startBox.minY + deltaY,
            startBox.maxX + deltaX,
            startBox.maxY + deltaY
        );
    }

    /**
     * Нормализует сырой прямоугольник ресайза:
     * приводит min/max в корректный порядок и сохраняет знаки отражения по осям.
     */
    function normalizeBounds(
        rawMinX: number,
        rawMaxX: number,
        rawMinY: number,
        rawMaxY: number
    ): NormalizedBounds {
        const signX: -1 | 1 = rawMinX > rawMaxX ? -1 : 1;
        const signY: -1 | 1 = rawMinY > rawMaxY ? -1 : 1;
        const minX = Math.min(rawMinX, rawMaxX);
        const maxX = Math.max(rawMinX, rawMaxX);
        const minY = Math.min(rawMinY, rawMaxY);
        const maxY = Math.max(rawMinY, rawMaxY);

        return {
            minX,
            maxX,
            minY,
            maxY,
            width: Math.max(MIN_SHAPE_SIZE, maxX - minX),
            height: Math.max(MIN_SHAPE_SIZE, maxY - minY),
            signX,
            signY,
        };
    }

    /**
     * Вычисляет относительный коэффициент изменения размера вдоль одной оси.
     */
    function resolveAxisRatio(
        pointer: number,
        startMin: number,
        startMax: number,
        size: number,
        negative: boolean,
        positive: boolean
    ): number {
        if (negative) {
            return (startMax - pointer) / size;
        }
        if (positive) {
            return (pointer - startMin) / size;
        }
        return 1;
    }

    /**
     * Выбирает единый пропорциональный коэффициент для shift-ресайза.
     */
    function resolveProportionalRatio(
        ratioX: number,
        ratioY: number,
        flags: HandleFlags
    ): number {
        if (flags.left || flags.right) {
            return Math.abs(ratioX);
        }
        if (flags.top || flags.bottom) {
            return Math.abs(ratioY);
        }
        return Math.max(Math.abs(ratioX), Math.abs(ratioY));
    }

    /**
     * Строит границы по одной оси для пропорционального ресайза
     * с учетом фиксированной стороны и направления.
     */
    function resolveProportionalAxisBounds(
        startMin: number,
        startMax: number,
        size: number,
        ratio: number,
        direction: number,
        negative: boolean,
        positive: boolean
    ): AxisBounds {
        if (negative) {
            return {
                min: startMax - size * ratio * direction,
                max: startMax,
            };
        }
        if (positive) {
            return {
                min: startMin,
                max: startMin + size * ratio * direction,
            };
        }

        const half = (size * ratio) / 2;
        const center = (startMin + startMax) / 2;
        return {
            min: center - half,
            max: center + half,
        };
    }

    /**
     * Строит границы по оси для свободного (непропорционального) ресайза.
     */
    function resolveFreeAxisBounds(
        startMin: number,
        startMax: number,
        delta: number,
        negative: boolean,
        positive: boolean
    ): AxisBounds {
        return {
            min: negative ? startMin + delta : startMin,
            max: positive ? startMax + delta : startMax,
        };
    }

    /**
     * Преобразует текущую позицию курсора в новые min/max выбранной оси.
     */
    function resolveAxisBoundsFromPointer(
        pointer: number,
        startMin: number,
        startMax: number,
        negative: boolean,
        positive: boolean
    ): AxisBounds {
        if (negative) {
            return {
                min: Math.min(startMax, pointer),
                max: Math.max(startMax, pointer),
            };
        }
        if (positive) {
            return {
                min: Math.min(startMin, pointer),
                max: Math.max(startMin, pointer),
            };
        }
        return { min: startMin, max: startMax };
    }

    function resetResizeState() {
        isResizing.value = false;
        resizeHandle.value = null;
        resizeStartLocalBox.value = null;
        resizeStartMatrix.value = null;
        resizeStartInverse.value = null;
        resizeStartRotation.value = 0;
        rotateLastPointerAngle.value = null;
        lineStartLocal.value = null;
    }

    function resetMultiSelectionState() {
        isDraggingMultiple.value = false;
        isResizingMultiple.value = false;
        multiResizeStates.value.clear();
        selectionStartBox.value = null;
        dragStartPositions.value.clear();
    }

    function resetCreationState() {
        isCreating.value = false;
        createStart.value = null;
        createToolType.value = null;
        createParams.value = null;
    }

    function resetCreationDraftState() {
        createStart.value = null;
        createToolType.value = null;
        createParams.value = null;
    }

    function endInteractionIfNeeded() {
        if (!hasRecordedInteraction.value) return;
        canvasStore.endInteraction();
        hasRecordedInteraction.value = false;
    }

    watch(
        () => toolsStore.activeTool,
        (newTool) => {
            // Если вышли из режима select, сбрасываем выделение сразу.
            // Это предотвращает "залипание" resize/drag состояния при смене инструмента.
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

            // Когда выбор исчезает полностью, важно зачистить временные флаги.
            // Иначе следующий жест может стартовать из устаревшей промежуточной стадии.
            if (!selected && canvasStore.selectedIds.length === 0) {
                isDragging.value = false;
                resetResizeState();
                resetMultiSelectionState();
                resetCreationDraftState();
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

            // Вычисляем мировую точку под курсором до изменения зума,
            // чтобы после масштабирования оставить её под тем же пикселем.
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
        const zoomCoef = (1 / zoom.value) * 100;
        for (let i = shapes.value.length - 1; i >= 0; i--) {
            const shape = shapes.value[i];
            if (shape?.hitTest(point, zoomCoef)) return shape;
        }
        return null;
    }
    function onMouseDown(e: MouseEvent) {
        // Ветки идут от самых "эксклюзивных" режимов к общему select:
        // если рано не выйти, select-пайплайн перехватит событие и даст неверный сценарий.
        if (
            e.button === 1 ||
            (toolsStore.activeTool === 'hand' && e.button === 0)
        ) {
            e.preventDefault();
            startPanInteraction(e);
            return;
        }

        const point = getLocalPoint(e);
        const topShape = hitTest(point);

        if (toolsStore.activeTool === 'eraser') {
            handleEraserInteraction(topShape);
            return;
        }

        if (toolsStore.activeTool === 'pencil') {
            startPencilCreation(point);
            return;
        }

        if (SHAPE_CREATION_TOOLS.includes(toolsStore.activeTool)) {
            beginCreation(toolsStore.activeTool, point);
            return;
        }

        if (toolsStore.activeTool === 'select') {
            if (canvasStore.selectedIds.length === 1 && activeShape.value) {
                const handle = detectResizeHandle(
                    activeShape.value,
                    point,
                    zoom.value
                );
                if (handle) {
                    e.preventDefault();
                    isResizing.value = true;
                    resizeHandle.value = handle;
                    hasMoved.value = false;
                    dragStart.value = point;

                    resizeStartLocalBox.value = activeShape.value.getLocalBox();
                    resizeStartMatrix.value = activeShape.value.getMatrix();
                    resizeStartInverse.value =
                        activeShape.value.getInverseMatrix();
                    resizeStartScale.value = {
                        x: activeShape.value.scaleX,
                        y: activeShape.value.scaleY,
                    };
                    resizeStartRotation.value = activeShape.value.rotation;

                    if (handle === 'rot') {
                        const center = activeShape.value.position;
                        rotateLastPointerAngle.value = Math.atan2(
                            point.y - center.y,
                            point.x - center.x
                        );
                    } else {
                        rotateLastPointerAngle.value = null;
                    }

                    if (activeShape.value.type === 'line') {
                        const line = activeShape.value as LineShape;
                        if (line.localEndPoint)
                            lineStartLocal.value = { ...line.localEndPoint };
                    }

                    setCanvasCursor(getCursorStyle(handle, activeShape.value));
                    return;
                }
            }

            if (canvasStore.selectedIds.length > 1) {
                const selectionBox = getCurrentSelectionBox();
                const { handle, isInside } = hitTestSelectionBox(
                    point,
                    selectionBox,
                    zoom.value
                );

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

                    selectionStartBox.value = selectionBox;
                    dragStart.value = point;

                    setCanvasCursor(getGlobalCursorStyle(handle));
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

                    selectionStartBox.value = selectionBox;

                    setCanvasCursor('grabbing');
                    return;
                }
            }

            if (topShape) {
                const isSelected = canvasStore.selectedIds.includes(
                    topShape.id
                );

                if (!isSelected) {
                    canvasStore.selectShapeWithAdd(topShape.id, e.shiftKey);
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

                    setCanvasCursor('grabbing');
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
        if (!canvasRef.value) return;

        if (isPanning.value) {
            const dx = e.clientX - panStart.value.x;
            const dy = e.clientY - panStart.value.y;
            if (dx !== 0 || dy !== 0) {
                canvasStore.movePan({ x: dx, y: dy });
                panStart.value = { x: e.clientX, y: e.clientY };
            }
            setCanvasCursor('grabbing');
            return;
        }

        if (isDraggingMultiple.value) {
            if (!dragStartPositions.value.size || !selectionStartBox.value) {
                return;
            }

            const dx = point.x - dragStart.value.x;
            const dy = point.y - dragStart.value.y;

            if (!passDragThreshold(dx, dy)) return;
            startInteractionIfNeeded();

            dragStartPositions.value.forEach((startPos, id) => {
                const shape = shapes.value.find((s) => s.id === id);
                if (shape) {
                    shape.position.x = startPos.x + dx;
                    shape.position.y = startPos.y + dy;
                }
            });

            if (canvasStore.selectionRect && selectionStartBox.value) {
                moveSelectionRectFromStart(selectionStartBox.value, dx, dy);
            }

            setCanvasCursor('grabbing');
            return;
        }

        if (
            isResizingMultiple.value &&
            resizeHandle.value &&
            selectionStartBox.value
        ) {
            const dx = point.x - dragStart.value.x;
            const dy = point.y - dragStart.value.y;

            if (!passDragThreshold(dx, dy)) return;
            startInteractionIfNeeded();

            const handle = resizeHandle.value;
            const handleFlags = getHandleFlags(handle);
            const shift = e.shiftKey;
            const startBox = selectionStartBox.value;

            const origW = Math.max(MIN_RESIZE_BASE_SIZE, startBox.maxX - startBox.minX);
            const origH = Math.max(MIN_RESIZE_BASE_SIZE, startBox.maxY - startBox.minY);

            const forceProportional =
                shift || hasRotatedShapes(multiResizeStates.value);
            // Для группы с поворотом свободный ресайз визуально "ломает" композицию.
            // Поэтому удерживаем единый коэффициент масштаба даже без shift.

            let rawMinX = startBox.minX,
                rawMaxX = startBox.maxX;
            let rawMinY = startBox.minY,
                rawMaxY = startBox.maxY;

            if (forceProportional) {
                const ratioX = resolveAxisRatio(
                    point.x,
                    startBox.minX,
                    startBox.maxX,
                    origW,
                    handleFlags.left,
                    handleFlags.right
                );
                const ratioY = resolveAxisRatio(
                    point.y,
                    startBox.minY,
                    startBox.maxY,
                    origH,
                    handleFlags.top,
                    handleFlags.bottom
                );

                let ratio = resolveProportionalRatio(
                    ratioX,
                    ratioY,
                    handleFlags
                );

                ratio = Math.max(MIN_PROPORTIONAL_RATIO, ratio);

                const dirX = Math.sign(ratioX) || 1;
                const dirY = Math.sign(ratioY) || 1;
                const xBounds = resolveProportionalAxisBounds(
                    startBox.minX,
                    startBox.maxX,
                    origW,
                    ratio,
                    dirX,
                    handleFlags.left,
                    handleFlags.right
                );
                const yBounds = resolveProportionalAxisBounds(
                    startBox.minY,
                    startBox.maxY,
                    origH,
                    ratio,
                    dirY,
                    handleFlags.top,
                    handleFlags.bottom
                );

                rawMinX = xBounds.min;
                rawMaxX = xBounds.max;
                rawMinY = yBounds.min;
                rawMaxY = yBounds.max;
            } else {
                const deltaX = point.x - dragStart.value.x;
                const deltaY = point.y - dragStart.value.y;
                const xBounds = resolveFreeAxisBounds(
                    startBox.minX,
                    startBox.maxX,
                    deltaX,
                    handleFlags.left,
                    handleFlags.right
                );
                const yBounds = resolveFreeAxisBounds(
                    startBox.minY,
                    startBox.maxY,
                    deltaY,
                    handleFlags.top,
                    handleFlags.bottom
                );

                rawMinX = xBounds.min;
                rawMaxX = xBounds.max;
                rawMinY = yBounds.min;
                rawMaxY = yBounds.max;
            }

            const normalizedBounds = normalizeBounds(
                rawMinX,
                rawMaxX,
                rawMinY,
                rawMaxY
            );

            const absScaleX = normalizedBounds.width / origW;
            const absScaleY = normalizedBounds.height / origH;
            const oldCenterX = (startBox.minX + startBox.maxX) / 2;
            const oldCenterY = (startBox.minY + startBox.maxY) / 2;
            const newCenterX =
                (normalizedBounds.minX + normalizedBounds.maxX) / 2;
            const newCenterY =
                (normalizedBounds.minY + normalizedBounds.maxY) / 2;

            multiResizeStates.value.forEach((state) => {
                const shape = state.shape;

                // relX/relY хранят положение фигуры относительно центра группы.
                // Это позволяет масштабировать всю группу как целостный блок.
                const relX = (state.startPosition.x - oldCenterX) / (origW / 2);
                const relY = (state.startPosition.y - oldCenterY) / (origH / 2);

                shape.position.x =
                    newCenterX +
                    relX * normalizedBounds.signX * (normalizedBounds.width / 2);
                shape.position.y =
                    newCenterY +
                    relY * normalizedBounds.signY * (normalizedBounds.height / 2);

                shape.scaleX = state.startScale.x * normalizedBounds.signX;
                shape.scaleY = state.startScale.y * normalizedBounds.signY;

                if (shape.type !== 'line') {
                    shape.rotation = applyFlipRotation(
                        state.startRotation,
                        normalizedBounds.signX === -1,
                        normalizedBounds.signY === -1
                    );

                    const localBox = state.startLocalBox;
                    const newLocalWidth =
                        (localBox.maxX - localBox.minX) * absScaleX;
                    const newLocalHeight =
                        (localBox.maxY - localBox.minY) * absScaleY;
                    shape.setSize(
                        Math.max(MIN_SHAPE_SIZE, newLocalWidth),
                        Math.max(MIN_SHAPE_SIZE, newLocalHeight)
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

            updateSelectionRectBounds(
                normalizedBounds.minX,
                normalizedBounds.minY,
                normalizedBounds.maxX,
                normalizedBounds.maxY
            );

            setCanvasCursor(getGlobalCursorStyle(handle));
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
                    ) >= MIN_PENCIL_POINT_DISTANCE
                ) {
                    pencil.addPoint(point);
                }

                setCanvasCursor('crosshair');
                return;
            }

            const start = createStart.value;

            let current = { ...point };
            let dx = current.x - start.x;
            let dy = current.y - start.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq < MIN_CREATE_DRAG_DISTANCE_SQ) {
                return;
            }

            if (!activeShape.value) {
                if (!createToolType.value) return;

                startInteractionIfNeeded();

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
            const shape = activeShape.value;

            if (e.shiftKey) {
                if (shape.type === 'line') {
                    // Линии по shift снапаются к 45° шагу:
                    // это ускоряет построение ровных осей и диагоналей.
                    const length = Math.sqrt(distanceSq);
                    if (length > 0) {
                        const angle = Math.atan2(dy, dx);
                        const snap =
                            Math.round(angle / LINE_SNAP_ANGLE_STEP) *
                            LINE_SNAP_ANGLE_STEP;
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

            if (shape.type === 'line') {
                const line = shape as LineShape;
                line.position = { x: start.x, y: start.y };
                line.localEndPoint = {
                    x: current.x - start.x,
                    y: current.y - start.y,
                };
            } else {
                const width = Math.max(
                    MIN_SHAPE_SIZE,
                    Math.abs(current.x - start.x)
                );
                const height = Math.max(
                    MIN_SHAPE_SIZE,
                    Math.abs(current.y - start.y)
                );
                const centerX = (start.x + current.x) / 2;
                const centerY = (start.y + current.y) / 2;

                shape.position = { x: centerX, y: centerY };
                shape.setSize(width, height);
            }

            setCanvasCursor('crosshair');
            return;
        }

        if (isResizing.value && activeShape.value && resizeHandle.value) {
            const handle = resizeHandle.value;
            const handleFlags = getHandleFlags(handle);
            const shift = e.shiftKey;

            const dx = point.x - dragStart.value.x;
            const dy = point.y - dragStart.value.y;

            if (!passDragThreshold(dx, dy)) return;
            startInteractionIfNeeded();

            if (handle === 'rot') {
                const center = activeShape.value.position;
                const angle = Math.atan2(
                    point.y - center.y,
                    point.x - center.x
                );
                if (rotateLastPointerAngle.value === null) {
                    rotateLastPointerAngle.value = angle;
                }

                const deltaAngle = angle - rotateLastPointerAngle.value;
                // Нормализация через sin/cos убирает скачки на границе -PI/PI,
                // чтобы поворот не "переворачивался" при проходе через 180°.
                const normalizedDelta = Math.atan2(
                    Math.sin(deltaAngle),
                    Math.cos(deltaAngle)
                );
                const deltaDeg = normalizedDelta * (180 / Math.PI);

                activeShape.value.rotation =
                    (activeShape.value.rotation +
                        deltaDeg +
                        FULL_ROTATION_DEGREES) %
                    FULL_ROTATION_DEGREES;
                rotateLastPointerAngle.value = angle;

                setCanvasCursor(getCursorStyle(handle, activeShape.value));
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
                startInteractionIfNeeded();
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
                setCanvasCursor('crosshair');
                return;
            }

            startInteractionIfNeeded();
            let nMinX = startBox.minX,
                nMaxX = startBox.maxX;
            let nMinY = startBox.minY,
                nMaxY = startBox.maxY;

            let moveX = localMouse.x;
            let moveY = localMouse.y;

            if (shift && isCornerHandle(handleFlags)) {
                const origW = startBox.maxX - startBox.minX;
                const origH = startBox.maxY - startBox.minY;

                const fixedX = handleFlags.left ? startBox.maxX : startBox.minX;
                const fixedY = handleFlags.top ? startBox.maxY : startBox.minY;

                const deltaX = localMouse.x - fixedX;
                const deltaY = localMouse.y - fixedY;
                const kx = origW === 0 ? 1 : Math.abs(deltaX) / origW;
                const ky = origH === 0 ? 1 : Math.abs(deltaY) / origH;
                const ratio = Math.max(kx, ky, MIN_PROPORTIONAL_RATIO);

                moveX = fixedX + Math.sign(deltaX || 1) * origW * ratio;
                moveY = fixedY + Math.sign(deltaY || 1) * origH * ratio;

                nMinX = Math.min(fixedX, moveX);
                nMaxX = Math.max(fixedX, moveX);
                nMinY = Math.min(fixedY, moveY);
                nMaxY = Math.max(fixedY, moveY);
            } else {
                const xBounds = resolveAxisBoundsFromPointer(
                    localMouse.x,
                    startBox.minX,
                    startBox.maxX,
                    handleFlags.left,
                    handleFlags.right
                );
                const yBounds = resolveAxisBoundsFromPointer(
                    localMouse.y,
                    startBox.minY,
                    startBox.maxY,
                    handleFlags.top,
                    handleFlags.bottom
                );

                nMinX = xBounds.min;
                nMaxX = xBounds.max;
                nMinY = yBounds.min;
                nMaxY = yBounds.max;

                if (handleFlags.left || handleFlags.right) {
                    moveX = localMouse.x;
                }
                if (handleFlags.top || handleFlags.bottom) {
                    moveY = localMouse.y;
                }
            }

            const newWidth = Math.abs(nMaxX - nMinX);
            const newHeight = Math.abs(nMaxY - nMinY);

            activeShape.value.setSize(
                Math.max(MIN_SHAPE_SIZE, newWidth),
                Math.max(MIN_SHAPE_SIZE, newHeight)
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

            if (handleFlags.left || handleFlags.right) {
                const fixedX = handleFlags.left ? startBox.maxX : startBox.minX;
                const expectedDir: -1 | 1 = handleFlags.left ? -1 : 1;
                const signX = resolveScaleSign(moveX, fixedX, expectedDir);
                activeShape.value.scaleX = startScaleX * signX;
            }

            if (handleFlags.top || handleFlags.bottom) {
                const fixedY = handleFlags.top ? startBox.maxY : startBox.minY;
                const expectedDir: -1 | 1 = handleFlags.top ? -1 : 1;
                const signY = resolveScaleSign(moveY, fixedY, expectedDir);
                activeShape.value.scaleY = startScaleY * signY;
            }

            setCanvasCursor(getCursorStyle(handle, activeShape.value));
            return;
        }

        if (isDragging.value && activeShape.value) {
            const dx = point.x - dragStart.value.x;
            const dy = point.y - dragStart.value.y;

            if (!passDragThreshold(dx, dy)) return;
            startInteractionIfNeeded();

            activeShape.value.position.x = dragStartPosition.value.x + dx;
            activeShape.value.position.y = dragStartPosition.value.y + dy;

            setCanvasCursor('grabbing');
            return;
        }

        if (canvasStore.selectedIds.length > 0 && canvasStore.selectionRect) {
            const selectionBox = getCurrentSelectionBox();
            const { handle, isInside } = hitTestSelectionBox(
                point,
                selectionBox,
                zoom.value
            );

            if (handle) {
                setCanvasCursor(getGlobalCursorStyle(handle));
                return;
            }

            if (isInside) {
                setCanvasCursor('grab');
                return;
            }
        }

        if (activeShape.value && canvasStore.selectedIds.length === 1) {
            const handle = detectResizeHandle(
                activeShape.value,
                point,
                zoom.value
            );
            if (handle) {
                setCanvasCursor(getCursorStyle(handle, activeShape.value));
                return;
            }
        }

        const topShape = hitTest(point);
        if (toolsStore.activeTool === 'hand') {
            setCanvasCursor('grab');
            return;
        }

        if (toolsStore.activeTool === 'select') {
            setCanvasCursor(topShape ? 'grab' : 'default');
        } else {
            setCanvasCursor('default');
        }
    }

    function onMouseUp(e: MouseEvent) {
        if (isPanning.value) {
            isPanning.value = false;
            setCanvasCursor(toolsStore.activeTool === 'hand' ? 'grab' : 'default');
            return;
        }

        if (canvasStore.isSelecting) {
            canvasStore.endSelection();

            if (canvasStore.selectedIds.length === 1) {
                const singleId = canvasStore.selectedIds[0];

                if (singleId) canvasStore.selectShape(singleId);
            }
        }

        if (isCreating.value) {
            if (activeShape.value) {
                if (activeShape.value.type === 'pencil') {
                    const pencil = activeShape.value as PencilShape;
                    const point = getLocalPoint(e);
                    pencil.addPoint(point);
                    pencil.recenterToBoundingBox();
                }

                endInteractionIfNeeded();

                canvasStore.clearSelection();
                activeShape.value = null;
                clearToolCreationParams();
            }

            resetCreationState();
            setCanvasCursor('default');
            return;
        }

        if (
            isDraggingMultiple.value ||
            isResizingMultiple.value ||
            hasMoved.value
        ) {
            endInteractionIfNeeded();
        }

        if (isDraggingMultiple.value || isResizingMultiple.value) {
            resetMultiSelectionState();
        }

        hasMoved.value = false;
        hasRecordedInteraction.value = false;
        isDragging.value = false;
        resetResizeState();

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
