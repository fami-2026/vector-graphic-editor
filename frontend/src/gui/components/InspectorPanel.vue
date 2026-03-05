<template>
    <aside class="panel" aria-label="Inspector">
        <!-- Позиция и размеры -->
        <section class="group">
            <h3 class="groupTitle">Позиция и размеры</h3>

            <!-- Расположение: 2 поля -->
            <div class="fieldBlock">
                <div class="fieldLabel">Расположение</div>
                <div class="grid2">
                    <input
                        class="fieldInput"
                        type="number"
                        aria-label="X"
                        :value="selectedShape?.x ?? ''"
                        :disabled="!selectedShape"
                        @input="onNumberChange('x', $event)"
                    />
                    <input
                        class="fieldInput"
                        type="number"
                        aria-label="Y"
                        :value="selectedShape?.y ?? ''"
                        :disabled="!selectedShape"
                        @input="onNumberChange('y', $event)"
                    />
                </div>
            </div>

            <!-- Размер: 2 поля -->
            <div v-if="selectedShape?.type !== 'line'" class="fieldBlock">
                <div class="fieldBlock">
                    <div class="fieldLabel">Размер</div>
                    <div class="grid2">
                        <input
                            class="fieldInput"
                            type="number"
                            aria-label="Width"
                            :value="shapeWidth"
                            :disabled="!selectedShape"
                            min="1"
                            @input="onNumberChange('width', $event)"
                        />
                        <input
                            class="fieldInput"
                            type="number"
                            aria-label="Height"
                            :value="shapeHeight"
                            :disabled="!selectedShape"
                            min="1"
                            @input="onNumberChange('height', $event)"
                        />
                    </div>
                </div>
            </div>
        </section>

        <!-- Масштаб -->
        <div class="fieldBlock">
            <div class="fieldLabel">Масштаб</div>
            <div class="grid2">
                <input
                    class="fieldInput"
                    type="number"
                    aria-label="Scale"
                    :value="selectedShape?.scaleX ?? ''"
                    :disabled="!selectedShape"
                    min="-10"
                    max="10"
                    @input="onNumberChange('scaleX', $event)"
                />
                <input
                    class="fieldInput"
                    type="number"
                    aria-label="Height"
                    :value="selectedShape?.scaleY ?? ''"
                    :disabled="!selectedShape"
                    min="-10"
                    max="10"
                    @input="onNumberChange('scaleY', $event)"
                />
            </div>
            <div class="fieldLabel">Отражение</div>
            <div class="grid2" style="margin-top: 4px">
                <button
                    class="iconBtnSmall"
                    :disabled="!selectedShape"
                    @click="onFlip('scaleX')"
                    title="Отразить по горизонтали"
                >
                    <span style="transform: scaleX(-1)">⇄</span>
                </button>
                <button
                    class="iconBtnSmall"
                    :disabled="!selectedShape"
                    @click="onFlip('scaleY')"
                    title="Отразить по вертикали"
                >
                    <span style="transform: rotate(90deg) scaleX(-1)">⇄</span>
                </button>
            </div>
        </div>

        <!-- Поворот -->
        <div v-if="selectedShape?.type !== 'line'" class="fieldBlock">
            <div class="fieldBlock">
                <div class="fieldLabel">Поворот</div>
                <div class="grid2">
                    <input
                        class="fieldInput"
                        type="number"
                        aria-label="Rotation"
                        :value="selectedShape?.rotation ?? ''"
                        :disabled="!selectedShape"
                        min="0"
                        max="360"
                        @input="onNumberChange('rotation', $event)"
                    />
                    <div class="spacer" aria-hidden="true" />
                </div>
            </div>
        </div>

        <div class="divider" />

        <!-- Фигура -->
        <section class="group">
            <h3 class="groupTitle">Фигура</h3>

            <div class="grid2Blocks">
                <div class="fieldBlock">
                    <div class="fieldLabel">Цвет заливки</div>
                    <div class="grid1">
                        <input
                            class="colorInput"
                            type="color"
                            aria-label="Fill color"
                            :value="fillColor"
                            :disabled="!selectedShape"
                            @input="onColorChange('fill', $event)"
                        />
                    </div>
                </div>

                <div class="fieldBlock">
                    <div class="fieldLabel">Прозрачность</div>
                    <div class="grid1">
                        <input
                            class="fieldInput"
                            type="range"
                            aria-label="Fill opacity"
                            min="0"
                            max="1"
                            step="0.05"
                            :value="fillOpacity"
                            :disabled="!selectedShape"
                            @input="onOpacityChange('fillOpacity', $event)"
                        />
                    </div>
                </div>
            </div>
        </section>

        <div class="divider" />

        <!-- Обводка -->
        <section class="group">
            <h3 class="groupTitle">Обводка</h3>

            <div class="grid2Blocks">
                <div class="fieldBlock">
                    <div class="fieldLabel">Цвет</div>
                    <div class="grid1">
                        <input
                            class="colorInput"
                            type="color"
                            aria-label="Stroke color"
                            :value="strokeColor"
                            :disabled="!selectedShape"
                            @input="onColorChange('stroke', $event)"
                        />
                    </div>
                </div>

                <div class="fieldBlock">
                    <div class="fieldLabel">Прозрачность</div>
                    <div class="grid1">
                        <input
                            class="fieldInput"
                            type="range"
                            aria-label="Stroke opacity"
                            min="0"
                            max="1"
                            step="0.05"
                            :value="strokeOpacity"
                            :disabled="!selectedShape"
                            @input="onOpacityChange('strokeOpacity', $event)"
                        />
                    </div>
                </div>
            </div>

            <div class="fieldBlock">
                <div class="fieldLabel">Толщина</div>
                <div class="grid2">
                    <input
                        class="fieldInput"
                        type="number"
                        aria-label="Stroke width"
                        :value="strokeWidth"
                        :disabled="!selectedShape"
                        min="0"
                        step="0.5"
                        @input="onNumberChange('strokeWidth', $event)"
                    />
                    <div class="spacer" aria-hidden="true" />
                </div>
            </div>
        </section>

        <div class="divider" />

        <!-- Слои -->
        <section class="group">
            <h3 class="groupTitle">Слои</h3>

            <ul class="layersList" role="listbox" aria-label="Layers">
                <li
                    v-for="(shape, index) in layers"
                    :key="shape.id"
                    draggable="true"
                    @dragstart="onLayerDragStart(index, $event)"
                    @dragover.prevent
                    @drop="onLayerDrop(index, $event)"
                >
                    <button
                        class="layerItem"
                        type="button"
                        :class="{ isActive: shape.id === selectedShape?.id }"
                        @click="onSelectLayer(shape.id)"
                    >
                        <span class="thumb" aria-hidden="true">
                            {{ shapeThumb(shape.type) }}
                        </span>
                        <span class="layerName">
                            {{ shapeLabel(shape.type) }}
                        </span>
                    </button>
                </li>
            </ul>
        </section>
    </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useCanvasStore } from '@/stores/canvas';
