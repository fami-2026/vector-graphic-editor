<script setup lang="ts">
import { computed, nextTick, watch, ref } from 'vue';
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
    Pencil,
    CopyPlus,
} from 'lucide-vue-next';
import { useToolsStore, type ToolType } from '@/stores/tools';
import { useCanvasStore } from '@/stores/canvas';
import { storeToRefs } from 'pinia';

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
    | 'eraser'
    | 'pencil'
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
    { id: 'eraser', title: 'Ластик', icon: Eraser },
    { id: 'pencil', title: 'Карандаш', icon: Pencil },
    { id: 'text', title: 'Текст', icon: Type },
];

const toolsStore = useToolsStore();

const canvasStore = useCanvasStore();
const { selectedShape } = storeToRefs(canvasStore);
const canDuplicate = computed(() => {
    return toolsStore.activeTool === 'select' && !!selectedShape.value;
});

// Состояние для диалога многоугольника
const showPolygonDialog = ref(false);
const polygonSides = ref(5);
const polygonInputRef = ref<HTMLInputElement | null>(null);

const polygonError = computed(() => {
    const sides = Number(polygonSides.value);

    if (!Number.isInteger(sides)) {
        return 'Введите целое число';
    }

    if (sides < 3 || sides > 20) {
        return 'Количество углов должно быть от 3 до 20';
    }

    return '';
});

const isPolygonValid = computed(() => polygonError.value === '');

watch(showPolygonDialog, async (isOpen) => {
    if (isOpen) {
        polygonSides.value = 5;

        await nextTick();
        polygonInputRef.value?.focus();
        polygonInputRef.value?.select();
    }
});

function handleClick(tool: Tool) {
    switch (tool.id) {
        case 'cursor':
            toolsStore.setActiveTool('select');
            break;
        case 'hand':
            toolsStore.setActiveTool('hand');
            break;
        case 'rect':
            toolsStore.setActiveTool('rect');
            break;
        case 'circle':
            toolsStore.setActiveTool('circle');
            break;
        case 'line':
            toolsStore.setActiveTool('line');
            break;
        case 'triangle':
            toolsStore.setActiveTool('triangle');
            break;
        case 'polygon':
            // Показываем диалог для выбора количества углов
            showPolygonDialog.value = true;
            break;
        case 'star':
            toolsStore.setActiveTool('star');
            break;
        case 'hexagon':
            toolsStore.setActiveTool('hexagon');
            break;
        case 'arrow':
            toolsStore.setActiveTool('arrow');
            break;
        case 'eraser':
            toolsStore.setActiveTool('eraser');
            break;
        case 'pencil':
            toolsStore.setActiveTool('pencil');
            break;
        default:
            toolsStore.setActiveTool('select');
    }
}

function closePolygonDialog() {
    showPolygonDialog.value = false;
    polygonSides.value = 5;
}

function createPolygon() {
    const sides = Number(polygonSides.value);

    if (!Number.isInteger(sides) || sides < 3 || sides > 20) {
        return;
    }

    toolsStore.setCreationParams({ sides: polygonSides.value });
    toolsStore.setActiveTool('polygon');
    showPolygonDialog.value = false;
    polygonSides.value = 5;
}

function handleDuplicate() {
    if (!canDuplicate.value) return;
    canvasStore.duplicateSelectedShape();
}

const activeId = computed<ToolId>(() => {
    const active: ToolType = toolsStore.activeTool;
    if (active === 'hand') return 'hand';
    if (active === 'rect') return 'rect';
    if (active === 'circle') return 'circle';
    if (active === 'line') return 'line';
    if (active === 'triangle') return 'triangle';
    if (active === 'polygon') return 'polygon';
    if (active === 'star') return 'star';
    if (active === 'hexagon') return 'hexagon';
    if (active === 'arrow') return 'arrow';
    if (active === 'eraser') return 'eraser';
    if (active === 'pencil') return 'pencil';
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
        <button
            class="toolBtn"
            :class="{ active: false }"
            type="button"
            title="Дублирование"
            :disabled="!canDuplicate"
            @click="handleDuplicate"
        >
            <CopyPlus class="lucideIcon" :size="18" aria-hidden="true" />
        </button>

        <Teleport to="body">
            <div
                v-if="showPolygonDialog"
                class="modal-overlay"
                @click="closePolygonDialog"
            >
                <div
                    class="modal"
                    @click.stop
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="polygon-dialog-title"
                >
                    <h3 id="polygon-dialog-title">Создание многоугольника</h3>

                    <div class="form-group">
                        <label for="polygon-sides-input">
                            Количество углов (3–20):
                        </label>

                        <input
                            id="polygon-sides-input"
                            ref="polygonInputRef"
                            v-model.number="polygonSides"
                            type="number"
                            min="3"
                            max="20"
                            step="1"
                            class="modalInput"
                            :class="{ invalid: polygonError }"
                            aria-describedby="polygon-sides-error"
                            :aria-invalid="Boolean(polygonError)"
                            @keyup.enter="createPolygon"
                        />

                        <p
                            v-if="polygonError"
                            id="polygon-sides-error"
                            class="fieldError"
                        >
                            {{ polygonError }}
                        </p>
                    </div>

                    <div class="modal-buttons">
                        <button
                            class="primaryBtn"
                            :disabled="!isPolygonValid"
                            @click="createPolygon"
                        >
                            Создать
                        </button>
                        <button
                            class="secondaryBtn"
                            @click="closePolygonDialog"
                        >
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

.toolBtn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

.toolBtn:disabled:hover {
    background: transparent;
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

.modalInput.invalid {
    border-color: #dc2626;
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
}

.fieldError {
    margin: 6px 0 0;
    font-size: 12px;
    line-height: 1.4;
    color: #dc2626;
}
</style>
