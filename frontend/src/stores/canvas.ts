import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { Shape, Point } from '@/canvas/types';
import { shapeRegistry } from '@/canvas/types';
import { generateId } from '@/canvas/utils/math';
import { PolygonShape } from '@/canvas/types/polygon/polygon';
import {
    createCanvas,
    getCanvasById,
    updateCanvas,
    CanvasApiError,
    CanvasNotFoundError,
} from '@/api/api';

interface ShapeParams extends Record<string, unknown> {
    sides?: number;
    width?: number;
    height?: number;
    radius?: number;
    fill?: string;
    fillOpacity?: number;
    stroke?: string;
    strokeOpacity?: number;
    strokeWidth?: number;
    rotation?: number;
}

type SerializedShapeBase = {
    type: string;
    id: string;
    position: { x: number; y: number };
    rotation: number;
    scaleX: number;
    scaleY: number;
};

type SerializedShape = SerializedShapeBase & Record<string, unknown>;

// Для внутреннего использования - с множественным выделением
type InternalSceneSnapshot = {
    shapes: SerializedShape[];
    selectedIds: string[];
    selectionRect?: { start: Point; end: Point } | null;
};

// Для API - с одиночным выделением (как ожидает сервер)
type ApiSceneSnapshot = {
    shapes: SerializedShape[];
    selectedId: string | null;
};

type CanvasStorageData = {
    documentId: string;
    isOfflineMode: boolean;
    shapes: SerializedShape[];
    selectedIds: string[];
    selectionRect?: { start: Point; end: Point } | null;
    zoom: number;
    pan: { x: number; y: number };
};

type VectorEditorExport = {
    format: 'vector-editor';
    version: 1;
    exportedAt: string;
    scene: InternalSceneSnapshot; // Экспортируем с множественным выделением
};

