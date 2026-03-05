<script setup lang="ts">
import { ref, watch } from 'vue';

// Определяем тип прямо здесь
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
    strokeWidth: number;
    bendCount: number;
    originalStartX?: number;
    originalStartY?: number;
    originalEndX?: number;
    originalEndY?: number;
    offsetX?: number;
    offsetY?: number;
}

const props = defineProps<{
    show: boolean;
    curve: EditableCurve | null;
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
    (e: 'update:curve', value: EditableCurve | null): void;
    (e: 'confirm'): void;
    (e: 'cancel'): void;
}>();

type PointType = 'start' | 'end' | 'control';

interface DisplayPoint {
    x: number;
    y: number;
    type: PointType;
    index: number;
}

const bendCount = ref(0);
const isDragging = ref(false);
const svgRef = ref<SVGSVGElement | null>(null);
const dragT = ref<number | null>(null);
const lastMousePos = ref<{ x: number, y: number } | null>(null);

// Локальная копия кривой для редактирования
const localCurve = ref<EditableCurve | null>(null);

// Точки для отображения
const previewPoints = ref<DisplayPoint[]>([]);

watch(() => props.curve, (newCurve) => {
    if (newCurve) {
        // Создаем глубокую копию
        localCurve.value = JSON.parse(JSON.stringify(newCurve));
        bendCount.value = newCurve.bendCount || 0;
        updatePointsFromCurve();
    } else {
        localCurve.value = null;
    }
}, { immediate: true });

function updatePointsFromCurve() {
    if (!localCurve.value) return;
    
    const points: DisplayPoint[] = [];
    points.push({ 
        x: localCurve.value.startX, 
        y: localCurve.value.startY, 
        type: 'start',
        index: 0 
    });
    
    points.push({ 
        x: localCurve.value.endX, 
        y: localCurve.value.endY, 
        type: 'end',
        index: 1 
    });
    
    points.push({ 
        x: localCurve.value.cp1X, 
        y: localCurve.value.cp1Y, 
        type: 'control',
        index: 2 
    });
    
    points.push({ 
        x: localCurve.value.cp2X, 
        y: localCurve.value.cp2Y, 
        type: 'control',
        index: 3 
    });
    
    previewPoints.value = points;
}

function getPointOnCurve(t: number): { x: number, y: number } {
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

function cubicBezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const mt = 1 - t;
    return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

function bezierDerivative(p0: number, p1: number, p2: number, p3: number, t: number): number {
    return 3 * (1 - t) * (1 - t) * (p1 - p0) + 
           6 * (1 - t) * t * (p2 - p1) + 
           3 * t * t * (p3 - p2);
}

function startDrag(event: MouseEvent) {
    if (!localCurve.value || !svgRef.value) return;
    
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
        
        const dist = Math.sqrt(
            Math.pow(cx - x, 2) + 
            Math.pow(cy - y, 2)
        );
        
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
    if (!isDragging.value || dragT.value === null || !localCurve.value || !svgRef.value || !lastMousePos.value) return;
    
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
    
    const dx = bezierDerivative(localCurve.value.startX, localCurve.value.cp1X, localCurve.value.cp2X, localCurve.value.endX, t);
    const dy = bezierDerivative(localCurve.value.startY, localCurve.value.cp1Y, localCurve.value.cp2Y, localCurve.value.endY, t);
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
    
    updateBendCount();
    updatePointsFromCurve();
}

function stopDrag() {
    isDragging.value = false;
    dragT.value = null;
    lastMousePos.value = null;
}

function updateBendCount() {
    if (!localCurve.value) return;
    
    const dx = localCurve.value.endX - localCurve.value.startX;
    const dy = localCurve.value.endY - localCurve.value.startY;
    
    const straightC1X = localCurve.value.startX + dx / 3;
    const straightC1Y = localCurve.value.startY + dy / 3;
    const dist1 = Math.sqrt(
        Math.pow(localCurve.value.cp1X - straightC1X, 2) + 
        Math.pow(localCurve.value.cp1Y - straightC1Y, 2)
    );
    
    const straightC2X = localCurve.value.startX + 2 * dx / 3;
    const straightC2Y = localCurve.value.startY + 2 * dy / 3;
    const dist2 = Math.sqrt(
        Math.pow(localCurve.value.cp2X - straightC2X, 2) + 
        Math.pow(localCurve.value.cp2Y - straightC2Y, 2)
    );
    
    let count = 0;
    if (dist1 > 5) count++;
    if (dist2 > 5) count++;
    
    localCurve.value.bendCount = count;
    bendCount.value = count;
}

function addBend() {
    if (!localCurve.value || bendCount.value >= 2) return;
    
    const midX = (localCurve.value.startX + localCurve.value.endX) / 2;
    const midY = (localCurve.value.startY + localCurve.value.endY) / 2;
    
    if (bendCount.value === 0) {
        localCurve.value.cp1X = midX;
        localCurve.value.cp1Y = midY;
    } else {
        localCurve.value.cp2X = midX;
        localCurve.value.cp2Y = midY;
    }
    
    updateBendCount();
    updatePointsFromCurve();
}

function removeLastBend() {
    if (!localCurve.value || bendCount.value === 0) return;
    
    if (bendCount.value === 2) {
        const dx = localCurve.value.endX - localCurve.value.startX;
        const dy = localCurve.value.endY - localCurve.value.startY;
        localCurve.value.cp2X = localCurve.value.startX + 2 * dx / 3;
        localCurve.value.cp2Y = localCurve.value.startY + 2 * dy / 3;
    } else {
        const dx = localCurve.value.endX - localCurve.value.startX;
        const dy = localCurve.value.endY - localCurve.value.startY;
        localCurve.value.cp1X = localCurve.value.startX + dx / 3;
        localCurve.value.cp1Y = localCurve.value.startY + dy / 3;
    }
    
    updateBendCount();
    updatePointsFromCurve();
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
                    @mousedown="startDrag"
                    @mousemove="onDrag"
                    @mouseup="stopDrag"
                    @mouseleave="stopDrag"
                >
                    <path
                        :d="getCurvePath()"
                        stroke="#2196f3"
                        stroke-width="12"
                        fill="none"
                        stroke-linecap="round"
                        opacity="0.6"
                    />
                    
                    <path
                        :d="getCurvePath()"
                        stroke="#ffffff"
                        stroke-width="3"
                        fill="none"
                        stroke-linecap="round"
                    />
                    
                    <circle
                        v-if="isDragging && dragT !== null"
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
                <p class="hint">* Нажмите и перетащите любую точку на кривой, чтобы изменить её форму</p>
            </div>
            
            <div class="button-group">
                <button @click="addBend" :disabled="bendCount >= 2">
                    Добавить изгиб ({{ 2 - bendCount }} осталось)
                </button>
                <button @click="removeLastBend" :disabled="bendCount <= 0">
                    Удалить последний
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
    border-radius: 12px;
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

.button-group {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin: 1rem 0;
}

.button-group button {
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
}

.button-group button:hover:not(:disabled) {
    background: #f0f0f0;
}

.button-group button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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