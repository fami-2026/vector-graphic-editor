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
                        @blur="onNumberChange('x', $event)"
                        @keydown.enter.prevent="onNumberEnter('x', $event)"
                        @wheel.prevent="onWheelChange('x', $event)"
                    />
                    <input
                        class="fieldInput"
                        type="number"
                        aria-label="Y"
                        :value="selectedShape?.y ?? ''"
                        :disabled="!selectedShape"
                        @blur="onNumberChange('y', $event)"
                        @keydown.enter.prevent="onNumberEnter('y', $event)"
                        @wheel.prevent="onWheelChange('y', $event)"
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
                            @blur="onNumberChange('width', $event)"
                            @keydown.enter.prevent="
                                onNumberEnter('width', $event)
                            "
                            @wheel.prevent="onWheelChange('width', $event)"
                        />
                        <input
                            class="fieldInput"
                            type="number"
                            aria-label="Height"
                            :value="shapeHeight"
                            :disabled="!selectedShape"
                            min="1"
                            @blur="onNumberChange('height', $event)"
                            @keydown.enter.prevent="
                                onNumberEnter('height', $event)
                            "
                            @wheel.prevent="onWheelChange('height', $event)"
                        />
                    </div>
                </div>
            </div>
        </section>

        <!-- Отражение -->
        <div class="fieldBlock">
            <div class="fieldLabel">Отражение</div>
            <div class="grid2">
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
                        @blur="onNumberChange('rotation', $event)"
                        @keydown.enter.prevent="
                            onNumberEnter('rotation', $event)
                        "
                        @wheel.prevent="onWheelChange('rotation', $event)"
                    />
                    <div class="spacer" aria-hidden="true" />
                </div>
            </div>
        </div>

        <div class="divider" />

        <!-- Фигура -->
        <section class="group">
            <h3 class="groupTitle">Фигура</h3>

            <div
                class="grid2Blocks"
                :style="{
                    opacity: isFillDisabled ? 0.55 : 1,
                }"
            >
                <div class="fieldBlock">
                    <div class="fieldLabel">Цвет заливки</div>
                    <div class="grid1">
                        <div class="colorInputWrapper">
                            <div
                                class="colorPreview"
                                :style="{
                                    backgroundColor: fillColor,
                                    opacity: isFillDisabled ? 0.35 : 1,
                                    cursor: isFillDisabled
                                        ? 'not-allowed'
                                        : 'pointer',
                                }"
                                :class="{
                                    disabled: !selectedShape || isFillDisabled,
                                }"
                                @click="
                                    !isFillDisabled && showColorPicker('fill')
                                "
                            />
                            <Teleport to="body">
                                <div
                                    v-if="activePicker === 'fill'"
                                    class="floatingColorPicker"
                                    :style="pickerPosition"
                                >
                                    <input
                                        ref="fillColorInputRef"
                                        type="color"
                                        :value="fillColor"
                                        @input="onColorChange('fill', $event)"
                                        @blur="activePicker = null"
                                    />
                                </div>
                            </Teleport>
                        </div>
                    </div>
                </div>

                <div class="fieldBlock">
                    <div class="fieldLabel">Непрозрачность</div>
                    <div class="opacityControl">
                        <input
                            class="opacitySlider"
                            type="range"
                            aria-label="Fill opacity"
                            min="0"
                            max="1"
                            step="0.05"
                            :value="fillOpacity"
                            :disabled="!selectedShape || isFillDisabled"
                            @input="onOpacityChange('fillOpacity', $event)"
                        />
                        <button
                            class="smallToggleBtn"
                            type="button"
                            :class="{
                                isActive: isNoColorActive('fillOpacity'),
                            }"
                            :disabled="!selectedShape || isFillDisabled"
                            @click="setNoColor('fillOpacity')"
                        >
                            нет цвета
                        </button>
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
                        <div class="colorInputWrapper">
                            <div
                                class="colorPreview"
                                :style="{ backgroundColor: strokeColor }"
                                :class="{
                                    disabled:
                                        !selectedShape && !isPencilToolMode,
                                }"
                                @click="showColorPicker('stroke')"
                            />

                            <Teleport to="body">
                                <div
                                    v-if="activePicker === 'stroke'"
                                    class="floatingColorPicker"
                                    :style="pickerPosition"
                                >
                                    <input
                                        ref="strokeColorInputRef"
                                        type="color"
                                        :value="strokeColor"
                                        @input="onColorChange('stroke', $event)"
                                        @blur="activePicker = null"
                                    />
                                </div>
                            </Teleport>
                        </div>
                    </div>
                </div>

                <div class="fieldBlock">
                    <div class="fieldLabel">Непрозрачность</div>
                    <div class="opacityControl">
                        <input
                            class="opacitySlider"
                            type="range"
                            aria-label="Stroke opacity"
                            min="0"
                            max="1"
                            step="0.05"
                            :value="strokeOpacity"
                            :disabled="!selectedShape && !isPencilToolMode"
                            @input="onOpacityChange('strokeOpacity', $event)"
                        />
                        <button
                            class="smallToggleBtn"
                            type="button"
                            :class="{
                                isActive: isNoColorActive('strokeOpacity'),
                            }"
                            :disabled="!selectedShape"
                            @click="setNoColor('strokeOpacity')"
                        >
                            нет цвета
                        </button>
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
                        :disabled="!selectedShape && !isPencilToolMode"
                        min="0"
                        :max="MAX_STROKE_WIDTH"
                        step="0.5"
                        @blur="onNumberChange('strokeWidth', $event)"
                        @keydown.enter.prevent="
                            onNumberEnter('strokeWidth', $event)
                        "
                        @wheel.prevent="onWheelChange('strokeWidth', $event)"
                    />
                    <div class="spacer" aria-hidden="true" />
                </div>
            </div>
        </section>

        <div class="divider" />

        <!-- Фон холста -->
        <section class="group">
            <h3 class="groupTitle">Фон холста</h3>

            <div class="grid2Blocks">
                <div class="fieldBlock">
                    <div class="fieldLabel">Цвет фона</div>
                    <div class="grid1">
                        <div class="colorInputWrapper">
                            <div
                                class="colorPreview"
                                :style="{
                                    backgroundColor: canvasBackgroundColor,
                                }"
                                @click="showCanvasColorPicker"
                            />

                            <Teleport to="body">
                                <div
                                    v-if="activeCanvasPicker"
                                    class="floatingColorPicker"
                                    :style="pickerPosition"
                                >
                                    <input
                                        ref="canvasColorInputRef"
                                        type="color"
                                        :value="canvasBackgroundColor"
                                        @input="onCanvasColorChange"
                                        @blur="activeCanvasPicker = false"
                                    />
                                </div>
                            </Teleport>
                        </div>
                    </div>
                </div>

                <div class="fieldBlock buttonBlock">
                    <button
                        class="smallToggleBtn"
                        @click="resetCanvasBackground"
                    >
                        Нет цвета
                    </button>
                </div>
            </div>
        </section>

        <div class="divider" />

        <!-- Слои -->
        <section class="group">
            <div class="layersHeader">
                <h3 class="groupTitle">Слои</h3>
                <div class="layerControls">
                    <button
                        class="iconBtnSmall"
                        @click="moveLayerUp"
                        :disabled="!selectedShape || !canMoveUp"
                        :title="'Переместить вверх'"
                        aria-label="Переместить слой вверх"
                    >
                        <span aria-hidden="true">↑</span>
                    </button>
                    <button
                        class="iconBtnSmall"
                        @click="moveLayerDown"
                        :disabled="!selectedShape || !canMoveDown"
                        :title="'Переместить вниз'"
                        aria-label="Переместить слой вниз"
                    >
                        <span aria-hidden="true">↓</span>
                    </button>
                </div>
            </div>

            <ul class="layersList" role="listbox" aria-label="Layers">
                <li
                    v-for="(shape, index) in layers"
                    :key="shape.id"
                    draggable="true"
                    @dragstart="onLayerDragStart(index, $event)"
                    @dragover.prevent
                    @drop="onLayerDrop(index, $event)"
                >
                    <div
                        class="layerItem"
                        :class="{ isActive: shape.id === selectedShape?.id }"
                        @click="onSelectLayer(shape.id)"
                    >
                        <span class="thumb" aria-hidden="true">
                            <svg class="thumbSvg" viewBox="0 0 20 20">
                                <!-- Прямоугольник -->
                                <rect
                                    v-if="shape.type === 'rect'"
                                    x="2"
                                    y="4"
                                    width="16"
                                    height="12"
                                    rx="1"
                                    :fill="thumbFill(shape)"
                                    :fill-opacity="thumbFillOpacity(shape)"
                                    :stroke="thumbStroke(shape)"
                                    stroke-width="1.5"
                                />
                                <!-- Круг / эллипс -->
                                <ellipse
                                    v-else-if="shape.type === 'circle'"
                                    cx="10"
                                    cy="10"
                                    rx="8"
                                    ry="7"
                                    :fill="thumbFill(shape)"
                                    :fill-opacity="thumbFillOpacity(shape)"
                                    :stroke="thumbStroke(shape)"
                                    stroke-width="1.5"
                                />
                                <!-- Линия -->
                                <line
                                    v-else-if="shape.type === 'line'"
                                    x1="3"
                                    y1="17"
                                    x2="17"
                                    y2="3"
                                    :stroke="thumbStroke(shape)"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                />
                                <polyline
                                    v-else-if="shape.type === 'pencil'"
                                    points="2,13 6,9 9,12 13,6 18,10"
                                    fill="none"
                                    :stroke="thumbStroke(shape)"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                                <!-- Все остальные полигональные фигуры -->
                                <polygon
                                    v-else
                                    :points="getThumbPoints(shape)"
                                    :fill="thumbFill(shape)"
                                    :fill-opacity="thumbFillOpacity(shape)"
                                    :stroke="thumbStroke(shape)"
                                    stroke-width="1.5"
                                    stroke-linejoin="round"
                                />
                            </svg>
                        </span>

                        <!-- Режим редактирования -->
                        <input
                            v-if="editingLayerId === shape.id"
                            :ref="
                                (el) =>
                                    setInputRef(
                                        el as HTMLInputElement | null,
                                        shape.id
                                    )
                            "
                            class="layerNameInput"
                            type="text"
                            v-model="editingLayerName"
                            @click.stop
                            @dblclick.stop
                            @blur="onLayerNameBlur(shape.id)"
                            @keyup.enter="onLayerNameEnter(shape.id)"
                            @keyup.escape="cancelEditing"
                        />

                        <!-- Обычный режим -->
                        <span
                            v-else
                            class="layerName"
                            @dblclick.stop="startEditing(shape.id)"
                        >
                            {{ getShapeDisplayName(shape) }}
                        </span>

                        <!--Кнопка удаления-->
                        <button
                            class="deleteLayerBtn"
                            type="button"
                            title="Удалить слой"
                            aria-label="Удалить слой"
                            @click.stop="deleteLayer(shape.id)"
                        >
                            ×
                        </button>
                    </div>
                </li>
            </ul>
        </section>
    </aside>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useCanvasStore } from '@/stores/canvas';
