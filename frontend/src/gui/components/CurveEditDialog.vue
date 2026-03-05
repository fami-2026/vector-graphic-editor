<script setup lang="ts">
import { ref, watch } from 'vue';

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
    originalStartX?: number;
    originalStartY?: number;
    originalEndX?: number;
    originalEndY?: number;
    offsetX?: number;
    offsetY?: number;
}

interface CurveState {
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

// Локальная копия кривой для редактирования
const localCurve = ref<EditableCurve | null>(null);
const bendCount = ref(0);
const isDragging = ref(false);
const svgRef = ref<SVGSVGElement | null>(null);

const history = ref<CurveState[]>([]);
const currentHistoryIndex = ref(-1);

const dragT = ref<number | null>(null);
const lastMousePos = ref<{ x: number; y: number } | null>(null);
const isLocked = ref(false);

function saveState() {
    if (!localCurve.value) return;

    const state: CurveState = {
        cp1X: localCurve.value.cp1X,
        cp1Y: localCurve.value.cp1Y,
        cp2X: localCurve.value.cp2X,
        cp2Y: localCurve.value.cp2Y,
        bendCount: bendCount.value,
    };

    if (currentHistoryIndex.value < history.value.length - 1) {
        history.value = history.value.slice(0, currentHistoryIndex.value + 1);
    }

    history.value.push(state);
    currentHistoryIndex.value = history.value.length - 1;
}

function undo() {
    if (currentHistoryIndex.value > 0 && localCurve.value) {
        currentHistoryIndex.value--;
        const state = history.value[currentHistoryIndex.value];

        if (state) {
            localCurve.value.cp1X = state.cp1X;
            localCurve.value.cp1Y = state.cp1Y;
            localCurve.value.cp2X = state.cp2X;
            localCurve.value.cp2Y = state.cp2Y;
            bendCount.value = state.bendCount;
            localCurve.value.bendCount = state.bendCount;

            isLocked.value = bendCount.value >= 2;
        }
    }
}

// Копируем пропс в локальную переменную
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
        }
    },
    { immediate: true }
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

function bezierDerivative(
    p0: number,
    p1: number,
    p2: number,
    p3: number,
    t: number
): number {
    return (
        3 * (1 - t) * (1 - t) * (p1 - p0) +
        6 * (1 - t) * t * (p2 - p1) +
        3 * t * t * (p3 - p2)
    );
}

function startDrag(event: MouseEvent) {
    if (!localCurve.value || !svgRef.value || isLocked.value) return;

    event.preventDefault();

    const svg = svgRef.value;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;

    const svgPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse());

    const x = svgPoint.x;
    const y = svgPoint.y;

    const steps = 200;
    let minDist = Infinity;
    let bestT = 0.5;

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const { x: cx, y: cy } = getPointOnCurve(t);

        const dist = Math.sqrt(Math.pow(cx - x, 2) + Math.pow(cy - y, 2));

        if (dist < minDist) {
            minDist = dist;
            bestT = t;
        }
    }

    if (minDist > 20) return;

    dragT.value = bestT;
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
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;

    const svgPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse());

    const currentX = svgPoint.x;
    const currentY = svgPoint.y;

    const deltaX = currentX - lastMousePos.value.x;
    const deltaY = currentY - lastMousePos.value.y;

    const t = dragT.value;

    const dx = bezierDerivative(
        localCurve.value.startX,
        localCurve.value.cp1X,
        localCurve.value.cp2X,
        localCurve.value.endX,
        t
    );
    const dy = bezierDerivative(
        localCurve.value.startY,
        localCurve.value.cp1Y,
        localCurve.value.cp2Y,
        localCurve.value.endY,
        t
    );
    const len = Math.sqrt(dx * dx + dy * dy);

    const nx = len > 0 ? dx / len : 1;
    const ny = len > 0 ? dy / len : 0;

    const normX = -ny;
    const normY = nx;

    const dot = deltaX * normX + deltaY * normY;

    const influence1 = 1 - t;
    const influence2 = t;

    localCurve.value.cp1X += dot * normX * influence1 * 1.5;
    localCurve.value.cp1Y += dot * normY * influence1 * 1.5;
    localCurve.value.cp2X += dot * normX * influence2 * 1.5;
    localCurve.value.cp2Y += dot * normY * influence2 * 1.5;

    lastMousePos.value = { x: currentX, y: currentY };
}

