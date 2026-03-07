<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Component } from 'vue';
import {
    Hand,
    MousePointer2,
    Minus,
    Square,
    Circle,
    Eraser,
    Type,
    Triangle,
    Star,
    Hexagon,
    ArrowUp,
    Pentagon,
    Spline,
} from 'lucide-vue-next';
import { useToolsStore, type ToolType } from '@/stores/tools';
import { useCanvasStore } from '@/stores/canvas';

type ToolId =
    | 'hand'
    | 'cursor'
    | 'line'
    | 'rect'
    | 'circle'
    | 'triangle'
    | 'polygon'
    | 'star'
    | 'hexagon'
    | 'arrow'
    | 'curve'
    | 'eraser'
    | 'text';

type Tool = {
    id: ToolId;
    title: string;
    icon: Component;
};

const tools: Tool[] = [
    { id: 'hand', title: 'Рука', icon: Hand },
    { id: 'cursor', title: 'Курсор', icon: MousePointer2 },
    { id: 'line', title: 'Линия', icon: Minus },
    { id: 'rect', title: 'Прямоугольник', icon: Square },
    { id: 'circle', title: 'Круг', icon: Circle },
    { id: 'triangle', title: 'Треугольник', icon: Triangle },
    { id: 'polygon', title: 'Многоугольник', icon: Pentagon },
    { id: 'star', title: 'Звезда', icon: Star },
    { id: 'hexagon', title: 'Шестиугольник', icon: Hexagon },
    { id: 'arrow', title: 'Стрелка', icon: ArrowUp },
    { id: 'curve', title: 'Кривая', icon: Spline },
    { id: 'eraser', title: 'Ластик', icon: Eraser },
    { id: 'text', title: 'Текст', icon: Type },
];

const toolsStore = useToolsStore();
const canvasStore = useCanvasStore();

const showPolygonDialog = ref(false);
const polygonSides = ref(5);

function handleClick(tool: Tool) {
    switch (tool.id) {
        case 'cursor':
        case 'hand':
            toolsStore.setActiveTool('select');
            break;
        case 'rect':
            canvasStore.addShape('rect', { x: 400, y: 300 });
            toolsStore.setActiveTool('select');
            break;
        case 'circle':
            canvasStore.addShape('circle', { x: 400, y: 300 });
            toolsStore.setActiveTool('select');
            break;
        case 'line':
            canvasStore.addShape('line', { x: 400, y: 300 });
            toolsStore.setActiveTool('select');
            break;
        case 'triangle':
            canvasStore.addShape('triangle', { x: 400, y: 300 });
            toolsStore.setActiveTool('select');
            break;
        case 'polygon':
            showPolygonDialog.value = true;
            break;
        case 'star':
            canvasStore.addShape('star', { x: 400, y: 300 });
            toolsStore.setActiveTool('select');
            break;
        case 'hexagon':
            canvasStore.addShape('hexagon', { x: 400, y: 300 });
            toolsStore.setActiveTool('select');
            break;
        case 'arrow':
            canvasStore.addShape('arrow', { x: 400, y: 300 });
            toolsStore.setActiveTool('select');
            break;
        case 'curve':
            toolsStore.setActiveTool('curve');
            canvasStore.startCurveDrawing();
            break;
        case 'eraser':
            toolsStore.setActiveTool('eraser');
            break;
        default:
            toolsStore.setActiveTool('select');
    }
}

function createPolygon() {
    canvasStore.addShape(
        'polygon',
        { x: 400, y: 300 },
        { sides: polygonSides.value }
    );
    showPolygonDialog.value = false;
    polygonSides.value = 5;
    toolsStore.setActiveTool('select');
}

const activeId = computed<ToolId>(() => {
    const active: ToolType = toolsStore.activeTool;
    if (active === 'rect') return 'rect';
    if (active === 'circle') return 'circle';
    if (active === 'line') return 'line';
    if (active === 'triangle') return 'triangle';
    if (active === 'polygon') return 'polygon';
    if (active === 'star') return 'star';
    if (active === 'hexagon') return 'hexagon';
    if (active === 'arrow') return 'arrow';
    if (active === 'curve') return 'curve';
    if (active === 'eraser') return 'eraser';
    return 'cursor';
});
</script>

<template>
    <div class="toolbar" aria-label="Tools">
        <button
            v-for="tool in tools"
            :key="tool.id"
            class="toolBtn"
            :class="{ active: tool.id === activeId }"
            type="button"
            :title="tool.title"
            @click="handleClick(tool)"
        >
            <component
                :is="tool.icon"
                class="lucideIcon"
                :size="18"
                aria-hidden="true"
            />
        </button>

        <Teleport to="body">
            <div
                v-if="showPolygonDialog"
                class="modal-overlay"
                @click="showPolygonDialog = false"
            >
                <div class="modal" @click.stop>
                    <h3>Создание многоугольника</h3>
                    <div class="form-group">
                        <label>Количество углов (3-20):</label>
                        <input
                            type="number"
                            v-model.number="polygonSides"
                            min="3"
                            max="20"
                            @keyup.enter="createPolygon"
                        />
                    </div>
                    <div class="modal-buttons">
                        <button @click="createPolygon">Создать</button>
                        <button @click="showPolygonDialog = false">
                            Отмена
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
.toolbar {
    display: flex;
    align-items: center;
    gap: 8px;

    padding: 8px 10px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
    flex-wrap: wrap;
    position: relative;
}

.toolBtn {
    width: 36px;
    height: 36px;

    display: grid;
    place-items: center;

    background: #ffffff;
    border: 1px solid transparent;
    border-radius: 10px;

    cursor: pointer;
    color: #111827;
}

.toolBtn:hover {
    background: #f3f4f6;
}

.toolBtn.active {
    background: rgba(37, 99, 235, 0.15);
    border-color: rgba(37, 99, 235, 0.35);
    color: #2563eb;
}

.lucideIcon {
    display: block;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
}

.modal {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    min-width: 300px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.modal h3 {
    margin: 0 0 1rem 0;
    font-size: 1.2rem;
    color: #111827;
}

.form-group {
    margin: 1rem 0;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: #4b5563;
    font-size: 0.9rem;
}

.form-group input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 1rem;
    transition: border-color 0.2s;
}

.form-group input:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.modal-buttons {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
}

.modal-buttons button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background-color 0.2s;
}

.modal-buttons button:first-child {
    background: #2563eb;
    color: white;
}

.modal-buttons button:first-child:hover {
    background: #1d4ed8;
}

.modal-buttons button:last-child {
    background: #e5e7eb;
    color: #4b5563;
}

.modal-buttons button:last-child:hover {
    background: #d1d5db;
}
</style>