import type { Shape } from '@/canvas/types';
import { useToolsStore } from '@/stores/tools';

interface ShapeWithName extends Shape {
    name?: string;
}

const editingLayerName = ref('');
const isSaving = ref(false);
const forceUpdate = ref(0);
const isFillDisabled = computed(() => selectedShape.value?.type === 'pencil');

function getShapeDisplayName(shape: Shape) {
    const shapeWithName = shape as ShapeWithName;
    if (shapeWithName.name && shapeWithName.name.trim()) {
        return shapeWithName.name;
    }

    return shapeLabel(shape.type);
}

const activePicker = ref<'fill' | 'stroke' | null>(null);
const pickerPosition = ref<{
    top: string;
    left: string;
    position: 'absolute' | 'fixed' | 'relative';
    zIndex?: number;
}>({
    top: '0px',
    left: '0px',
    position: 'absolute',
    zIndex: 9999,
});
const fillColorInputRef = ref<HTMLInputElement | null>(null);
const strokeColorInputRef = ref<HTMLInputElement | null>(null);

function showColorPicker(type: 'fill' | 'stroke') {
    if (
        !selectedShape.value &&
        !(isPencilToolMode.value && type === 'stroke')
    ) {
        return;
    }

    const previewElement = event?.currentTarget as HTMLElement;

    if (previewElement) {
        const rect = previewElement.getBoundingClientRect();

        pickerPosition.value = {
            position: 'absolute',
            top: rect.bottom + window.scrollY - 35 + 'px',
            left: rect.left + window.scrollX - 250 + 'px',
            zIndex: 9999,
        };

        activePicker.value = type;

        nextTick(() => {
            const inputRef =
                type === 'fill' ? fillColorInputRef : strokeColorInputRef;
            if (inputRef.value) {
                inputRef.value.focus();
                inputRef.value.click();
            }
        });
    }
}

