<script setup lang="ts">
import { ref, watch, computed } from 'vue';

interface EditableCurve {
    id?: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    cp1X: number;
    cp1Y: number;
    cp2X: number;
    cp2Y: number;
    stroke: string;
    strokeOpacity: number;
    strokeWidth: number;
    bendCount: number;
}

interface CurveSnapshot {
    cp1X: number;
    cp1Y: number;
    cp2X: number;
    cp2Y: number;
    bendCount: number;
}

const props = defineProps<{
    show: boolean;
    curve: EditableCurve | null;
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
    (e: 'update:curve', value: EditableCurve): void;
    (e: 'confirm'): void;
    (e: 'cancel'): void;
}>();

const localCurve = ref<EditableCurve | null>(null);
const bendCount = ref(0);
const isDragging = ref(false);
const svgRef = ref<SVGSVGElement | null>(null);
const dragT = ref<number | null>(null);
const lastMousePos = ref<{ x: number; y: number } | null>(null);
const isLocked = ref(false);

const history = ref<CurveSnapshot[]>([]);
const currentHistoryIndex = ref(-1);

function saveToHistory() {
    if (!localCurve.value) return;

    const snapshot: CurveSnapshot = {
        cp1X: localCurve.value.cp1X,
        cp1Y: localCurve.value.cp1Y,
        cp2X: localCurve.value.cp2X,
        cp2Y: localCurve.value.cp2Y,
        bendCount: bendCount.value,
    };

    if (currentHistoryIndex.value < history.value.length - 1) {
        history.value = history.value.slice(0, currentHistoryIndex.value + 1);
    }

    history.value.push(snapshot);
    currentHistoryIndex.value = history.value.length - 1;
}

function loadFromHistory(index: number) {
    if (!localCurve.value || index < 0 || index >= history.value.length) return;

    const snapshot = history.value[index];
    if (!snapshot) return;

    localCurve.value.cp1X = snapshot.cp1X;
    localCurve.value.cp1Y = snapshot.cp1Y;
    localCurve.value.cp2X = snapshot.cp2X;
    localCurve.value.cp2Y = snapshot.cp2Y;
    bendCount.value = snapshot.bendCount;
    localCurve.value.bendCount = snapshot.bendCount;
    isLocked.value = snapshot.bendCount >= 2;

    currentHistoryIndex.value = index;
}

function undo() {
    if (currentHistoryIndex.value > 0) {
        loadFromHistory(currentHistoryIndex.value - 1);
    }
}

watch(
    () => props.curve,
    (newCurve) => {
        if (newCurve) {
            localCurve.value = JSON.parse(JSON.stringify(newCurve));
            bendCount.value = newCurve.bendCount || 0;
            isLocked.value = bendCount.value >= 2;

            history.value = [
                {
                    cp1X: newCurve.cp1X,
                    cp1Y: newCurve.cp1Y,
                    cp2X: newCurve.cp2X,
                    cp2Y: newCurve.cp2Y,
                    bendCount: bendCount.value,
                },
            ];
            currentHistoryIndex.value = 0;
        } else {
            localCurve.value = null;
            history.value = [];
            currentHistoryIndex.value = -1;
        }
    },
    { immediate: true, deep: true }
);

function getPointOnCurve(t: number): { x: number; y: number } {
    if (!localCurve.value) return { x: 0, y: 0 };

    const x = cubicBezier(
        localCurve.value.startX,
        localCurve.value.cp1X,
        localCurve.value.cp2X,
        localCurve.value.endX,
        t
    );

    const y = cubicBezier(
        localCurve.value.startY,
        localCurve.value.cp1Y,
        localCurve.value.cp2Y,
        localCurve.value.endY,
        t
    );

    return { x, y };
}

function cubicBezier(
    p0: number,
    p1: number,
    p2: number,
    p3: number,
    t: number
): number {
    const mt = 1 - t;
    return (
        mt * mt * mt * p0 +
        3 * mt * mt * t * p1 +
        3 * mt * t * t * p2 +
        t * t * t * p3
    );
}

function findClosestPointOnCurve(x: number, y: number): number {
    if (!localCurve.value) return 0.5;

    const steps = 50;
    let minDist = Infinity;
    let bestT = 0.5;

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const point = getPointOnCurve(t);
        const dist = Math.hypot(point.x - x, point.y - y);

        if (dist < minDist) {
            minDist = dist;
            bestT = t;
        }
    }

    return bestT;
}

function startDrag(event: MouseEvent) {
    if (!localCurve.value || !svgRef.value || isLocked.value) return;

    event.preventDefault();

    const svg = svgRef.value;
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;

    const x =
        ((event.clientX - rect.left) * viewBox.width) / rect.width + viewBox.x;
    const y =
        ((event.clientY - rect.top) * viewBox.height) / rect.height + viewBox.y;

    const t = findClosestPointOnCurve(x, y);
    dragT.value = t;
    lastMousePos.value = { x, y };
    isDragging.value = true;
}

function onDrag(event: MouseEvent) {
    if (
        !isDragging.value ||
        dragT.value === null ||
        !localCurve.value ||
        !svgRef.value ||
        !lastMousePos.value ||
        isLocked.value
    )
        return;

    const svg = svgRef.value;
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;

    const x =
        ((event.clientX - rect.left) * viewBox.width) / rect.width + viewBox.x;
    const y =
        ((event.clientY - rect.top) * viewBox.height) / rect.height + viewBox.y;

    const deltaX = x - lastMousePos.value.x;
    const deltaY = y - lastMousePos.value.y;

    const t = dragT.value;

    const influence1 = 1 - t;
    const influence2 = t;

    localCurve.value.cp1X += deltaX * influence1;
    localCurve.value.cp1Y += deltaY * influence1;
    localCurve.value.cp2X += deltaX * influence2;
    localCurve.value.cp2Y += deltaY * influence2;

    lastMousePos.value = { x, y };
}