export const useCanvasStore = defineStore('canvas', () => {
    // Внутреннее состояние с множественным выделением
    const shapes = ref<Shape[]>([]);
    const selectedIds = ref<string[]>([]);

    // Для совместимости с компонентами, ожидающими selectedId
    const selectedId = computed({
        get: () => selectedIds.value[0] || null,
        set: (id) => {
            if (id) {
                selectedIds.value = [id];
            } else {
                selectedIds.value = [];
            }
        },
    });

    const selectionBox = ref<{ start: Point | null; end: Point | null }>({
        start: null,
        end: null,
    });
    const selectionRect = ref<{ start: Point; end: Point } | null>(null);
    const isSelecting = ref(false);
    const dragStartPositions = ref<Map<string, Point>>(new Map());

    const undoStack = ref<InternalSceneSnapshot[]>([]);
    const redoStack = ref<InternalSceneSnapshot[]>([]);
    const isInteractionActive = ref(false);
    const HISTORY_LIMIT = 50;
    const MIN_ZOOM = 10;
    const MAX_ZOOM = 500;
    const ZOOM_STEP = 10;
    const zoom = ref(100);
    const pan = ref({ x: 0, y: 0 });
    const documentId = ref<string>('0');
    const isOfflineMode = ref(false);
    const serverError = ref<string | null>(null);
    const backgroundColor = ref<string>('#ffffff');

    let isContinuousChangeActive = false;
    let continuousChangeTimer: number | null = null;
    const CONTINUOUS_CHANGE_TIMEOUT = 700;

    const selectedShapes = computed(() =>
        shapes.value.filter((s) => selectedIds.value.includes(s.id))
    );

    const hasSelection = computed(() => selectedIds.value.length > 0);
    const selectionCount = computed(() => selectedIds.value.length);

    const selectedShape = computed(
        () => shapes.value.find((s) => s.id === selectedIds.value[0]) ?? null
    );

    function serializeShape(shape: Shape): SerializedShape {
        const plain = JSON.parse(JSON.stringify(shape)) as SerializedShape;
        plain.type = (shape as unknown as { type: string }).type;
        plain.id = shape.id;
        plain.position = { x: shape.position.x, y: shape.position.y };
        plain.rotation = shape.rotation;
        plain.scaleX = shape.scaleX;
        plain.scaleY = shape.scaleY;
        return plain;
    }

    // Внутренний snapshot с множественным выделением
    function createSnapshot(): InternalSceneSnapshot {
        return {
            shapes: shapes.value.map((s) => serializeShape(s)),
            selectedIds: [...selectedIds.value],
            selectionRect: selectionRect.value
                ? { ...selectionRect.value }
                : null,
        };
    }

    // Конвертер для API (из множественного в одиночное)
    function internalToApiSnapshot(
        internal: InternalSceneSnapshot
    ): ApiSceneSnapshot {
        return {
            shapes: internal.shapes,
            selectedId: internal.selectedIds[0] || null,
        };
    }

    // Конвертер из API (из одиночного в множественное)
    function apiToInternalSnapshot(
        api: ApiSceneSnapshot
    ): InternalSceneSnapshot {
        return {
            shapes: api.shapes,
            selectedIds: api.selectedId ? [api.selectedId] : [],
            selectionRect: null,
        };
    }

    function restoreInternalSnapshot(snapshot: InternalSceneSnapshot) {
        const restored: Shape[] = snapshot.shapes.map((plain) => {
            const { type, id, position, ...rest } = plain;
            const shape = shapeRegistry.create(type, id, position);
            Object.assign(shape, rest);
            return shape as Shape;
        });

        shapes.value = restored;
        selectedIds.value = snapshot.selectedIds || [];
        if (snapshot.selectionRect) {
            selectionRect.value = { ...snapshot.selectionRect };
        } else {
            selectionRect.value = null;
        }
    }

    function snapshotToServerContent(
        snapshot: InternalSceneSnapshot
    ): Record<string, unknown> {
        return internalToApiSnapshot(snapshot);
    }

    function pushHistory() {
        const snapshot = createSnapshot();
        undoStack.value.push(snapshot);
        if (undoStack.value.length > HISTORY_LIMIT) {
            undoStack.value.shift();
        }
        redoStack.value = [];
    }

    function startInteraction() {
        if (!isInteractionActive.value) {
            pushHistory();
            isInteractionActive.value = true;
        }
    }

    function endInteraction() {
        isInteractionActive.value = false;
    }

    function ensureHistoryForContinuousChange() {
        if (isInteractionActive.value) return;

        if (!isContinuousChangeActive) {
            pushHistory();
            isContinuousChangeActive = true;
        }

        if (continuousChangeTimer !== null) {
            window.clearTimeout(continuousChangeTimer);
        }

        continuousChangeTimer = window.setTimeout(() => {
            isContinuousChangeActive = false;
            continuousChangeTimer = null;
        }, CONTINUOUS_CHANGE_TIMEOUT);
    }

    function undo() {
        const snapshot = undoStack.value.pop();
        if (!snapshot) return;

        const current = createSnapshot();
        redoStack.value.push(current);
        restoreInternalSnapshot(snapshot);
    }

    function redo() {
        const snapshot = redoStack.value.pop();
        if (!snapshot) return;

        const current = createSnapshot();
        undoStack.value.push(current);
        restoreInternalSnapshot(snapshot);
    }

    const canUndo = computed(() => undoStack.value.length > 0);
    const canRedo = computed(() => redoStack.value.length > 0);

    // Обновленные методы для работы с множественным выделением
    function selectShape(id: string | null, addToSelection: boolean = false) {
        if (!id) {
            if (!addToSelection) {
                selectedIds.value = [];
                selectionRect.value = null;
            }
            return;
        }

        if (addToSelection) {
            if (selectedIds.value.includes(id)) {
                selectedIds.value = selectedIds.value.filter((i) => i !== id);
            } else {
                selectedIds.value = [...selectedIds.value, id];
            }
        } else {
            selectedIds.value = [id];
            selectionRect.value = null;
        }
    }

    function selectShapesInRect(rect: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    }) {
        selectedIds.value = shapes.value
            .filter((shape) => {
                const box = shape.getBoundingBox();
                return !(
                    box.maxX < rect.minX ||
                    box.minX > rect.maxX ||
                    box.maxY < rect.minY ||
                    box.minY > rect.maxY
                );
            })
            .map((s) => s.id);

        if (selectedIds.value.length > 0) {
            selectionRect.value = {
                start: { x: rect.minX, y: rect.minY },
                end: { x: rect.maxX, y: rect.maxY },
            };
        } else {
            selectionRect.value = null;
        }
    }

    function startSelection(startPoint: Point) {
        selectionBox.value = { start: startPoint, end: startPoint };
        selectionRect.value = null;
        isSelecting.value = true;
    }

    function updateSelection(endPoint: Point) {
        if (isSelecting.value && selectionBox.value.start) {
            selectionBox.value.end = endPoint;
        }
    }

    function endSelection() {
        if (
            isSelecting.value &&
            selectionBox.value.start &&
            selectionBox.value.end
        ) {
            const start = selectionBox.value.start;
            const end = selectionBox.value.end;

            const rect = {
                minX: Math.min(start.x, end.x),
                minY: Math.min(start.y, end.y),
                maxX: Math.max(start.x, end.x),
                maxY: Math.max(start.y, end.y),
            };

            selectShapesInRect(rect);
        }

        selectionBox.value = { start: null, end: null };
        isSelecting.value = false;
    }

    function setDragStartPositions() {
        dragStartPositions.value.clear();
        selectedShapes.value.forEach((shape) => {
            dragStartPositions.value.set(shape.id, { ...shape.position });
        });
    }

    function moveSelectedShapes(delta: Point) {
        selectedShapes.value.forEach((shape) => {
            const startPos = dragStartPositions.value.get(shape.id);
            if (startPos) {
                shape.position.x = startPos.x + delta.x;
                shape.position.y = startPos.y + delta.y;
            }
        });

        if (selectionRect.value) {
            selectionRect.value.start.x += delta.x;
            selectionRect.value.start.y += delta.y;
            selectionRect.value.end.x += delta.x;
            selectionRect.value.end.y += delta.y;
        }
    }

    function deleteSelectedShapes() {
        if (selectedIds.value.length === 0) return;

        pushHistory();
        shapes.value = shapes.value.filter(
            (s) => !selectedIds.value.includes(s.id)
        );
        selectedIds.value = [];
        selectionRect.value = null;
    }

    function selectAll() {
        if (shapes.value.length === 0) return;

        selectedIds.value = shapes.value.map((s) => s.id);
        if (selectedIds.value.length > 0) {
            const allPoints = shapes.value.flatMap((s) => {
                const box = s.getBoundingBox();
                return [
                    { x: box.minX, y: box.minY },
                    { x: box.maxX, y: box.maxY },
                ];
            });

            const minX = Math.min(...allPoints.map((p) => p.x));
            const minY = Math.min(...allPoints.map((p) => p.y));
            const maxX = Math.max(...allPoints.map((p) => p.x));
            const maxY = Math.max(...allPoints.map((p) => p.y));

            selectionRect.value = {
                start: { x: minX, y: minY },
                end: { x: maxX, y: maxY },
            };
        }
    }

    function clearSelection() {
        selectedIds.value = [];
        selectionRect.value = null;
    }

    function addShape(
        type: string,
        pos: { x: number; y: number },
        params?: ShapeParams,
        recordHistory: boolean = true
    ) {
        if (recordHistory) {
            pushHistory();
        }

        const existingShapesOfType = shapes.value.filter(
            (s) => s.type === type
        );
        const typeName =
            type === 'rect'
                ? 'Прямоугольник'
                : type === 'circle'
                  ? 'Круг'
                  : type === 'line'
                    ? 'Линия'
                    : type === 'polygon'
                      ? 'Многоугольник'
                      : type === 'star'
                        ? 'Звезда'
                        : type === 'triangle'
                          ? 'Треугольник'
                          : type === 'arrow'
                            ? 'Стрелка'
                            : type === 'hexagon'
                              ? 'Шестиугольник'
                              : type;

        const number = existingShapesOfType.length + 1;
        const defaultName = `${typeName} ${number}`;

        let shape: Shape;

        if (type === 'polygon' && params?.sides) {
            shape = new PolygonShape(
                generateId(),
                pos,
                params.sides,
                100,
                100,
                0,
                '#3498db',
                0,
                '#2c3e50',
                1,
                2
            );
            (shape as Shape).name = defaultName;
            shapes.value.push(shape);
            return shape;
        }

        shape = shapeRegistry.create(type, generateId(), pos);
        (shape as Shape).name = defaultName;
        shapes.value.push(shape);
        return shape;
    }

    function updateShape(id: string, updates: Partial<Shape>) {
        ensureHistoryForContinuousChange();
        const shape = shapes.value.find((s) => s.id === id);
        if (shape) {
            Object.assign(shape, updates);
            shapes.value = [...shapes.value];
        }
    }

    function deleteShape(id: string) {
        pushHistory();
        shapes.value = shapes.value.filter((s) => s.id !== id);
        selectedIds.value = selectedIds.value.filter((i) => i !== id);
        if (selectedIds.value.length === 0) {
            selectionRect.value = null;
        }
    }

    function moveShape(fromIndex: number, toIndex: number) {
        if (
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= shapes.value.length ||
            toIndex >= shapes.value.length
        ) {
            return;
        }

        pushHistory();
        const next = [...shapes.value];
        const [item] = next.splice(fromIndex, 1);
        if (!item) {
            return;
        }
        next.splice(toIndex, 0, item);
        shapes.value = next;
    }

    function setZoom(value: number) {
        const newZoom = Math.max(
            MIN_ZOOM,
            Math.min(MAX_ZOOM, Math.round(value))
        );
        if (newZoom === zoom.value) return;

        const worldCenterX = -pan.value.x / (zoom.value / 100);
        const worldCenterY = -pan.value.y / (zoom.value / 100);

        const newZoomFactor = newZoom / 100;
        const newPanX = -worldCenterX * newZoomFactor;
        const newPanY = -worldCenterY * newZoomFactor;

        zoom.value = newZoom;
        pan.value = { x: newPanX, y: newPanY };
    }

    function zoomIn() {
        setZoom(zoom.value + ZOOM_STEP);
    }

    function zoomOut() {
        setZoom(zoom.value - ZOOM_STEP);
    }

    function setPan(value: { x: number; y: number }) {
        pan.value = { x: value.x, y: value.y };
    }

    function movePan(delta: { x: number; y: number }) {
        pan.value = {
            x: pan.value.x + delta.x,
            y: pan.value.y + delta.y,
        };
    }

    const STORAGE_KEY = 'vector-editor-canvas';

    function saveToLocalStorage() {
        try {
            const data: CanvasStorageData = {
                documentId: documentId.value,
                isOfflineMode: isOfflineMode.value,
                shapes: shapes.value.map(serializeShape),
                selectedIds: selectedIds.value,
                selectionRect: selectionRect.value
                    ? { ...selectionRect.value }
                    : null,
                zoom: zoom.value,
                pan: pan.value,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Ошибка сохранения:', e);
        }
    }

    function loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return;

            const data = JSON.parse(saved) as Partial<CanvasStorageData>;
            documentId.value = String(data.documentId ?? '0');
            isOfflineMode.value = Boolean(data.isOfflineMode ?? false);
if (data.zoom) zoom.value = data.zoom;
            if (data.pan) pan.value = data.pan;
            // Добавьте загрузку цвета фона
            const savedBgColor = localStorage.getItem('canvas-bg-color');
            if (savedBgColor) {
                backgroundColor.value = savedBgColor;
            }

            const restored: Shape[] = (data.shapes ?? []).map(
                (plain: SerializedShape) => {
                    const { type, id, position, ...rest } = plain;
                    const shape = shapeRegistry.create(type, id, position);
                    Object.assign(shape, rest);
                    return shape as Shape;
                }
            );

            shapes.value = restored;
            selectedIds.value = data.selectedIds || [];
            if (data.selectionRect) {
                selectionRect.value = { ...data.selectionRect };
            }
        } catch (e) {
            console.error('Ошибка загрузки:', e);
        }
    }

    function setBackgroundColor(color: string) {
        backgroundColor.value = color;
        localStorage.setItem('canvas-bg-color', color);
    }

    async function initDocument() {
        const localScene = createSnapshot();

        // if (isOfflineMode.value) {
        //     return;
        // }

        try {
            if (documentId.value !== '0') {
                const remote = await getCanvasById(documentId.value);
                if (localScene.shapes.length === 0) {
                    const apiSnapshot: ApiSceneSnapshot = {
                        shapes:
                            (remote.content.shapes as
                                | SerializedShape[]
                                | undefined) ?? [],
                        selectedId:
                            (remote.content.selectedId as
                                | string
                                | null
                                | undefined) ?? null,
                    };
                    restoreInternalSnapshot(apiToInternalSnapshot(apiSnapshot));
                } else {
                    await updateCanvas(
                        documentId.value,
                        snapshotToServerContent(localScene)
                    );
                }

                isOfflineMode.value = false;
                serverError.value = null;

                return;
            }

            const created = await createCanvas(
                snapshotToServerContent(localScene)
            );

            isOfflineMode.value = false;
            documentId.value = created.id;
            serverError.value = null;
        } catch (error) {
            isOfflineMode.value = true;
            documentId.value = '0';
            serverError.value =
                error instanceof Error ? error.message : 'Сервер недоступен';
        }
    }

    async function openDocumentById(id: string): Promise<{
        success: boolean;
        message: string;
    }> {
        if (isOfflineMode.value) {
            return {
                success: false,
                message:
                    'Сервер недоступен. В офлайн-режиме открытие документа по номеру выключено.',
            };
        }

        try {
            const remote = await getCanvasById(id);
            const apiSnapshot: ApiSceneSnapshot = {
                shapes:
                    (remote.content.shapes as SerializedShape[] | undefined) ??
                    [],
                selectedId:
                    (remote.content.selectedId as string | null | undefined) ??
                    null,
            };
            restoreInternalSnapshot(apiToInternalSnapshot(apiSnapshot));
            documentId.value = remote.id;
            serverError.value = null;
            return { success: true, message: 'Документ успешно открыт.' };
        } catch (error) {
            if (error instanceof CanvasNotFoundError) {
                return {
                    success: false,
                    message: 'Документ с таким номером не найден.',
                };
            }

            if (error instanceof CanvasApiError) {
                isOfflineMode.value = true;
                documentId.value = '0';
                serverError.value = error.message;
                return {
                    success: false,
                    message:
                        'Сервер недоступен. Режим работы переключен на локальный (офлайн).',
                };
            }

            return { success: false, message: 'Не удалось открыть документ.' };
        }
    }

    async function syncDocument() {
        if (isOfflineMode.value || documentId.value === '0') {
            return;
        }

        try {
            await updateCanvas(
                documentId.value,
                snapshotToServerContent(createSnapshot())
            );
            serverError.value = null;
        } catch (error) {
            isOfflineMode.value = true;
            documentId.value = '0';
            serverError.value =
                error instanceof Error ? error.message : 'Сервер недоступен';
        }
    }

    function exportToJson(): string {
        const payload: VectorEditorExport = {
            format: 'vector-editor',
            version: 1,
            exportedAt: new Date().toISOString(),
            scene: createSnapshot(),
        };

        return JSON.stringify(payload, null, 2);
    }

    function importFromJson(json: string): {
        success: boolean;
        message: string;
    } {
        try {
            const parsed = JSON.parse(json) as Partial<VectorEditorExport>;

            if (parsed.format !== 'vector-editor' || parsed.version !== 1) {
                return {
                    success: false,
                    message:
                        'Неподдерживаемый формат файла. Ожидается vector-editor.',
                };
            }

            if (!parsed.scene || !Array.isArray(parsed.scene.shapes)) {
                return {
                    success: false,
                    message: 'Файл повреждён: отсутствует описание сцены.',
                };
            }

            restoreInternalSnapshot(parsed.scene);
            undoStack.value = [];
            redoStack.value = [];
            isInteractionActive.value = false;
            isContinuousChangeActive = false;
            if (continuousChangeTimer !== null) {
                window.clearTimeout(continuousChangeTimer);
                continuousChangeTimer = null;
            }

            return { success: true, message: 'Проект успешно импортирован.' };
        } catch (error) {
            console.error('Ошибка импорта:', error);
            return {
                success: false,
                message: 'Не удалось прочитать JSON-файл.',
            };
        }
    }

    loadFromLocalStorage();
    void initDocument();

    watch(
        [shapes, selectedIds, zoom, pan, documentId, isOfflineMode],
        () => {
            saveToLocalStorage();
            void syncDocument();
        },
        { deep: true }
    );

    return {
        shapes,
        selectedId,
        selectedIds,
        selectedShapes,
        hasSelection,
        selectionCount,
        selectedShape,
        selectionBox,
        selectionRect,
        isSelecting,
        dragStartPositions,
        zoom,
        pan,
        documentId,
        isOfflineMode,
        serverError,
        addShape,
        updateShape,
        deleteShape,
        selectShape,
        selectShapesInRect,
        startSelection,
        updateSelection,
        endSelection,
        setDragStartPositions,
        moveSelectedShapes,
        deleteSelectedShapes,
        selectAll,
        clearSelection,
        moveShape,
        undo,
        redo,
        canUndo,
        canRedo,
        setZoom,
        zoomIn,
        zoomOut,
        setPan,
        movePan,
        openDocumentById,
        startInteraction,
        endInteraction,
        exportToJson,
        importFromJson,
        backgroundColor,
        setBackgroundColor,
        MIN_ZOOM,
        MAX_ZOOM,
        ZOOM_STEP,
    };
});