function onLayerNameBlur(shapeId: string) {
    if (isSaving.value) return;

    saveLayerName(shapeId, editingLayerName.value);
}

function onLayerNameEnter(shapeId: string) {
    isSaving.value = true;

    saveLayerName(shapeId, editingLayerName.value);

    setTimeout(() => {
        isSaving.value = false;
    }, 200);
}

function handleClickOutside(event: MouseEvent) {
    if (activePicker.value) {
        const target = event.target as HTMLElement;
        const isClickOnPreview = target.classList.contains('colorPreview');
        const isClickInPicker = target.closest('.floatingColorPicker');

        if (!isClickInPicker && !isClickOnPreview) {
            activePicker.value = null;
        }
    }

    if (activeCanvasPicker.value) {
        const target = event.target as HTMLElement;
        const isClickOnPreview = target.classList.contains('colorPreview');
        const isClickInPicker = target.closest('.floatingColorPicker');

        if (!isClickInPicker && !isClickOnPreview) {
            activeCanvasPicker.value = false;
        }
    }
}
onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('mousedown', commitAfterClick, true);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('mousedown', commitAfterClick, true);
});

const canvasStore = useCanvasStore();
const { selectedShape, shapes } = storeToRefs(canvasStore);

const editingLayerId = ref<string | null>(null);
const inputRefs = ref<Record<string, HTMLInputElement>>({});