function stopDrag() {
    if (isDragging.value && localCurve.value && !isLocked.value) {
        bendCount.value++;

        saveToHistory();

        if (bendCount.value <= 2) {
            localCurve.value.bendCount = bendCount.value;
            isLocked.value = bendCount.value >= 2;
        }
    }

    isDragging.value = false;
    dragT.value = null;
    lastMousePos.value = null;
}

function addBend() {
    if (!localCurve.value || bendCount.value >= 2) return;

    const midX = (localCurve.value.startX + localCurve.value.endX) / 2;
    const midY = (localCurve.value.startY + localCurve.value.endY) / 2;

    if (bendCount.value === 0) {
        localCurve.value.cp1X = midX;
        localCurve.value.cp1Y = midY;
    } else if (bendCount.value === 1) {
        localCurve.value.cp2X = midX;
        localCurve.value.cp2Y = midY;
    }

    bendCount.value++;
    saveToHistory();

    localCurve.value.bendCount = bendCount.value;
    isLocked.value = bendCount.value >= 2;
}

function confirm() {
    if (localCurve.value) {
        emit('update:curve', localCurve.value);
    }
    emit('confirm');
}

function cancel() {
    emit('cancel');
}

function getCurvePath(): string {
    if (!localCurve.value) return '';

    return `M ${localCurve.value.startX} ${localCurve.value.startY} C ${localCurve.value.cp1X} ${localCurve.value.cp1Y}, ${localCurve.value.cp2X} ${localCurve.value.cp2Y}, ${localCurve.value.endX} ${localCurve.value.endY}`;
}

const viewBox = computed(() => {
    if (!localCurve.value) return '0 0 500 300';

    const points = [
        localCurve.value.startX,
        localCurve.value.startY,
        localCurve.value.endX,
        localCurve.value.endY,
        localCurve.value.cp1X,
        localCurve.value.cp1Y,
        localCurve.value.cp2X,
        localCurve.value.cp2Y,
    ];

    const minX = Math.min(...points.filter((_, i) => i % 2 === 0));
    const minY = Math.min(...points.filter((_, i) => i % 2 === 1));
    const maxX = Math.max(...points.filter((_, i) => i % 2 === 0));
    const maxY = Math.max(...points.filter((_, i) => i % 2 === 1));

    const padding = 40;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    return `${minX - padding} ${minY - padding} ${width} ${height}`;
});
</script>

<template>
    <div v-if="show" class="modal-overlay" @click="cancel">
        <div class="modal" @click.stop>
            <h3>Редактирование кривой</h3>

            <div class="curve-preview">
                <svg
                    ref="svgRef"
                    :viewBox="viewBox"
                    class="preview-svg"
                    :class="{ locked: isLocked }"
                    @mousedown="startDrag"
                    @mousemove="onDrag"
                    @mouseup="stopDrag"
                    @mouseleave="stopDrag"
                >
                    <path
                        v-if="localCurve"
                        :d="getCurvePath()"
                        :stroke="isLocked ? '#999' : '#2196f3'"
                        stroke-width="3"
                        fill="none"
                        stroke-linecap="round"
                    />
                </svg>
            </div>

            <div class="info">
                <p>Изгибов: {{ bendCount }}/2</p>
                <p v-if="isLocked" class="warning">
                    Достигнут лимит изгибов (2)
                </p>
            </div>

            <div class="button-group">
                <button @click="addBend" :disabled="bendCount >= 2 || isLocked">
                    Добавить изгиб
                </button>
                <button
                    @click="undo"
                    :disabled="currentHistoryIndex <= 0"
                    class="undo-btn"
                >
                    ↩ Отменить
                </button>
            </div>

            <div class="actions">
                <button class="confirm" @click="confirm">Готово</button>
                <button class="cancel" @click="cancel">Отмена</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
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
    border-radius: 8px;
    min-width: 600px;
    max-width: 90vw;
    max-height: 90vh;
    overflow: auto;
}

.curve-preview {
    background: #f5f5f5;
    border-radius: 4px;
    padding: 1rem;
    margin: 1rem 0;
    min-height: 300px;
    max-height: 70vh;
    overflow: auto;
}

.preview-svg {
    width: 100%;
    height: auto;
    min-height: 300px;
    background: white;
    border: 1px solid #ddd;
    cursor: grab;
}

.preview-svg:active {
    cursor: grabbing;
}

.preview-svg.locked {
    cursor: not-allowed;
    opacity: 0.7;
}

.info {
    text-align: center;
    margin: 1rem 0;
    color: #666;
}

.warning {
    font-size: 0.9rem;
    color: #f44336;
    margin-top: 0.5rem;
    font-weight: bold;
}

.button-group {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    margin: 1rem 0;
    flex-wrap: wrap;
}

.button-group button {
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 0.9rem;
}

.button-group button:hover:not(:disabled) {
    background: #f0f0f0;
}

.button-group button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.undo-btn {
    background: #ffc107 !important;
    color: #000 !important;
    border-color: #ffa000 !important;
}

.undo-btn:hover:not(:disabled) {
    background: #ffb300 !important;
}

.actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 2rem;
}

.actions button {
    padding: 0.5rem 2rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
}

.confirm {
    background: #2196f3;
    color: white;
}

.confirm:hover {
    background: #1976d2;
}

.cancel {
    background: #f44336;
    color: white;
}

.cancel:hover {
    background: #d32f2f;
}
</style>
