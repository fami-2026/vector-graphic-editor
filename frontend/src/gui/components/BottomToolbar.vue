<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import {
    Hand,
    MousePointer2,
    Pencil,
    Minus,
    Square,
    Circle,
    Spline,
    Eraser,
    Type,
} from 'lucide-vue-next';
import { useToolsStore, type ToolType } from '@/stores/tools';
import { useCanvasStore } from '@/stores/canvas';

type ToolId =
    | 'hand'
    | 'cursor'
    | 'pencil'
    | 'line'
    | 'rect'
    | 'circle'
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
    { id: 'pencil', title: 'Карандаш', icon: Pencil },
    { id: 'line', title: 'Линия', icon: Minus },
    { id: 'rect', title: 'Прямоугольник', icon: Square },
    { id: 'circle', title: 'Круг', icon: Circle },
    { id: 'curve', title: 'Кривая линия', icon: Spline },
    { id: 'eraser', title: 'Ластик', icon: Eraser },
    { id: 'text', title: 'Текст', icon: Type },
];

const toolsStore = useToolsStore();
const canvasStore = useCanvasStore();

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
        case 'eraser':
            toolsStore.setActiveTool('eraser');
            break;
        default:
            toolsStore.setActiveTool('select');
    }
}

const activeId = computed<ToolId>(() => {
    const active: ToolType = toolsStore.activeTool;
    if (active === 'rect') return 'rect';
    if (active === 'circle') return 'circle';
    if (active === 'line') return 'line';
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
</style>