const toolsStore = useToolsStore();

const MAX_STROKE_WIDTH = 5;

const setInputRef = (el: HTMLInputElement | null, shapeId: string) => {
    if (el) {
        inputRefs.value[shapeId] = el;
    }
};

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

const isPencilToolMode = computed(() => {
    return toolsStore.activeTool === 'pencil' && !selectedShape.value;
});

const shapeWidth = computed(() => getShapeNumberProp('width', ''));
const shapeHeight = computed(() => getShapeNumberProp('height', ''));
const fillColor = computed(() => getShapeStringProp('fill', '#000000'));
const strokeColor = computed(() => {
    if (isPencilToolMode.value) {
        return toolsStore.pencilDefaults.stroke;
    }
    return getShapeStringProp('stroke', '#000000');
});
const fillOpacity = computed(() => getShapeNumberProp('fillOpacity', 1));
const strokeOpacity = computed(() => {
    if (isPencilToolMode.value) {
        return toolsStore.pencilDefaults.strokeOpacity;
    }
    return getShapeNumberProp('strokeOpacity', 1);
});
const strokeWidth = computed(() => {
    if (isPencilToolMode.value) {
        return toolsStore.pencilDefaults.strokeWidth;
    }
    return getShapeNumberProp('strokeWidth', '');
});

const layers = computed(() => [...shapes.value].reverse());

function layerIndexToShapeIndex(layerIndex: number) {
    return shapes.value.length - 1 - layerIndex;
}

const draggedLayerIndex = ref<number | null>(null);

const wheelStepConfig: Record<NumberFieldKey, number> = {
    x: 1,
    y: 1,
    width: 1,
    height: 1,
    rotation: 5,
    strokeWidth: 0.5,
    scaleX: 0.1,
    scaleY: 0.1,
};

type NumberFieldKey =
    | 'x'
    | 'y'
    | 'width'
    | 'height'
    | 'rotation'
    | 'strokeWidth'
    | 'scaleX'
    | 'scaleY';

function getCurrentNumberValue(key: NumberFieldKey): number | null {
    if (!selectedShape.value) return null;
    const value = (selectedShape.value as unknown as Record<string, unknown>)[
        key
    ];
    return typeof value === 'number' ? value : null;
}

function normalizeNumberByKey(key: NumberFieldKey, value: number) {
    if (key === 'width' || key === 'height') {
        return Math.max(1, value);
    }
    if (key === 'strokeWidth') {
        return Math.min(MAX_STROKE_WIDTH, Math.max(0, value));
    }
    if (key === 'rotation') {
        return ((value % 360) + 360) % 360;
    }
    return value;
}

function applyNumberValue(key: NumberFieldKey, target: HTMLInputElement) {
    const raw = target.value.trim();
    if (raw === '') {
        const currentValue = getCurrentNumberValue(key);
        target.value = currentValue === null ? '' : String(currentValue);
        return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
        if (selectedShape.value) {
            const currentValue = getCurrentNumberValue(key);
            target.value = currentValue === null ? '' : String(currentValue);
        }
        return;
    }

    const normalized =
        Math.round(normalizeNumberByKey(key, parsed) * 100) / 100;
    target.value = String(normalized);
    const currentValue = getCurrentNumberValue(key);

    if (currentValue !== null && normalized === currentValue) {
        return;
    }

    if (isPencilToolMode.value && key === 'strokeWidth') {
        toolsStore.setPencilDefaults({ strokeWidth: normalized });
        return;
    }

    if (!selectedShape.value) return;

    canvasStore.updateShape(selectedShape.value.id, {
        [key]: normalized,
    } as Partial<Shape>);
}