import type { Shape } from '@/canvas/types';

const canvasStore = useCanvasStore();
const { selectedShape, shapes } = storeToRefs(canvasStore);

function getShapeNumberProp(key: string, fallback: number | '') {
    if (!selectedShape.value) return fallback;
    const value = (selectedShape.value as unknown as Record<string, unknown>)[
        key
    ];
    return typeof value === 'number' ? value : fallback;
}

function getShapeStringProp(key: string, fallback: string) {
    if (!selectedShape.value) return fallback;
    const value = (selectedShape.value as unknown as Record<string, unknown>)[
        key
    ];
    return typeof value === 'string' ? value : fallback;
}

const shapeWidth = computed(() => getShapeNumberProp('width', ''));

const shapeHeight = computed(() => getShapeNumberProp('height', ''));

const fillColor = computed(() => getShapeStringProp('fill', '#000000'));

const strokeColor = computed(() => getShapeStringProp('stroke', '#000000'));

const fillOpacity = computed(() => getShapeNumberProp('fillOpacity', 1));

const strokeOpacity = computed(() => getShapeNumberProp('strokeOpacity', 1));

const strokeWidth = computed(() => getShapeNumberProp('strokeWidth', ''));

// список слоёв — снизу вверх по очередности в массиве shapes
const layers = computed(() => shapes.value);

const draggedLayerIndex = ref<number | null>(null);

type NumberFieldKey =
    | 'x'
    | 'y'
    | 'width'
    | 'height'
    | 'rotation'
    | 'strokeWidth'
    | 'scaleX'
    | 'scaleY';

function onNumberChange(key: NumberFieldKey, event: Event) {
    if (!selectedShape.value) return;
    const target = event.target as HTMLInputElement;
    const value = Number(target.value);
    if (Number.isNaN(value)) return;

    canvasStore.updateShape(selectedShape.value.id, {
        [key]: value,
    } as Partial<Shape>);
}

function onFlip(key: 'scaleX' | 'scaleY') {
    if (!selectedShape.value) return;

    const currentScale = Number((selectedShape.value as Partial<Shape>)[key]);
    const currentRotation = selectedShape.value.rotation;

    const newRotation =
        key === 'scaleX'
            ? (360 - currentRotation) % 360
            : (180 - currentRotation + 360) % 360;

    canvasStore.updateShape(selectedShape.value.id, {
        [key]: currentScale * -1,
        rotation:
            selectedShape.value.type === 'line' ? currentRotation : newRotation,
    });
}

type ColorFieldKey = 'fill' | 'stroke';

