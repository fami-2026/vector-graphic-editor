import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { shapeRegistry } from '@/canvas/types';
import { generateId } from '@/canvas/utils/math';
import { PolygonShape } from '@/canvas/types/polygon/polygon';
import type { Shape, Point } from '@/canvas/types';
import { CurveShapeWrapper } from '@/canvas/types/curve/curve';

interface ShapeParams extends Record<string, unknown> {
    sides?: number;
    width?: number;
    height?: number;
    radius?: number;
    fill?: string;
    fillOpacity?: number;
    stroke?: string;
    strokeOpacity?: number;
    strokeWidth?: number;
    rotation?: number;
}

interface CurveDrawingState {
    points: Point[];
}

export interface EditableCurve {
    id?: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    cp1X: number;
    cp1Y: number;
    cp2X: number;
    cp2Y: number;
    stroke: string;
    strokeOpacity: number;
    strokeWidth: number;
    bendCount: number;
    originalStartX?: number;
    originalStartY?: number;
    originalEndX?: number;
    originalEndY?: number;
    offsetX?: number;
    offsetY?: number;
}

type SerializedShapeBase = {
    type: string;
    id: string;
    position: { x: number; y: number };
    rotation: number;
    scaleX: number;
    scaleY: number;
};

type SerializedShape = SerializedShapeBase & Record<string, unknown>;

type SceneSnapshot = {
    shapes: SerializedShape[];
    selectedId: string | null;
};