function onNumberChange(key: NumberFieldKey, event: Event) {
    const target = event.target as HTMLInputElement;
    applyNumberValue(key, target);
}

function onNumberEnter(key: NumberFieldKey, event: KeyboardEvent) {
    onNumberChange(key, event);
    const target = event.target as HTMLInputElement | null;
    target?.blur();
}

function commitAfterClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.panel')) return;

    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLInputElement)) return;
    if (activeElement.type !== 'number') return;
    if (!activeElement.closest('.panel')) return;

    const keyMap: Record<string, NumberFieldKey> = {
        X: 'x',
        Y: 'y',
        Width: 'width',
        Height: 'height',
        Rotation: 'rotation',
        'Stroke width': 'strokeWidth',
    };
    const ariaLabel = activeElement.getAttribute('aria-label') ?? '';
    const key = keyMap[ariaLabel];
    if (!key) return;

    applyNumberValue(key, activeElement);
}

function onWheelChange(key: NumberFieldKey, event: WheelEvent) {
    event.preventDefault();

    if (isPencilToolMode.value && key === 'strokeWidth') {
        const step = wheelStepConfig[key];
        const delta = event.deltaY > 0 ? -step : step;
        const currentValue = toolsStore.pencilDefaults.strokeWidth;
        const newValue = Math.min(
            MAX_STROKE_WIDTH,
            Math.max(0, currentValue + delta)
        );

        toolsStore.setPencilDefaults({
            strokeWidth: Math.round(newValue * 100) / 100,
        });
        return;
    }

    if (!selectedShape.value) return;

    const step = wheelStepConfig[key];
    const delta = event.deltaY > 0 ? -step : step;
    const currentValue =
        (selectedShape.value as unknown as Record<string, number>)[key] || 0;
    let newValue = currentValue + delta;

    if (key === 'width' || key === 'height') {
        newValue = Math.max(1, newValue);
    }
    if (key === 'rotation') {
        newValue = ((newValue % 360) + 360) % 360;
    }
    if (key === 'strokeWidth') {
        newValue = Math.min(MAX_STROKE_WIDTH, Math.max(1, newValue));
    }

    canvasStore.updateShape(selectedShape.value.id, {
        [key]: Math.round(newValue * 100) / 100,
    } as Partial<Shape>);
}

function onFlip(key: 'scaleX' | 'scaleY') {
    const shapesToFlip =
        canvasStore.selectedIds.length === 1 && selectedShape.value
            ? [selectedShape.value]
            : canvasStore.selectedShapes;

    if (!shapesToFlip || shapesToFlip.length === 0) return;

    let flipCenterX = 0;
    let flipCenterY = 0;

    if (canvasStore.selectionRect) {
        flipCenterX =
            (canvasStore.selectionRect.start.x +
                canvasStore.selectionRect.end.x) /
            2;
        flipCenterY =
            (canvasStore.selectionRect.start.y +
                canvasStore.selectionRect.end.y) /
            2;
    } else {
        const targetShape = shapesToFlip[0];
        if (!targetShape) return;

        const box = targetShape.getBoundingBox();
        flipCenterX = (box.minX + box.maxX) / 2;
        flipCenterY = (box.minY + box.maxY) / 2;
    }

    shapesToFlip.forEach((shape) => {
        const currentScaleX = shape.scaleX;
        const currentScaleY = shape.scaleY;
        const currentRotation = shape.rotation;
        const isLine = shape.type === 'line';

        let newScaleX = currentScaleX;
        let newScaleY = currentScaleY;
        let newRotation = currentRotation;

        if (key === 'scaleX') {
            if (isLine) {
                newScaleX = currentScaleX * -1;
            } else {
                newScaleX = currentScaleX * -1;
                newRotation = (360 - currentRotation) % 360;
            }
        } else {
            if (isLine) {
                newScaleY = currentScaleY * -1;
            } else {
                newScaleX = currentScaleX * -1;
                newRotation = (180 - currentRotation + 360) % 360;
            }
        }

        const newPosX =
            key === 'scaleX'
                ? flipCenterX - (shape.position.x - flipCenterX)
                : shape.position.x;

        const newPosY =
            key === 'scaleY'
                ? flipCenterY - (shape.position.y - flipCenterY)
                : shape.position.y;

        canvasStore.updateShape(shape.id, {
            scaleX: newScaleX,
            scaleY: newScaleY,
            rotation: newRotation,
            position: { x: newPosX, y: newPosY },
        });
    });
}

