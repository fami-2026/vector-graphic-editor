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
    Triangle,
    Star,
    Hexagon,
    ArrowUp,
    Pentagon,
    Pencil,
    CopyPlus,
    Diamond,
} from 'lucide-vue-next';
import { useToolsStore, type ToolType } from '@/stores/tools';
import { useCanvasStore } from '@/stores/canvas';
import { storeToRefs } from 'pinia';
import {
    POLYGON_SIDES_LIMITS,
    TOOLBAR_TOOLS,
    TOOLBAR_TOOL_ID_BY_TOOL,
    getToolTitle,
    type ToolbarToolClickMode,
    type ToolbarToolId,
} from '@/config/tools';

type Tool = {
    id: ToolbarToolId;
    title: string;
    icon: Component;
    activeTool: ToolType;
    clickMode: ToolbarToolClickMode;
};

const TOOL_ICON_BY_ID: Readonly<Record<ToolbarToolId, Component>> = {
    hand: Hand,
    cursor: MousePointer2,
    line: Minus,
    rect: Square,
    circle: Circle,
    triangle: Triangle,
    polygon: Pentagon,
    star: Star,
    hexagon: Hexagon,
    parallelogram: Diamond,
    arrow: ArrowUp,
    eraser: Eraser,
    pencil: Pencil,
};

const tools: Tool[] = TOOLBAR_TOOLS.map((entry) => ({
    id: entry.id,
    title: getToolTitle(entry.tool),
    icon: TOOL_ICON_BY_ID[entry.id],
    activeTool: entry.tool,
    clickMode: ('clickMode' in entry ? entry.clickMode : undefined) ?? 'activate',
}));

const toolsStore = useToolsStore();

const canvasStore = useCanvasStore();
const { selectedShape } = storeToRefs(canvasStore);
const canDuplicate = computed(() => {
    return toolsStore.activeTool === 'select' && !!selectedShape.value;
});

// Состояние для диалога многоугольника
const showPolygonDialog = ref(false);
const polygonSides = ref(POLYGON_SIDES_LIMITS.defaultValue);
const polygonInputRef = ref<HTMLInputElement | null>(null);

const TOOL_CLICK_HANDLERS: Readonly<
    Record<ToolbarToolClickMode, (tool: Tool) => void>
> = {
    activate: (tool) => {
        toolsStore.setActiveTool(tool.activeTool);
    },
    'polygon-dialog': () => {
        showPolygonDialog.value = true;
    },
};

const polygonError = computed(() => {
    const sides = Number(polygonSides.value);

    if (!Number.isInteger(sides)) {
        return 'Введите целое число';
    }

    if (sides < POLYGON_SIDES_LIMITS.min || sides > POLYGON_SIDES_LIMITS.max) {
        return (
            'Количество углов должно быть от ' +
            POLYGON_SIDES_LIMITS.min +
            ' до ' +
            POLYGON_SIDES_LIMITS.max
        );
    }

    return '';
});

const isPolygonValid = computed(() => polygonError.value === '');

watch(showPolygonDialog, async (isOpen) => {
    if (isOpen) {
        polygonSides.value = POLYGON_SIDES_LIMITS.defaultValue;

        await nextTick();
        polygonInputRef.value?.focus();
        polygonInputRef.value?.select();
    }
});

function handleClick(tool: Tool) {
    TOOL_CLICK_HANDLERS[tool.clickMode](tool);
}

function closePolygonDialog() {
    showPolygonDialog.value = false;
    polygonSides.value = POLYGON_SIDES_LIMITS.defaultValue;
}

function createPolygon() {
    const sides = Number(polygonSides.value);

    if (
        !Number.isInteger(sides) ||
        sides < POLYGON_SIDES_LIMITS.min ||
        sides > POLYGON_SIDES_LIMITS.max
    ) {
        return;
    }

    toolsStore.setCreationParams({ sides: polygonSides.value });
    toolsStore.setActiveTool('polygon');
    showPolygonDialog.value = false;
    polygonSides.value = POLYGON_SIDES_LIMITS.defaultValue;
}

function handleDuplicate() {
    if (!canDuplicate.value) return;
    canvasStore.duplicateSelectedShape();
}

const activeId = computed<ToolbarToolId>(() => {
    return TOOLBAR_TOOL_ID_BY_TOOL[toolsStore.activeTool] ?? 'cursor';
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
                            Количество углов ({{ POLYGON_SIDES_LIMITS.min }}–{{ POLYGON_SIDES_LIMITS.max }}):
                        </label>

                        <input
                            id="polygon-sides-input"
                            ref="polygonInputRef"
                            v-model.number="polygonSides"
                            type="number"
                            :min="POLYGON_SIDES_LIMITS.min"
                            :max="POLYGON_SIDES_LIMITS.max"
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