function onColorChange(key: ColorFieldKey, event: Event) {
    if (!selectedShape.value) return;
    const target = event.target as HTMLInputElement;
    const value = target.value;

    canvasStore.updateShape(selectedShape.value.id, {
        [key]: value,
    } as Partial<Shape>);
}

type OpacityFieldKey = 'fillOpacity' | 'strokeOpacity';

function onOpacityChange(key: OpacityFieldKey, event: Event) {
    if (!selectedShape.value) return;
    const target = event.target as HTMLInputElement;
    const value = Number(target.value);
    if (Number.isNaN(value)) return;

    canvasStore.updateShape(selectedShape.value.id, {
        [key]: value,
    } as Partial<Shape>);
}

function shapeThumb(type: string) {
    if (type === 'rect') return '▭';
    if (type === 'circle') return '◯';
    if (type === 'line') return '/';
    return '?';
}

function shapeLabel(type: string) {
    if (type === 'rect') return 'Прямоугольник';
    if (type === 'circle') return 'Круг';
    if (type === 'line') return 'Линия';
    return type;
}

function onSelectLayer(id: string) {
    canvasStore.selectShape(id);
}

function onLayerDragStart(index: number, event: DragEvent) {
    draggedLayerIndex.value = index;
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
    }
}

function onLayerDrop(targetIndex: number, event: DragEvent) {
    let from = draggedLayerIndex.value;
    if (event.dataTransfer) {
        const raw = event.dataTransfer.getData('text/plain');
        const n = Number.parseInt(raw, 10);
        if (!Number.isNaN(n)) {
            from = n;
        }
    }
    if (from === null) return;
    const to = targetIndex;
    draggedLayerIndex.value = null;
    if (from === to) return;
    canvasStore.moveShape(from, to);
}
</script>

<style scoped>
.panel {
    width: 240px;
    max-width: 240px;
    min-width: 240px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);

    padding: 12px;

    max-height: 55vh;
    overflow: auto;
}

.panel {
    scrollbar-gutter: stable;
}

.groupTitle {
    font-weight: 800;
    font-size: 16px;
    margin: 0 0 4px;
    color: #111827;
}

.group {
    display: grid;
    gap: 6px;
}

.divider {
    height: 1px;
    background: #e5e7eb;
    margin: 8px 0;
}

.fieldBlock {
    display: grid;
    gap: 4px;
}

.fieldLabel {
    font-size: 12px;
    color: #374151;
}

.grid1 {
    display: grid;
    grid-template-columns: 1fr;
}

.grid2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
}

.grid2Blocks {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
}

.fieldStub {
    height: 16px;
    border-radius: 8px;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
}

.fieldInput {
    width: 100%;
    height: 24px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    padding: 0 6px;
    font-size: 12px;
    color: #111827;
    background: #ffffff;
}

.fieldInput:disabled {
    background: #f9fafb;
    color: #9ca3af;
}

.colorInput {
    width: 100%;
    height: 24px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    padding: 0;
    background: #ffffff;
}

.layersRow {
    display: flex;
    gap: 10px;
    margin-top: 4px;
}

.iconBtn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    cursor: pointer;
}

.iconBtn:hover {
    background: #f3f4f6;
}

.spacer {
    height: 20px;
}

.layersList {
    list-style: none;
    padding: 0;
    margin: 0;

    display: grid;
    gap: 6px;
}

.layerItem {
    width: 100%;
    display: grid;
    grid-template-columns: 20px 1fr;
    align-items: center;
    gap: 10px;

    padding: 6px 8px;
    border-radius: 10px;

    background: #ffffff;
    border: 1px solid transparent;
    cursor: pointer;

    text-align: left;
    color: #111827;
}

.layerItem:hover {
    background: #f3f4f6;
}

.layerItem:focus {
    outline: none;
}

.layerItem:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.55);
    outline-offset: 2px;
    border-radius: 10px;
}

.layerItem.isActive {
    background: rgba(37, 99, 235, 0.12);
    border-color: rgba(37, 99, 235, 0.3);
}

.thumb {
    width: 20px;
    height: 20px;
    border-radius: 6px;

    display: grid;
    place-items: center;

    background: #ffffff;
    border: 1px solid #e5e7eb;

    font-size: 12px;
    font-weight: 700;
    color: #374151;

    user-select: none;
}

.layerName {
    font-size: 12px;
    font-weight: 500;
    color: #111827;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.iconBtnSmall {
    width: 100%;
    height: 24px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 14px;
    color: #374151;
    transition: all 0.2s;
}

.iconBtnSmall:hover:not(:disabled) {
    background: #f3f4f6;
    border-color: #d1d5db;
}

.iconBtnSmall:active:not(:disabled) {
    background: #e5e7eb;
    transform: translateY(1px);
}

.iconBtnSmall:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #f9fafb;
}
</style>