type ColorFieldKey = 'fill' | 'stroke';

function onColorChange(key: ColorFieldKey, event: Event) {
    // if (!selectedShape.value) return;
    const target = event.target as HTMLInputElement;
    const value = target.value;

    if (isPencilToolMode.value && key === 'stroke') {
        toolsStore.setPencilDefaults({ stroke: value });
        return;
    }

    if (!selectedShape.value) return;

    canvasStore.updateShape(selectedShape.value.id, {
        [key]: value,
    } as Partial<Shape>);
}

type OpacityFieldKey = 'fillOpacity' | 'strokeOpacity';

const OPACITY_EPSILON = 0.0001;

function normalizeOpacity(value: number) {
    if (value <= OPACITY_EPSILON) return 0;
    if (value >= 1 - OPACITY_EPSILON) return 1;
    return Math.min(1, Math.max(0, value));
}

function onOpacityChange(key: OpacityFieldKey, event: Event) {
    // if (!selectedShape.value) return;
    const target = event.target as HTMLInputElement;
    const value = normalizeOpacity(Number(target.value));
    if (Number.isNaN(value)) return;

    if (isPencilToolMode.value && key === 'strokeOpacity') {
        toolsStore.setPencilDefaults({ strokeOpacity: value });
        return;
    }

    if (!selectedShape.value) return;

    canvasStore.updateShape(selectedShape.value.id, {
        [key]: value,
    } as Partial<Shape>);
}

// ============ МИНИАТЮРЫ СЛОЁВ (SVG) ============

function thumbFill(shape: Shape): string {
    const fill = (shape as unknown as Record<string, unknown>).fill as
        | string
        | undefined;
    if (!fill || fill === 'transparent') return 'transparent';
    return fill;
}

function thumbFillOpacity(shape: Shape): number {
    const fill = (shape as unknown as Record<string, unknown>).fill as
        | string
        | undefined;
    if (!fill || fill === 'transparent') return 0;

    const opacity = (shape as unknown as Record<string, unknown>)
        .fillOpacity as number | undefined;
    return typeof opacity === 'number' ? Math.max(0, Math.min(1, opacity)) : 1;
}

function thumbStroke(shape: Shape): string {
    const stroke = (shape as unknown as Record<string, unknown>).stroke as
        | string
        | undefined;
    if (!stroke || stroke === 'transparent') return '#6b7280';
    return stroke;
}

function generatePolygonPoints(
    sides: number,
    cx: number,
    cy: number,
    r: number
): string {
    const pts: string[] = [];
    for (let i = 0; i < sides; i++) {
        const a = (i * 2 * Math.PI) / sides - Math.PI / 2;
        const x = Math.round((cx + r * Math.cos(a)) * 10) / 10;
        const y = Math.round((cy + r * Math.sin(a)) * 10) / 10;
        pts.push(`${x},${y}`);
    }
    return pts.join(' ');
}

function generateStarPoints(
    numPoints: number,
    cx: number,
    cy: number,
    outerR: number,
    innerR: number
): string {
    const pts: string[] = [];
    for (let i = 0; i < numPoints * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (i * Math.PI) / numPoints - Math.PI / 2;
        const x = Math.round((cx + r * Math.cos(a)) * 10) / 10;
        const y = Math.round((cy + r * Math.sin(a)) * 10) / 10;
        pts.push(`${x},${y}`);
    }
    return pts.join(' ');
}

function getThumbPoints(shape: Shape): string {
    const type = shape.type;
    switch (type) {
        case 'triangle':
            return '10,3 2,17 18,17';
        case 'polygon': {
            const sides =
                ((shape as unknown as Record<string, unknown>)
                    .sides as number) || 5;
            return generatePolygonPoints(sides, 10, 10, 8);
        }
        case 'star': {
            const numPoints =
                ((shape as unknown as Record<string, unknown>)
                    .numPoints as number) || 5;
            return generateStarPoints(numPoints, 10, 10, 8, 4);
        }
        case 'hexagon':
            return generatePolygonPoints(6, 10, 10, 8);
        case 'arrow':
            return '1,8 12,8 12,3 19,10 12,17 12,12 1,12';
        default:
            return generatePolygonPoints(5, 10, 10, 8);
    }
}