function stopDrag() {
    if (isDragging.value && localCurve.value && !isLocked.value) {
        saveState();

        const newBendCount = bendCount.value + 1;
        if (newBendCount <= 2) {
            bendCount.value = newBendCount;
            localCurve.value.bendCount = newBendCount;

            if (newBendCount >= 2) {
                isLocked.value = true;
            }
        }
    }

    isDragging.value = false;
    dragT.value = null;
    lastMousePos.value = null;
}

function addBend() {
    if (!localCurve.value || bendCount.value >= 2) return;

    saveState();

    const midX = (localCurve.value.startX + localCurve.value.endX) / 2;
    const midY = (localCurve.value.startY + localCurve.value.endY) / 2;

    if (bendCount.value === 0) {
        localCurve.value.cp1X = midX;
        localCurve.value.cp1Y = midY;
        const dx = localCurve.value.endX - localCurve.value.startX;
        const dy = localCurve.value.endY - localCurve.value.startY;
        localCurve.value.cp2X = localCurve.value.startX + (2 * dx) / 3;
        localCurve.value.cp2Y = localCurve.value.startY + (2 * dy) / 3;
    } else if (bendCount.value === 1) {
        localCurve.value.cp2X = midX;
        localCurve.value.cp2Y = midY;
    }

    bendCount.value++;
    localCurve.value.bendCount = bendCount.value;

    if (bendCount.value >= 2) {
        isLocked.value = true;
    }
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
</script>

<template>
    <div v-if="show" class="modal-overlay" @click="cancel">
        <div class="modal" @click.stop>
            <h3>Редактирование кривой</h3>

            <div class="curve-preview">
                <svg
                    ref="svgRef"
                    viewBox="0 0 500 300"
                    class="preview-svg"
                    :class="{ locked: isLocked }"
                    @mousedown="startDrag"
                    @mousemove="onDrag"
                    @mouseup="stopDrag"
                    @mouseleave="stopDrag"
                >
                    <path
                        :d="getCurvePath()"
                        :stroke="isLocked ? '#999' : '#2196f3'"
                        stroke-width="12"
                        fill="none"
                        stroke-linecap="round"
                        :opacity="isLocked ? 0.3 : 0.6"
                    />

                    <path
                        :d="getCurvePath()"
                        stroke="#ffffff"
                        stroke-width="3"
                        fill="none"
                        stroke-linecap="round"
                    />

                    <circle
                        v-if="isDragging && dragT !== null && !isLocked"
                        :cx="getPointOnCurve(dragT).x"
                        :cy="getPointOnCurve(dragT).y"
                        r="12"
                        fill="rgba(255, 193, 7, 0.3)"
                        stroke="#ffc107"
                        stroke-width="2"
                    />
                </svg>
            </div>

            <div class="info">
                <p>Изгибов: {{ bendCount }}/2</p>
                <p v-if="isLocked" class="warning">
                    Достигнут лимит изгибов (2)
                </p>
                <p class="hint">
                    * Нажмите и перетащите любую точку на кривой, чтобы изменить
                    её форму
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
    max-width: 800px;
}

.curve-preview {
    background: #f5f5f5;
    border-radius: 4px;
    padding: 1rem;
    margin: 1rem 0;
}

.preview-svg {
    width: 100%;
    height: 300px;
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

.hint {
    font-size: 0.8rem;
    color: #999;
    margin-top: 0.5rem;
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
