<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useCanvasStore } from '@/stores/canvas';
import { useCanvasRender } from '@/canvas/composables/useCanvasRender';
import { useInteractions } from '@/canvas/composables/useInteractions';

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const { shapes, selectedId } = storeToRefs(useCanvasStore());

const { draw } = useCanvasRender(canvasRef, shapes, selectedId);
const { attachListeners } = useInteractions(canvasRef, shapes);

let resizeObserver: ResizeObserver | null = null;
let detachListeners: (() => void) | undefined;

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

onMounted(() => {
    if (containerRef.value) {
        resizeObserver = new ResizeObserver(updateCanvasSize);
        resizeObserver.observe(containerRef.value);
    }

    detachListeners = attachListeners();

});

onUnmounted(() => {
    resizeObserver?.disconnect();
    detachListeners?.();

});

watch([shapes, selectedId], () => requestAnimationFrame(draw), { deep: true });
</script>

<template>
    <div ref="containerRef" class="canvas-wrapper">
        <canvas ref="canvasRef" class="main-canvas"></canvas>
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
</style>
