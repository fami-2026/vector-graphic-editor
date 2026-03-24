<template>
    <div class="wrap" aria-label="Zoom and history">
        <div class="zoomPill" role="group" aria-label="Zoom controls">
            <button
                class="iconBtn"
                type="button"
                title="Уменьшить"
                @click="zoomOut"
            >
                <Minus :size="16" aria-hidden="true" />
            </button>

            <div class="zoomValue" v-if="!isEditing" @dblclick="startEditing">
                {{ zoom }}%
            </div>
            <input
                v-else
                ref="inputRef"
                v-model="inputValue"
                type="text"
                class="zoomInput"
                @keydown.enter="saveZoom"
                @keydown.esc="cancelEditing"
                @blur="saveZoom"
                @keydown="validateInput"
                inputmode="numeric"
                pattern="[0-9]*"
            />
            <button
                class="iconBtn"
                type="button"
                title="Увеличить"
                @click="zoomIn"
            >
                <Plus :size="16" aria-hidden="true" />
            </button>
        </div>

        <div class="history" role="group" aria-label="History controls">
            <button
                class="iconBtn square"
                type="button"
                title="Отменить"
                :disabled="!canUndo"
                @click="onUndo"
            >
                <Undo2 :size="16" aria-hidden="true" />
            </button>
            <button
                class="iconBtn square"
                type="button"
                title="Повторить"
                :disabled="!canRedo"
                @click="onRedo"
            >
                <Redo2 :size="16" aria-hidden="true" />
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import { Minus, Plus, Undo2, Redo2 } from 'lucide-vue-next';
import { useCanvasStore } from '@/stores/canvas';

const canvasStore = useCanvasStore();
const { canUndo, canRedo, zoom } = storeToRefs(canvasStore);

const isEditing = ref(false);
const inputValue = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

function zoomIn() {
    canvasStore.zoomIn();
}

function zoomOut() {
    canvasStore.zoomOut();
}

function onUndo() {
    if (canUndo.value) {
        canvasStore.undo();
    }
}

function onRedo() {
    if (canRedo.value) {
        canvasStore.redo();
    }
}

function startEditing() {
    inputValue.value = String(zoom.value);
    isEditing.value = true;
    nextTick(() => {
        inputRef.value?.focus();
        inputRef.value?.select();
    });
}

function validateInput(e: KeyboardEvent) {
    const allowedKeys = [
        'Backspace',
        'Delete',
        'Tab',
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
    ];

    if (allowedKeys.includes(e.key)) return;

    if (!/^\d+$/.test(e.key)) {
        e.preventDefault();
    }
}

function saveZoom() {
    if (!isEditing.value) return;
    const value = parseInt(inputValue.value, 10);
    if (!isNaN(value) && value > 0) {
        const clampedValue = Math.min(value, 500);
        canvasStore.setZoom(clampedValue);
    }
    cancelEditing();
}

function cancelEditing() {
    isEditing.value = false;
    inputValue.value = '';
}
</script>

<style scoped>
.wrap {
    display: flex;
    align-items: center;
    gap: 10px;
}

.zoomPill {
    display: flex;
    align-items: center;
    gap: 6px;

    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 999px;

    padding: 6px 8px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.1);
}

.zoomValue {
    min-width: 44px;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    user-select: none;
}

.zoomValue:hover {
    background: #f3f4f6;
    border-radius: 4px;
}

.zoomInput {
    min-width: 44px;
    width: 50px;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: #374151;
    border: 1px solid #2196f3;
    border-radius: 4px;
    padding: 2px 4px;
    outline: none;
    background: #ffffff;
}

.iconBtn {
    width: 30px;
    height: 30px;

    display: grid;
    place-items: center;

    border: 1px solid transparent;
    border-radius: 999px;

    background: #ffffff;
    cursor: pointer;
    color: #111827;
}

.iconBtn:hover {
    background: #f3f4f6;
}

.iconBtn:active {
    transform: translateY(1px);
}

.iconBtn.square {
    border-radius: 10px;
    border-color: #e5e7eb;
}

.iconBtn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
}

.history {
    display: flex;
    gap: 8px;
}
</style>
