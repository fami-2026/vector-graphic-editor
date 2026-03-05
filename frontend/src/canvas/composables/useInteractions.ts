import { ref, watch, type Ref } from 'vue';
import type { Shape, Point, BoundingBox, LineShape } from '@/canvas/types';
import { useCanvasStore } from '@/stores/canvas';
import { useToolsStore } from '@/stores/tools';
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
    shapes: Ref<Shape[]>
) {
    const canvasStore = useCanvasStore();
    const toolsStore = useToolsStore();

    const isDragging = ref(false);
    const isResizing = ref(false);

    const dragStart = ref<Point>({ x: 0, y: 0 });
    const activeShape = ref<Shape | null>(null);
    const resizeHandle = ref<ResizeHandle | null>(null);

    const resizeStartLocalBox = ref<BoundingBox | null>(null);
    const resizeStartMatrix = ref<DOMMatrix | null>(null);
    const resizeStartInverse = ref<DOMMatrix | null>(null);
    const lineStartLocal = ref<Point | null>(null);

    // Синхронизация выделенной фигуры из стора
    watch(
        [() => canvasStore.selectedId, shapes],
        () => {
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
            }
        },
        { immediate: true }
    );

    /**
     * Конвертирует экранные координаты события мыши в локальные координаты холста.
     */
    function getLocalPoint(e: MouseEvent): Point {
        const rect = canvasRef.value?.getBoundingClientRect();
        return rect
            ? { x: e.clientX - rect.left, y: e.clientY - rect.top }
            : { x: 0, y: 0 };
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
        const point = getLocalPoint(e);
        const topShape = hitTest(point);

        canvasStore.startInteraction();

        if (toolsStore.activeTool === 'eraser') {
            if (topShape) {
                canvasStore.deleteShape(topShape.id);
                if (activeShape.value?.id === topShape.id) {
                    activeShape.value = null;
                }
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

        if (isResizing.value && activeShape.value && resizeHandle.value) {
            const handle = resizeHandle.value;

            // 1. Поворот
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
            let nMinX = startBox.minX,
                nMaxX = startBox.maxX;
            let nMinY = startBox.minY,
                nMaxY = startBox.maxY;

            if (handle.includes('l')) nMinX = localMouse.x;
            if (handle.includes('r')) nMaxX = localMouse.x;
            if (handle.includes('t')) nMinY = localMouse.y;
            if (handle.includes('b')) nMaxY = localMouse.y;

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

            canvas.style.cursor = getCursorStyle(handle, activeShape.value);
            return;
        }

        if (isDragging.value && activeShape.value) {
            const dx = point.x - dragStart.value.x;
            const dy = point.y - dragStart.value.y;
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
        canvas.style.cursor = topShape ? 'grab' : 'default';
    }

    function onMouseUp(e: MouseEvent) {
        canvasStore.endInteraction();
        isDragging.value = false;
        isResizing.value = false;
        resizeHandle.value = null;
        resizeStartLocalBox.value = null;
        resizeStartMatrix.value = null;
        resizeStartInverse.value = null;
        lineStartLocal.value = null;

        onMouseMove(e);
    }

    function attachListeners() {
        const el = canvasRef.value;
        if (!el) return;
        el.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            el.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }

    return { attachListeners };
}
