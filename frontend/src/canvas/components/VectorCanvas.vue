<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useCanvasStore } from '@/stores/canvas';
import { useCanvasRender } from '@/canvas/composables/useCanvasRender';
import { useInteractions } from '@/canvas/composables/useInteractions';

const canvasStore = useCanvasStore();
const {
    shapes,
    selectedId,
    zoom,
    pan,
    backgroundColor,
    hasSelection,
    selectionCount,
    isSelecting,
    selectionBox,
} = storeToRefs(canvasStore);

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const { draw } = useCanvasRender(canvasRef, shapes, selectedId, zoom, pan);
const { attachListeners } = useInteractions(canvasRef, shapes, zoom, pan);

let resizeObserver: ResizeObserver | null = null;
let detachListeners: (() => void) | undefined;
let animationFrameId: number | null = null;

function isEditableElement(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return (
        target.isContentEditable ||
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
    );
}

const handleKeyDown = (e: KeyboardEvent) => {
    if (isEditableElement(e.target)) return;

    if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        canvasStore.hasSelection
    ) {
        e.preventDefault();
        canvasStore.deleteSelectedShapes();
        draw();
    }

    if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        canvasStore.selectAll();
        draw();
    }

    if (e.key === 'Escape') {
        canvasStore.clearSelection();
        draw();
    }
};

const updateCanvasSize = () => {
    if (!containerRef.value || !canvasRef.value) return;

    const { clientWidth, clientHeight } = containerRef.value;

    if (
        canvasRef.value.width !== clientWidth ||
        canvasRef.value.height !== clientHeight
    ) {
        canvasRef.value.width = clientWidth;
        canvasRef.value.height = clientHeight;
        draw();
    }
};

const scheduleDraw = () => {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = requestAnimationFrame(() => {
        draw();
        animationFrameId = null;
    });
};

onMounted(() => {
    if (containerRef.value) {
        resizeObserver = new ResizeObserver(updateCanvasSize);
        resizeObserver.observe(containerRef.value);
    }

    detachListeners = attachListeners();
    window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
    }
    resizeObserver?.disconnect();
    detachListeners?.();
    window.removeEventListener('keydown', handleKeyDown);
});

watch(
    [shapes, selectedId, zoom, pan, backgroundColor, isSelecting, selectionBox],
    () => scheduleDraw(),
    { deep: true }
);
</script>

<template>
    <div ref="containerRef" class="canvas-wrapper">
        <canvas ref="canvasRef" class="main-canvas"></canvas>
        <div v-if="hasSelection" class="selection-info">
            <span>Выбрано: {{ selectionCount }}</span>
            <button
                @click="canvasStore.deleteSelectedShapes"
                class="delete-btn"
            >
                Удалить
            </button>
        </div>
    </div>
</template>

<style scoped>
.canvas-wrapper {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #ffffff;
    position: relative;
    display: block;
}

.main-canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: default;
}

.selection-info {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    padding: 8px 16px;
    display: flex;
    gap: 16px;
    align-items: center;
    z-index: 1000;
    font-size: 14px;
}

.delete-btn {
    background: #f44336;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 4px 12px;
    cursor: pointer;
    font-size: 14px;
}

.delete-btn:hover {
    background: #d32f2f;
}
</style>