function isNoColorActive(key: OpacityFieldKey) {
    const opacity =
        key === 'fillOpacity' ? fillOpacity.value : strokeOpacity.value;
    return typeof opacity === 'number' && normalizeOpacity(opacity) === 0;
}

function setNoColor(key: OpacityFieldKey) {
    const currentOpacity =
        key === 'fillOpacity' ? fillOpacity.value : strokeOpacity.value;
    const isCurrentlyNoColor =
        typeof currentOpacity === 'number' &&
        normalizeOpacity(currentOpacity) === 0;

    const nextValue = isCurrentlyNoColor ? 1 : 0;

    if (isPencilToolMode.value && key === 'strokeOpacity') {
        toolsStore.setPencilDefaults({ strokeOpacity: nextValue });
        return;
    }

    if (!selectedShape.value) return;

    canvasStore.updateShape(selectedShape.value.id, {
        [key]: nextValue,
    } as Partial<Shape>);
}

function shapeLabel(type: string) {
    const labels: Record<string, string> = {
        rect: 'Прямоугольник',
        circle: 'Круг',
        line: 'Линия',
        triangle: 'Треугольник',
        polygon: 'Многоугольник',
        star: 'Звезда',
        arrow: 'Стрелка',
        hexagon: 'Шестиугольник',
        pencil: 'Карандаш',
    };
    return labels[type] ?? type;
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
    const fromShapeIndex = layerIndexToShapeIndex(from);
    const toShapeIndex = layerIndexToShapeIndex(to);
    canvasStore.moveShape(fromShapeIndex, toShapeIndex);
}

const selectedLayerIndex = computed(() => {
    if (!selectedShape.value) return -1;
    return layers.value.findIndex((s) => s.id === selectedShape.value?.id);
});

const canMoveUp = computed(() => {
    if (!selectedShape.value) return false;
    return selectedLayerIndex.value > 0;
});

const canMoveDown = computed(() => {
    if (!selectedShape.value) return false;
    return selectedLayerIndex.value < layers.value.length - 1;
});

function moveLayerUp() {
    if (!canMoveUp.value) return;
    const fromLayerIndex = selectedLayerIndex.value;
    const toLayerIndex = fromLayerIndex - 1;
    canvasStore.moveShape(
        layerIndexToShapeIndex(fromLayerIndex),
        layerIndexToShapeIndex(toLayerIndex)
    );
}

function moveLayerDown() {
    if (!canMoveDown.value) return;
    const fromLayerIndex = selectedLayerIndex.value;
    const toLayerIndex = fromLayerIndex + 1;
    canvasStore.moveShape(
        layerIndexToShapeIndex(fromLayerIndex),
        layerIndexToShapeIndex(toLayerIndex)
    );
}

function startEditing(shapeId: string) {
    console.log('DOUBLE CLICK WORKS', shapeId);
    editingLayerId.value = shapeId;

    const shape = shapes.value.find((s) => s.id === shapeId) as ShapeWithName;
    if (shape) {
        editingLayerName.value = shape.name || shapeLabel(shape.type);
    }

    nextTick(() => {
        const input = inputRefs.value[shapeId];
        if (input) {
            input.focus();
            input.select();
        }
    });
}

function cancelEditing() {
    editingLayerId.value = null;
}

function saveLayerName(shapeId: string, newName: string) {
    if (!newName.trim()) {
        cancelEditing();
        return;
    }

    const shape = shapes.value.find((s) => s.id === shapeId);
    if (shape) {
        canvasStore.updateShape(shapeId, {
            name: newName.trim(),
        } as Partial<Shape>);
        forceUpdate.value++;
    }

    cancelEditing();
}

//Функции для удаления слоя
function deleteLayer(id: string) {
    if (editingLayerId.value === id) {
        cancelEditing();
    }

    canvasStore.deleteShape(id);
}

function handleKeyDown(event: KeyboardEvent) {
    if (editingLayerId.value) return;

    if (event.key === 'Delete') {
        if (!selectedShape.value) return;

        canvasStore.deleteShape(selectedShape.value.id);
    }
}

watch([selectedShape, shapes], () => {
    forceUpdate.value++;
});

onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
});

const activeCanvasPicker = ref(false);
const canvasColorInputRef = ref<HTMLInputElement | null>(null);
const canvasBackgroundColor = computed(() => {
    return canvasStore.backgroundColor || '#ffffff';
});

