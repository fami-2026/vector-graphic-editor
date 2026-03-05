<script setup lang="ts">
import { useToolsStore, type ToolType } from '@/stores/tools';
import { useCanvasStore } from '@/stores/canvas';
import { storeToRefs } from 'pinia';
import type { ShapeType } from '@/canvas/types';
import { ref } from 'vue';

const toolsStore = useToolsStore();
const canvasStore = useCanvasStore();
const { activeTool } = storeToRefs(toolsStore);

// Состояние для диалога многоугольника
const showPolygonDialog = ref(false);
const polygonSides = ref(5);

interface ToolConfig {
    id: ToolType;
    icon: string;
    title: string;
    action?: () => void;
}

const tools: ToolConfig[] = [
    {
        id: 'select',
        icon: '✓',
        title: 'Выделение',
        action: () => toolsStore.setActiveTool('select'),
    },
    {
        id: 'rect',
        icon: '▭',
        title: 'Прямоугольник',
        action: () => addShape('rect'),
    },
    {
        id: 'circle',
        icon: '◯',
        title: 'Круг',
        action: () => addShape('circle'),
    },
    {
        id: 'line',
        icon: '/',
        title: 'Линия',
        action: () => addShape('line'),
    },
    {
        id: 'triangle',
        icon: '△',
        title: 'Треугольник',
        action: () => addShape('triangle'),
    },
    {
        id: 'polygon',
        icon: '⬔',
        title: 'Многоугольник',
        action: () => {
            showPolygonDialog.value = true;
        },
    },
    {
        id: 'star',
        icon: '☆',
        title: 'Звезда',
        action: () => addShape('star'),
    },
    {
        id: 'hexagon',
        icon: '⬡',
        title: 'Шестиугольник',
        action: () => addShape('hexagon'),
    },
    {
        id: 'arrow',
        icon: '→',
        title: 'Стрелка',
        action: () => addShape('arrow'),
    },
];

function handleToolClick(tool: ToolConfig) {
    if (tool.action) {
        tool.action();
    } else {
        toolsStore.setActiveTool(tool.id);
    }
}

interface ShapeParams {
    sides?: number;
    [key: string]: unknown;
}

function addShape(type: ShapeType, customParams?: ShapeParams) {
    canvasStore.addShape(type, { x: 400, y: 300 }, customParams);
    toolsStore.setActiveTool('select');
}

function createPolygon() {
    addShape('polygon', { sides: polygonSides.value });
    showPolygonDialog.value = false;
    polygonSides.value = 5;
}
</script>

<template>
    <div class="toolbar">
        <h3>Инструменты</h3>
        <div class="button-group">
            <button
                v-for="tool in tools"
                :key="tool.id"
                :class="{ active: activeTool === tool.id }"
                @click="handleToolClick(tool)"
                :title="tool.title"
            >
                {{ tool.icon }}
            </button>
        </div>

        <div
            v-if="showPolygonDialog"
            class="modal-overlay"
            @click="showPolygonDialog = false"
        >
            <div class="modal" @click.stop>
                <h3>Создание многоугольника</h3>
                <div class="form-group">
                    <label>Количество углов (3-12):</label>
                    <input
                        type="number"
                        v-model.number="polygonSides"
                        min="3"
                        max="12"
                        @keyup.enter="createPolygon"
                    />
                </div>
                <div class="modal-buttons">
                    <button @click="createPolygon">Создать</button>
                    <button @click="showPolygonDialog = false">Отмена</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.toolbar {
    padding: 1rem;
    background: #f0f0f0;
    border-right: 1px solid #ccc;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
    min-width: 80px;
    height: 100vh;
    overflow-y: auto;
}

h3 {
    margin: 0;
    font-size: 0.8rem;
    color: #666;
    text-transform: uppercase;
    width: 100%;
    text-align: center;
}

.button-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
}

button {
    width: 100%;
    padding: 0.75rem;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1.2rem;
    transition: all 0.2s;
    color: #666;
}

button:hover {
    background: #f5f5f5;
    border-color: #999;
}

button.active {
    background: #2196f3;
    color: white;
    border-color: #1976d2;
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
    z-index: 1000;
}

.modal {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    min-width: 300px;
}

.form-group {
    margin: 1rem 0;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: #666;
}

.form-group input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
}

.modal-buttons {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
}

.modal-buttons button {
    width: auto;
    padding: 0.5rem 1rem;
}

.modal-buttons button:first-child {
    background: #2196f3;
    color: white;
    border-color: #1976d2;
}

.modal-buttons button:first-child:hover {
    background: #1976d2;
}
</style>
