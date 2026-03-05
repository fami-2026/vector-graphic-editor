import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Shape, Point } from '@/canvas/types';
import { shapeRegistry } from '@/canvas/types';
import { generateId } from '@/canvas/utils/math';
import { PolygonShape } from '@/canvas/types/polygon/polygon';
import { CurveShape } from '@/canvas/types/curve/curve';

// Интерфейс для временной кривой
interface EditableCurve {
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

// Интерфейс для параметров фигур
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

export const useCanvasStore = defineStore('canvas', () => {
    const shapes = ref<Shape[]>([]);
    const selectedId = ref<string | null>(null);
    
    const curveDrawing = ref<CurveDrawingState | null>(null);
    const tempCurve = ref<EditableCurve | null>(null);
    const showCurveDialog = ref(false);
    const isEditingExisting = ref(false);
    const editingCurveId = ref<string | null>(null);

    const selectedShape = computed(
        () => shapes.value.find((s) => s.id === selectedId.value) ?? null
    );

    function startCurveDrawing() {
        curveDrawing.value = {
            points: []
        };
    }

    function handleCanvasClick(x: number, y: number) {
        if (!curveDrawing.value) return;

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
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                
                const centerX = 250;
                const centerY = 150;
                
                const offsetX = centerX - (start.x + end.x) / 2;
                const offsetY = centerY - (start.y + end.y) / 2;
                
                const curve: EditableCurve = {
                    startX: start.x + offsetX,
                    startY: start.y + offsetY,
                    endX: end.x + offsetX,
                    endY: end.y + offsetY,
                    cp1X: start.x + dx / 3 + offsetX,
                    cp1Y: start.y + dy / 3 + offsetY,
                    cp2X: start.x + 2 * dx / 3 + offsetX,
                    cp2Y: start.y + 2 * dy / 3 + offsetY,
                    stroke: '#000000',
                    strokeOpacity: 1,
                    strokeWidth: 2,
                    bendCount: 0,
                    originalStartX: start.x,
                    originalStartY: start.y,
                    originalEndX: end.x,
                    originalEndY: end.y,
                    offsetX: offsetX,
                    offsetY: offsetY
                };
                
                tempCurve.value = curve;
                isEditingExisting.value = false;
                editingCurveId.value = null;
                showCurveDialog.value = true;
            }
        }
    }

    function confirmCurve() {
        if (tempCurve.value) {
            const c = tempCurve.value;
            
            if (isEditingExisting.value && editingCurveId.value) {
                const index = shapes.value.findIndex(s => s.id === editingCurveId.value);
                if (index !== -1 && 
                    c.originalStartX !== undefined && 
                    c.originalStartY !== undefined && 
                    c.originalEndX !== undefined && 
                    c.originalEndY !== undefined &&
                    c.offsetX !== undefined && 
                    c.offsetY !== undefined) {
                    
                    const updatedCurve = new CurveShape(
                        editingCurveId.value,
                        { x: c.originalStartX, y: c.originalStartY },
                        c.originalStartX,
                        c.originalStartY,
                        c.originalEndX,
                        c.originalEndY,
                        c.cp1X - c.offsetX,
                        c.cp1Y - c.offsetY,
                        c.cp2X - c.offsetX,
                        c.cp2Y - c.offsetY,
                        c.stroke,
                        c.strokeOpacity,
                        c.strokeWidth
                    );
                    
                    updatedCurve.bendCount = c.bendCount;
                    shapes.value.splice(index, 1, updatedCurve);
                }
            } else if (
                c.originalStartX !== undefined && 
                c.originalStartY !== undefined && 
                c.originalEndX !== undefined && 
                c.originalEndY !== undefined &&
                c.offsetX !== undefined && 
                c.offsetY !== undefined) {
                
                const curve = new CurveShape(
                    generateId(),
                    { x: c.originalStartX, y: c.originalStartY },
                    c.originalStartX,
                    c.originalStartY,
                    c.originalEndX,
                    c.originalEndY,
                    c.cp1X - c.offsetX,
                    c.cp1Y - c.offsetY,
                    c.cp2X - c.offsetX,
                    c.cp2Y - c.offsetY,
                    c.stroke,
                    c.strokeOpacity,
                    c.strokeWidth
                );
                
                curve.bendCount = c.bendCount;
                shapes.value.push(curve);
            }
            
            tempCurve.value = null;
        }
        curveDrawing.value = null;
        showCurveDialog.value = false;
        isEditingExisting.value = false;
        editingCurveId.value = null;
    }

    function cancelCurveDrawing() {
        curveDrawing.value = null;
        tempCurve.value = null;
        showCurveDialog.value = false;
        isEditingExisting.value = false;
        editingCurveId.value = null;
    }

    function editCurve(curve: EditableCurve) {
        const centerX = 250;
        const centerY = 150;
        
        const offsetX = centerX - (curve.startX + curve.endX) / 2;
        const offsetY = centerY - (curve.startY + curve.endY) / 2;
        
        const editableCurve: EditableCurve = {
            id: curve.id,
            startX: curve.startX + offsetX,
            startY: curve.startY + offsetY,
            endX: curve.endX + offsetX,
            endY: curve.endY + offsetY,
            cp1X: curve.cp1X + offsetX,
            cp1Y: curve.cp1Y + offsetY,
            cp2X: curve.cp2X + offsetX,
            cp2Y: curve.cp2Y + offsetY,
            stroke: curve.stroke,
            strokeOpacity: curve.strokeOpacity,
            strokeWidth: curve.strokeWidth,
            bendCount: curve.bendCount || 0,
            originalStartX: curve.startX,
            originalStartY: curve.startY,
            originalEndX: curve.endX,
            originalEndY: curve.endY,
            offsetX: offsetX,
            offsetY: offsetY
        };
        
        tempCurve.value = editableCurve;
        isEditingExisting.value = true;
        editingCurveId.value = curve.id || null;
        showCurveDialog.value = true;
    }

    function addShape(type: string, pos: { x: number; y: number }, params?: ShapeParams) {
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
        const shape = shapes.value.find((s) => s.id === id);
        if (shape) {
            Object.assign(shape, updates);
            shapes.value = [...shapes.value];
        }
    }

    function deleteShape(id: string) {
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
        const next = [...shapes.value];
        const [item] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, item);
        shapes.value = next;
    }

    function selectShape(id: string | null) {
        selectedId.value = id;
    }

    return {
        shapes,
        selectedId,
        selectedShape,
        curveDrawing,
        tempCurve,
        showCurveDialog,
        isEditingExisting,
        editingCurveId,
        startCurveDrawing,
        handleCanvasClick,
        createStraightCurve,
        confirmCurve,
        cancelCurveDrawing,
        editCurve,
        addShape,
        updateShape,
        deleteShape,
        selectShape,
        moveShape,
    };
});