// Функция показа пикера для фона холста
function showCanvasColorPicker() {
    const previewElement = event?.currentTarget as HTMLElement;

    if (previewElement) {
        const rect = previewElement.getBoundingClientRect();

        pickerPosition.value = {
            position: 'absolute',
            top: rect.bottom + window.scrollY - 35 + 'px',
            left: rect.left + window.scrollX - 250 + 'px',
            zIndex: 9999,
        };

        activeCanvasPicker.value = true;

        nextTick(() => {
            if (canvasColorInputRef.value) {
                canvasColorInputRef.value.focus();
                canvasColorInputRef.value.click();
            }
        });
    }
}

// Функция изменения цвета фона холста
function onCanvasColorChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value;

    canvasStore.setBackgroundColor(value);
}

// Функция сброса цвета фона
function resetCanvasBackground() {
    canvasStore.setBackgroundColor('#ffffff');
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

.opacityControl {
    display: grid;
    gap: 6px;
}

.opacitySlider {
    width: 100%;
    height: 24px;
    margin: 0;
    padding: 0;
    accent-color: #2563eb;
    cursor: pointer;
}

.opacitySlider:disabled {
    cursor: default;
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
    grid-template-columns: 20px 1fr 20px;
    align-items: center;
    gap: 8px;

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
    width: 24px;
    height: 24px;
    border-radius: 6px;

    display: grid;
    place-items: center;

    background: #ffffff;
    border: 1px solid #e5e7eb;

    user-select: none;
    flex-shrink: 0;
}

.thumbSvg {
    width: 18px;
    height: 18px;
    display: block;
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

.smallToggleBtn {
    height: 24px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    color: #374151;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    transition: all 0.2s;
}

.smallToggleBtn:hover:not(:disabled) {
    background: #f3f4f6;
    border-color: #d1d5db;
}

.smallToggleBtn.isActive {
    background: rgba(37, 99, 235, 0.12);
    border-color: rgba(37, 99, 235, 0.35);
    color: #1d4ed8;
}

.smallToggleBtn:disabled {
    background: #f9fafb;
    color: #9ca3af;
    cursor: default;
}

.iconBtnSmall:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #f9fafb;
}

.layersHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    padding-right: 4px;
}

.layerControls {
    display: flex;
    gap: 4px;
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

/* Стили для инпута редактирования имени */
.layerNameInput {
    font-size: 12px;
    font-weight: 500;
    color: #111827;
    background: #ffffff;
    border: 1px solid #2563eb;
    border-radius: 4px;
    padding: 2px 4px;
    margin: -2px 0;
    width: 100%;
    outline: none;
    font-family: inherit;
}

.layerNameInput:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
}

/*Стиль для крестика для удаления слоев */
.deleteLayerBtn {
    width: 20px;
    height: 20px;
    border: 0;
    background: transparent;
    color: #9ca3af;
    border-radius: 6px;
    cursor: pointer;

    display: flex;
    align-items: center;
    justify-content: center;

    font-size: 14px;
    line-height: 1;

    opacity: 0;
    pointer-events: none;
    transition:
        opacity 0.15s ease,
        background 0.15s ease,
        color 0.15s ease;
}

.layerItem:hover .deleteLayerBtn,
.layerItem:focus-within .deleteLayerBtn {
    opacity: 1;
    pointer-events: auto;
}

.deleteLayerBtn:hover {
    background: #fee2e2;
    color: #dc2626;
}

/* Добавьте в конец style scoped */
.colorInputWrapper {
    width: 100%;
    position: relative;
}

.colorPreview {
    width: 100%;
    height: 32px;
    border-radius: 8px;
    border: 2px solid #e5e7eb;
    background: #ffffff;
    cursor: pointer;
    transition: all 0.2s;
    box-sizing: border-box;
}

.colorPreview:not(.disabled):hover {
    border-color: #2563eb;
    transform: scale(1.02);
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
}

.colorPreview.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #f3f4f6;
}

.floatingColorPicker {
    position: absolute;
    z-index: 9999;
    animation: fadeIn 0.2s ease;
}

.floatingColorPicker input[type='color'] {
    width: 1px;
    height: 1px;
    border: none;
    border-radius: 0px;
    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    padding: 0;
    background: white;
}

.floatingColorPicker input[type='color']::-webkit-color-swatch-wrapper {
    padding: 8px;
}

.floatingColorPicker input[type='color']::-webkit-color-swatch {
    border: 2px solid #e5e7eb;
    border-radius: 8px;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.buttonBlock {
    margin-top: 22px;
}
</style>