export const useCanvasStore = defineStore('canvas', () => {
    const shapes = ref<Shape[]>([]);
    const selectedId = ref<string | null>(null);

    const curveDrawing = ref<CurveDrawingState | null>(null);
    const tempCurve = ref<EditableCurve | null>(null);
    const showCurveDialog = ref(false);

    const undoStack = ref<SceneSnapshot[]>([]);
    const redoStack = ref<SceneSnapshot[]>([]);
    const isInteractionActive = ref(false);
    const HISTORY_LIMIT = 50;

    let isContinuousChangeActive = false;
    let continuousChangeTimer: number | null = null;
    const CONTINUOUS_CHANGE_TIMEOUT = 700;

    const selectedShape = computed(
        () => shapes.value.find((s) => s.id === selectedId.value) ?? null
    );

    function serializeShape(shape: Shape): SerializedShape {
        const plain = JSON.parse(JSON.stringify(shape)) as SerializedShape;
        plain.type = (shape as unknown as { type: string }).type;
        plain.id = shape.id;
        plain.position = { x: shape.position.x, y: shape.position.y };
        plain.rotation = shape.rotation;
        plain.scaleX = shape.scaleX;
        plain.scaleY = shape.scaleY;
        return plain;
    }

    function createSnapshot(): SceneSnapshot {
        return {
            shapes: shapes.value.map((s) => serializeShape(s)),
            selectedId: selectedId.value,
        };
    }

    function restoreSnapshot(snapshot: SceneSnapshot) {
        const restored: Shape[] = snapshot.shapes.map((plain) => {
            const { type, id, position, ...rest } = plain;
            const shape = shapeRegistry.create(type, id, position);
            Object.assign(shape, rest);
            return shape as Shape;
        });

        shapes.value = restored;
        selectedId.value = snapshot.selectedId;
    }

    function pushHistory() {
        const snapshot = createSnapshot();
        undoStack.value.push(snapshot);
        if (undoStack.value.length > HISTORY_LIMIT) {
            undoStack.value.shift();
        }
        redoStack.value = [];
    }

    function startInteraction() {
        if (!isInteractionActive.value) {
            pushHistory();
            isInteractionActive.value = true;
        }
    }

    function endInteraction() {
        isInteractionActive.value = false;
    }

    function ensureHistoryForContinuousChange() {
        if (isInteractionActive.value) return;

        if (!isContinuousChangeActive) {
            pushHistory();
            isContinuousChangeActive = true;
        }

        if (continuousChangeTimer !== null) {
            window.clearTimeout(continuousChangeTimer);
        }

        continuousChangeTimer = window.setTimeout(() => {
            isContinuousChangeActive = false;
            continuousChangeTimer = null;
        }, CONTINUOUS_CHANGE_TIMEOUT);
    }

    function undo() {
        const snapshot = undoStack.value.pop();
        if (!snapshot) return;

        const current = createSnapshot();
        redoStack.value.push(current);
        restoreSnapshot(snapshot);
    }

    function redo() {
        const snapshot = redoStack.value.pop();
        if (!snapshot) return;

        const current = createSnapshot();
        undoStack.value.push(current);
        restoreSnapshot(snapshot);
    }

    const canUndo = computed(() => undoStack.value.length > 0);
    const canRedo = computed(() => redoStack.value.length > 0);

    function addShape(
        type: string,
        pos: { x: number; y: number },
        params?: ShapeParams
    ) {
        pushHistory();

        if (type === 'polygon' && params?.sides) {
            const shape = new PolygonShape(
                generateId(),
                pos,
                params.sides,
                100,
                100,
                0,
                'transparent',
                1,
                '#000000',
                1,
                2
            );
            shapes.value.push(shape);
            return shape;
        }

        const shape = shapeRegistry.create(type, generateId(), pos);
        shapes.value.push(shape);
        return shape;
    }

    function updateShape(id: string, updates: Partial<Shape>) {
        ensureHistoryForContinuousChange();
        const shape = shapes.value.find((s) => s.id === id);
        if (shape) {
            Object.assign(shape, updates);
            shapes.value = [...shapes.value];
        }
    }

    function deleteShape(id: string) {
        pushHistory();
        shapes.value = shapes.value.filter((s) => s.id !== id);
        if (selectedId.value === id) selectedId.value = null;
    }

    function moveShape(fromIndex: number, toIndex: number) {
        if (
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= shapes.value.length ||
            toIndex >= shapes.value.length
        ) {
            return;
        }

        pushHistory();
        const next = [...shapes.value];
        const [item] = next.splice(fromIndex, 1);
        if (!item) {
            return;
        }
        next.splice(toIndex, 0, item);
        shapes.value = next;
    }

    function selectShape(id: string | null) {
        selectedId.value = id;
    }

    function startCurveDrawing() {
        curveDrawing.value = {
            points: [],
        };
    }

    function handleCanvasClick(x: number, y: number) {
        if (!curveDrawing.value) {
            return;
        }

        curveDrawing.value.points.push({ x, y });

        if (curveDrawing.value.points.length === 2) {
            createStraightCurve();
        }
    }

    function createStraightCurve() {
        if (!curveDrawing.value) return;
        if (curveDrawing.value.points.length === 2) {
            const points = curveDrawing.value.points;
            const start = points[0];
            const end = points[1];

            if (start && end) {
                const curve = new CurveShapeWrapper(generateId(), start);

                curve.endX = end.x;
                curve.endY = end.y;

                const dx = end.x - start.x;
                const dy = end.y - start.y;
                curve.cp1X = start.x + dx / 3;
                curve.cp1Y = start.y + dy / 3;
                curve.cp2X = start.x + (2 * dx) / 3;
                curve.cp2Y = start.y + (2 * dy) / 3;

                shapes.value.push(curve);
                curveDrawing.value = null;
            }
        }
    }

    function updateCurve(updatedCurve: EditableCurve) {
        if (!updatedCurve.id) return;

        const index = shapes.value.findIndex((s) => s.id === updatedCurve.id);
        if (index !== -1) {
            const shape = shapes.value[index] as unknown as CurveShapeWrapper;

            shape.startX = updatedCurve.startX;
            shape.startY = updatedCurve.startY;
            shape.endX = updatedCurve.endX;
            shape.endY = updatedCurve.endY;
            shape.cp1X = updatedCurve.cp1X;
            shape.cp1Y = updatedCurve.cp1Y;
            shape.cp2X = updatedCurve.cp2X;
            shape.cp2Y = updatedCurve.cp2Y;
            shape.bendCount = updatedCurve.bendCount;

            shapes.value = [...shapes.value];
        }
    }

    function editCurve(shape: CurveShapeWrapper) {
        const editableCurve: EditableCurve = {
            id: shape.id,
            startX: shape.startX,
            startY: shape.startY,
            endX: shape.endX,
            endY: shape.endY,
            cp1X: shape.cp1X,
            cp1Y: shape.cp1Y,
            cp2X: shape.cp2X,
            cp2Y: shape.cp2Y,
            stroke: shape.stroke,
            strokeOpacity: shape.strokeOpacity || 1,
            strokeWidth: shape.strokeWidth,
            bendCount: shape.bendCount || 0,
            originalStartX: shape.startX,
            originalStartY: shape.startY,
            originalEndX: shape.endX,
            originalEndY: shape.endY,
            offsetX: 0,
            offsetY: 0,
        };

        tempCurve.value = editableCurve;
        showCurveDialog.value = true;
    }

    function cancelCurveDrawing() {
        curveDrawing.value = null;
        tempCurve.value = null;
        showCurveDialog.value = false;
    }

    function confirmCurve() {
        if (tempCurve.value) {
            const c = tempCurve.value;
            const curve = new CurveShapeWrapper(generateId(), {
                x: c.originalStartX!,
                y: c.originalStartY!,
            });

            curve.cp1X = c.cp1X;
            curve.cp1Y = c.cp1Y;
            curve.cp2X = c.cp2X;
            curve.cp2Y = c.cp2Y;

            shapes.value.push(curve);
            tempCurve.value = null;
        }
        showCurveDialog.value = false;
    }

    return {
        shapes,
        selectedId,
        selectedShape,
        addShape,
        updateShape,
        deleteShape,
        selectShape,
        moveShape,
        undo,
        redo,
        canUndo,
        canRedo,
        startInteraction,
        endInteraction,
        curveDrawing,
        tempCurve,
        showCurveDialog,
        startCurveDrawing,
        handleCanvasClick,
        cancelCurveDrawing,
        confirmCurve,
        editCurve,
        updateCurve,
    };
});
