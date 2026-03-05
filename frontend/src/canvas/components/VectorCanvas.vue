<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useCanvasStore } from '@/stores/canvas';
import { useCanvasRender } from '@/canvas/composables/useCanvasRender';
import { useInteractions } from '@/canvas/composables/useInteractions';
import CurveEditDialog from '@/gui/components/CurveEditDialog.vue';

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const canvasStore = useCanvasStore();
const { shapes, selectedId, curveDrawing, showCurveDialog, tempCurve } = storeToRefs(canvasStore);

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

const handleCanvasClick = (e: MouseEvent) => {
    if (!canvasRef.value) return;
    
    const rect = canvasRef.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (canvasStore.curveDrawing) {
        canvasStore.handleCanvasClick(x, y);
        e.stopPropagation();
    }
};

const handleCanvasDoubleClick = (e: MouseEvent) => {
    if (!canvasRef.value) return;
    
    const rect = canvasRef.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    for (const shape of canvasStore.shapes) {
        if (shape.type === 'curve' && shape.hitTest({ x, y })) {
            const s = shape as any;
            const editableCurve = {
                id: s.id,
                startX: s.startX,
                startY: s.startY,
                endX: s.endX,
                endY: s.endY,
                cp1X: s.cp1X,
                cp1Y: s.cp1Y,
                cp2X: s.cp2X,
                cp2Y: s.cp2Y,
                stroke: s.stroke,
                strokeWidth: s.strokeWidth,
                bendCount: s.bendCount || 0
            };
            canvasStore.editCurve(editableCurve);
            break;
        }
    }

};

onMounted(() => {
    if (containerRef.value) {
        resizeObserver = new ResizeObserver(updateCanvasSize);
        resizeObserver.observe(containerRef.value);
    }

    detachListeners = attachListeners();
    
    if (canvasRef.value) {
        canvasRef.value.addEventListener('click', handleCanvasClick);
        canvasRef.value.addEventListener('dblclick', handleCanvasDoubleClick);
    }
});

onUnmounted(() => {
    resizeObserver?.disconnect();
    detachListeners?.();
    
    if (canvasRef.value) {
        canvasRef.value.removeEventListener('click', handleCanvasClick);
        canvasRef.value.removeEventListener('dblclick', handleCanvasDoubleClick);
    }
});

watch([shapes, selectedId], () => requestAnimationFrame(draw), { deep: true });
</script>

<template>
    <div ref="containerRef" class="canvas-wrapper">
        <canvas ref="canvasRef" class="main-canvas"></canvas>
        
        <CurveEditDialog
            v-model:show="showCurveDialog"
            :curve="tempCurve"
            @confirm="canvasStore.confirmCurve()"
            @cancel="canvasStore.cancelCurveDrawing()"
        />
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