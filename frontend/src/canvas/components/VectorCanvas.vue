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
const { shapes, selectedId, curveDrawing, showCurveDialog, tempCurve } =
    storeToRefs(canvasStore);

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
        drawTemporaryPoints();
    }
};

const drawTemporaryPoints = () => {
    if (!canvasRef.value || !curveDrawing.value) return;
    
    const ctx = canvasRef.value.getContext('2d');
    if (!ctx) return;
    
    const points = curveDrawing.value.points;
    
    points.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
        
        if (index === 0) {
            ctx.fillStyle = '#4CAF50';
        } else {
            ctx.fillStyle = '#F44336';
        }
        
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.font = '12px Arial';
        ctx.fillStyle = '#333';
        ctx.fillText(
            point.x + 10,
            point.y - 10
        );
    });
    
    if (points.length === 1) {
        ctx.font = '14px Arial';
        ctx.fillStyle = '#666';
    }
};

const customDraw = () => {
    draw();
    drawTemporaryPoints();
};

const handleCanvasClick = (e: MouseEvent) => {
    if (!canvasRef.value) return;

    const rect = canvasRef.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (canvasStore.curveDrawing) {
        canvasStore.handleCanvasClick(x, y);
        e.stopPropagation();
        customDraw();
    }
};

const handleCanvasDoubleClick = (e: MouseEvent) => {
    if (!canvasRef.value) return;

    const rect = canvasRef.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (const shape of canvasStore.shapes) {
        if (shape.type === 'curve' && shape.hitTest({ x, y })) {
            console.log('🔍 Double clicked on curve:', shape);
            canvasStore.editCurve(shape);
            break;
        }
    }
};

const handleCurveUpdate = (updatedCurve: any) => {
    canvasStore.tempCurve = updatedCurve;
};

const handleCurveConfirm = () => {
    if (canvasStore.tempCurve) {
        canvasStore.updateCurve(canvasStore.tempCurve);
    }
    canvasStore.showCurveDialog = false;
    canvasStore.tempCurve = null;
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

watch([shapes, selectedId, curveDrawing], () => requestAnimationFrame(customDraw), { deep: true });
</script>

<template>
    <div ref="containerRef" class="canvas-wrapper">
        <canvas ref="canvasRef" class="main-canvas"></canvas>

        <CurveEditDialog
            v-if="showCurveDialog && tempCurve"
            v-model:show="showCurveDialog"
            :curve="tempCurve"
            @update:curve="handleCurveUpdate"
            @confirm="handleCurveConfirm"
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