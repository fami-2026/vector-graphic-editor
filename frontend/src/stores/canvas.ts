import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Shape } from '@/canvas/types';
import { shapeRegistry } from '@/canvas/types';
import { generateId } from '@/canvas/utils/math';
import { PolygonShape } from '@/canvas/types/polygon/polygon';

/**
 * Хранилище состояния сцены: фигуры, выделение, операции.
 */
export const useCanvasStore = defineStore('canvas', () => {
    const shapes = ref<Shape[]>([]);
    const selectedId = ref<string | null>(null);

    const selectedShape = computed(
        () => shapes.value.find((s) => s.id === selectedId.value) ?? null
    );

    function addShape(type: string, pos: { x: number; y: number }, params?: any) {
        // Для многоугольника передаем параметры
        if (type === 'polygon' && params?.sides) {
            const shape = new PolygonShape(
                generateId(),
                pos,
                params.sides,  
                50,            
                0,            
                'transparent',
                '#000000',   
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
        addShape,
        updateShape,
        deleteShape,
        selectShape,
        moveShape,
    };
});