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
import { getShapeLabel } from '@/config/shapeLabels';
import type {
    CanvasStorageData,
    SceneSnapshot,
    SerializedShape,
    ShapeParams,
    VectorEditorExport,
} from '@/stores/canvas/types';
import {
    CANVAS_DEFAULTS,
    CANVAS_STORAGE_KEYS,
    CANVAS_VIEWPORT_LIMITS,
    CONTINUOUS_CHANGE_TIMEOUT_MS as CONTINUOUS_CHANGE_TIMEOUT_MS_VALUE,
    HISTORY_LIMIT as HISTORY_LIMIT_VALUE,
    SHAPE_CLONE_OFFSET,
    SHAPE_COPY_SUFFIX,
    SYNC_DOCUMENT_DEBOUNCE_MS as SYNC_DOCUMENT_DEBOUNCE_MS_VALUE,
} from '@/stores/canvas/constants';
import { createOffsetShapeClone } from '@/stores/canvas/clone';
import { deserializeShapes, serializeShape } from '@/stores/canvas/scene';

export const useCanvasStore = defineStore('canvas', () => {
    const shapes = ref<Shape[]>([]);
    const selectedId = ref<string | null>(null);
    const selectedIds = ref<string[]>([]);
    const selectionBox = ref<{ start: Point | null; end: Point | null }>({
        start: null,
        end: null,
    });
    const selectionRect = ref<{ start: Point; end: Point } | null>(null);
    const isSelecting = ref(false);
    const dragStartPositions = ref<Map<string, Point>>(new Map());

    const undoStack = ref<SceneSnapshot[]>([]);
    const redoStack = ref<SceneSnapshot[]>([]);
    const isInteractionActive = ref(false);
    const HISTORY_LIMIT = HISTORY_LIMIT_VALUE;
    const MIN_ZOOM = CANVAS_VIEWPORT_LIMITS.minZoom;
    const MAX_ZOOM = CANVAS_VIEWPORT_LIMITS.maxZoom;
    const ZOOM_STEP = CANVAS_VIEWPORT_LIMITS.zoomStep;
    const DEFAULT_DOCUMENT_ID = CANVAS_DEFAULTS.documentId;
    const DEFAULT_ZOOM = CANVAS_DEFAULTS.zoom;
    const DEFAULT_PAN = CANVAS_DEFAULTS.pan;
    const CANVAS_STORAGE_KEY = CANVAS_STORAGE_KEYS.scene;
    const CANVAS_BG_COLOR_STORAGE_KEY = CANVAS_STORAGE_KEYS.backgroundColor;
    const zoom = ref(DEFAULT_ZOOM);
    const pan = ref({ ...DEFAULT_PAN });
    const documentId = ref<string>(DEFAULT_DOCUMENT_ID);
    const isOfflineMode = ref(false);
    const serverError = ref<string | null>(null);
    const backgroundColor = ref<string>(CANVAS_DEFAULTS.backgroundColor);
    const clipboardShape = ref<SerializedShape | null>(null);

    let isContinuousChangeActive = false;
    let continuousChangeTimer: number | null = null;
    let syncDocumentTimer: number | null = null;
    const CONTINUOUS_CHANGE_TIMEOUT = CONTINUOUS_CHANGE_TIMEOUT_MS_VALUE;
    const SYNC_DOCUMENT_DEBOUNCE_MS = SYNC_DOCUMENT_DEBOUNCE_MS_VALUE;
    const selectedShapes = computed(() =>
        shapes.value.filter((s) => selectedIds.value.includes(s.id))
    );

    const hasSelection = computed(() => selectedIds.value.length > 0);
    const selectionCount = computed(() => selectedIds.value.length);

    const selectedShape = computed(
        () => shapes.value.find((s) => s.id === selectedId.value) ?? null
    );

    const createShape = (type: string, id: string, position: Point): Shape =>
        shapeRegistry.create(type, id, position);

    function getPrimarySelectionId(ids: string[]): string | null {
        return ids[0] ?? null;
    }

    function syncPrimarySelectionFromIds() {
        selectedId.value = getPrimarySelectionId(selectedIds.value);
    }

    function setSelectedIds(nextIds: string[]) {
        selectedIds.value = nextIds;
        syncPrimarySelectionFromIds();
    }

    function clearSelectionState() {
        applySelection([], { clearRect: true, sync: false });
    }

    function setSelectionRectFromBounds(
        bounds:
            | {
                  minX: number;
                  minY: number;
                  maxX: number;
                  maxY: number;
              }
            | null
    ) {
        if (!bounds) {
            selectionRect.value = null;
            return;
        }

        selectionRect.value = {
            start: { x: bounds.minX, y: bounds.minY },
            end: { x: bounds.maxX, y: bounds.maxY },
        };
    }

    function clearSelectionRect() {
        setSelectionRectFromBounds(null);
    }

    /**
     * Единая точка изменения выделения.
     * Гарантирует синхронизацию `selectedIds`/`selectedId`, опциональную очистку рамки
     * и запуск синка документа при необходимости.
     */
    function applySelection(
        nextIds: string[],
        options: { clearRect?: boolean; sync?: boolean } = {}
    ) {
        setSelectedIds(nextIds);

        if (options.clearRect) {
            clearSelectionRect();
        }

        if (options.sync) {
            scheduleDocumentSync();
        }
    }

    function clampZoom(value: number, shouldRound = false): number {
        const normalized = shouldRound ? Math.round(value) : value;
        return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, normalized));
    }

    function toUniqueStringArray(values: unknown[]): string[] {
        const uniqueValues: string[] = [];
        const seen = new Set<string>();

        values.forEach((value) => {
            if (typeof value !== 'string' || seen.has(value)) {
                return;
            }
            seen.add(value);
            uniqueValues.push(value);
        });

        return uniqueValues;
    }

    function normalizePersistedSelection(data: Partial<CanvasStorageData>): string[] {
        const candidateIds = Array.isArray(data.selectedIds)
            ? toUniqueStringArray(data.selectedIds)
            : [];

        if (candidateIds.length > 0) {
            return candidateIds;
        }

        return typeof data.selectedId === 'string' ? [data.selectedId] : [];
    }

    function applySelectionFromPersistedData(data: Partial<CanvasStorageData>) {
        const persistedIds = normalizePersistedSelection(data);
        const existingIds = new Set(shapes.value.map((shape) => shape.id));
        const validIds = persistedIds.filter((id) => existingIds.has(id));
        applySelection(validIds, { sync: false });
    }

    function buildDefaultShapeName(type: string): string {
        const existingShapesOfType = shapes.value.filter((shape) => shape.type === type);
        const typeName = getShapeLabel(type);
        const number = existingShapesOfType.length + 1;
        return `${typeName} ${number}`;
    }

    function appendShape(shape: Shape, name: string): Shape {
        (shape as Shape).name = name;
        shapes.value.push(shape);
        scheduleDocumentSync();
        return shape;
    }

    function copySelectedShape() {
        if (!selectedShape.value) return;
        clipboardShape.value = serializeShape(selectedShape.value);
    }

    function appendClonedShape(
        plain: SerializedShape,
        options: { updateClipboard: boolean }
    ) {
        const clonedShape = createOffsetShapeClone(plain, {
            offset: SHAPE_CLONE_OFFSET,
            nameSuffix: SHAPE_COPY_SUFFIX,
            createShape,
            generateId,
        });
        shapes.value.push(clonedShape);
        applySelection([clonedShape.id], { clearRect: true, sync: false });

        if (options.updateClipboard) {
            clipboardShape.value = serializeShape(clonedShape);
        }

        scheduleDocumentSync();
    }

    function pasteShape() {
        if (!clipboardShape.value) return;

        pushHistory();
        appendClonedShape(clipboardShape.value, { updateClipboard: true });
    }

    function duplicateSelectedShape() {
        if (!selectedShape.value) return;

        pushHistory();
        appendClonedShape(serializeShape(selectedShape.value), {
            updateClipboard: false,
        });
    }

    function createSnapshot(): SceneSnapshot {
        return {
            shapes: shapes.value.map((s) => serializeShape(s)),
            selectedId: getPrimarySelectionId(selectedIds.value),
        };
    }

    function restoreSnapshot(snapshot: SceneSnapshot) {
        shapes.value = deserializeShapes(snapshot.shapes, createShape);
        applySelection(snapshot.selectedId ? [snapshot.selectedId] : [], {
            clearRect: true,
            sync: false,
        });
    }

    function snapshotToServerContent(
        snapshot: SceneSnapshot
    ): Record<string, unknown> {
        return {
            shapes: snapshot.shapes,
            selectedId: snapshot.selectedId,
        };
    }

    /**
     * Сохраняет текущий снимок сцены в undo-стек и очищает redo-стек.
     */
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
        scheduleDocumentSync();
    }

    /**
     * Для непрерывных правок (например, drag) добавляет историю один раз
     * и переиспользует ее в течение тайм-окна, чтобы не засорять undo-стек.
     */
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
        restoreSnapshot(snapshot);
        scheduleDocumentSync();
    }

    function redo() {
        const snapshot = redoStack.value.pop();
        if (!snapshot) return;

        const current = createSnapshot();
        undoStack.value.push(current);
        restoreSnapshot(snapshot);
        scheduleDocumentSync();
    }

    const canUndo = computed(() => undoStack.value.length > 0);
    const canRedo = computed(() => redoStack.value.length > 0);

    function selectShape(id: string | null) {
        applySelection(id ? [id] : [], { clearRect: true, sync: true });
    }

    function selectShapeWithAdd(
        id: string | null,
        addToSelection: boolean = false
    ) {
        if (!id) {
            if (!addToSelection) {
                clearSelectionState();
            }
            return;
        }

        if (addToSelection) {
            if (selectedIds.value.includes(id)) {
                applySelection(selectedIds.value.filter((i) => i !== id), {
                    sync: true,
                });
            } else {
                applySelection([...selectedIds.value, id], { sync: true });
            }
        } else {
            applySelection([id], { clearRect: true, sync: true });
        }
    }

    function selectShapesInRect(rect: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    }) {
        const nextSelectedIds = shapes.value
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
        applySelection(nextSelectedIds, { sync: false });
        setSelectionRectFromBounds(selectedIds.value.length > 0 ? rect : null);

        scheduleDocumentSync();
    }

    function startSelection(startPoint: Point) {
        selectionBox.value = { start: startPoint, end: startPoint };
        clearSelectionRect();
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

        scheduleDocumentSync();
    }

    function deleteSelectedShapes() {
        if (selectedIds.value.length === 0) return;

        pushHistory();
        shapes.value = shapes.value.filter(
            (s) => !selectedIds.value.includes(s.id)
        );
        clearSelectionState();
        scheduleDocumentSync();
    }

    function selectAll() {
        if (shapes.value.length === 0) return;

        applySelection(
            shapes.value.map((s) => s.id),
            { sync: false }
        );

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

            setSelectionRectFromBounds({ minX, minY, maxX, maxY });
        }

        scheduleDocumentSync();
    }

    function clearSelection() {
        applySelection([], { clearRect: true, sync: true });
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

        const defaultName = buildDefaultShapeName(type);

        let shape: Shape;

        if (type === 'polygon' && params?.sides) {
            shape = new PolygonShape(generateId(), pos, params.sides);
            return appendShape(shape, defaultName);
        }

        shape = shapeRegistry.create(type, generateId(), pos);
        return appendShape(shape, defaultName);
    }

    function updateShape(id: string, updates: Partial<Shape>) {
        const shape = shapes.value.find((s) => s.id === id);
        if (!shape) return;

        const hasRealChange = Object.entries(updates).some(([key, value]) => {
            const current = (shape as unknown as Record<string, unknown>)[key];
            return !Object.is(current, value);
        });

        if (!hasRealChange) {
            return;
        }

        ensureHistoryForContinuousChange();
        Object.assign(shape, updates);
        shapes.value = [...shapes.value];
        scheduleDocumentSync();
    }

    function deleteShape(id: string) {
        pushHistory();
        shapes.value = shapes.value.filter((s) => s.id !== id);
        const filteredSelectedIds = selectedIds.value.filter((i) => i !== id);
        applySelection(filteredSelectedIds, {
            clearRect: filteredSelectedIds.length === 0,
            sync: true,
        });
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
        scheduleDocumentSync();
    }

    function setZoom(value: number) {
        const newZoom = clampZoom(value, true);
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
        zoomAtCenter(ZOOM_STEP);
    }

    function zoomOut() {
        zoomAtCenter(-ZOOM_STEP);
    }

    function zoomAtCenter(delta: number) {
        const canvasEl = document.querySelector(
            '.main-canvas'
        ) as HTMLCanvasElement | null;
        const rect = canvasEl?.getBoundingClientRect();

        if (!rect) {
            zoom.value = clampZoom(zoom.value + delta);
            return;
        }

        const zoomFactor = zoom.value / 100;
        const worldCenterX = -pan.value.x / zoomFactor;
        const worldCenterY = -pan.value.y / zoomFactor;

        const newZoom = clampZoom(zoom.value + delta);
        const newZoomFactor = newZoom / 100;

        const newPanX = -worldCenterX * newZoomFactor;
        const newPanY = -worldCenterY * newZoomFactor;
        zoom.value = newZoom;
        pan.value = { x: newPanX, y: newPanY };
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

    function setBackgroundColor(color: string) {
        backgroundColor.value = color;
        localStorage.setItem(CANVAS_BG_COLOR_STORAGE_KEY, color);
    }

    function saveToLocalStorage() {
        try {
            const data: CanvasStorageData = {
                documentId: documentId.value,
                isOfflineMode: isOfflineMode.value,
                shapes: shapes.value.map(serializeShape),
                selectedId: getPrimarySelectionId(selectedIds.value),
                selectedIds: selectedIds.value,
                selectionRect: selectionRect.value
                    ? { ...selectionRect.value }
                    : null,
                zoom: zoom.value,
                pan: { ...pan.value },
                backgroundColor: backgroundColor.value,
            };
            localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Ошибка сохранения:', e);
        }
    }

    function loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
            if (!saved) return;

            const data = JSON.parse(saved) as Partial<CanvasStorageData>;
            documentId.value = String(data.documentId ?? DEFAULT_DOCUMENT_ID);
            isOfflineMode.value = Boolean(data.isOfflineMode ?? false);
            zoom.value = clampZoom(Number(data.zoom ?? DEFAULT_ZOOM));

            const savedPan = data.pan;
            pan.value = {
                x: Number(savedPan?.x ?? DEFAULT_PAN.x),
                y: Number(savedPan?.y ?? DEFAULT_PAN.y),
            };

            if (data.backgroundColor) {
                backgroundColor.value = data.backgroundColor;
            } else {
                const savedBgColor = localStorage.getItem(
                    CANVAS_BG_COLOR_STORAGE_KEY
                );
                if (savedBgColor) {
                    backgroundColor.value = savedBgColor;
                }
            }

            shapes.value = deserializeShapes(data.shapes ?? [], createShape);
            applySelectionFromPersistedData(data);

            if (data.selectionRect) {
                selectionRect.value = { ...data.selectionRect };
            }
        } catch (e) {
            console.error('Ошибка загрузки:', e);
        }
    }

    async function initDocument() {
        const localScene = createSnapshot();

        try {
            if (documentId.value !== DEFAULT_DOCUMENT_ID) {
                const remote = await getCanvasById(documentId.value);
                if (localScene.shapes.length === 0) {
                    restoreSnapshot({
                        shapes:
                            (remote.content.shapes as
                                | SerializedShape[]
                                | undefined) ?? [],
                        selectedId:
                            (remote.content.selectedId as
                                | string
                                | null
                                | undefined) ?? null,
                    });
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
            documentId.value = DEFAULT_DOCUMENT_ID;
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
            restoreSnapshot({
                shapes:
                    (remote.content.shapes as SerializedShape[] | undefined) ??
                    [],
                selectedId:
                    (remote.content.selectedId as string | null | undefined) ??
                    null,
            });
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
                documentId.value = DEFAULT_DOCUMENT_ID;
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
        if (isOfflineMode.value || documentId.value === DEFAULT_DOCUMENT_ID) {
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
            documentId.value = DEFAULT_DOCUMENT_ID;
            serverError.value =
                error instanceof Error ? error.message : 'Сервер недоступен';
        }
    }

    /**
     * Дебаунсит синхронизацию документа с сервером.
     * Все частые локальные изменения складываются в один сетевой вызов.
     */
    function scheduleDocumentSync() {
        if (syncDocumentTimer !== null) {
            window.clearTimeout(syncDocumentTimer);
        }

        syncDocumentTimer = window.setTimeout(() => {
            syncDocumentTimer = null;
            void syncDocument();
        }, SYNC_DOCUMENT_DEBOUNCE_MS);
    }

    function exportToJson(): string {
        const payload: VectorEditorExport = {
            format: 'vector-editor',
            version: 1,
            exportedAt: new Date().toISOString(),
            backgroundColor: backgroundColor.value,
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

            restoreSnapshot(parsed.scene);
            if (parsed.backgroundColor) {
                setBackgroundColor(parsed.backgroundColor);
            }
            undoStack.value = [];
            redoStack.value = [];
            isInteractionActive.value = false;
            isContinuousChangeActive = false;
            if (continuousChangeTimer !== null) {
                window.clearTimeout(continuousChangeTimer);
                continuousChangeTimer = null;
            }

            scheduleDocumentSync();

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
        [
            shapes,
            selectedId,
            documentId,
            isOfflineMode,
            zoom,
            pan,
            backgroundColor,
        ],
        () => {
            saveToLocalStorage();
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
        MIN_ZOOM,
        MAX_ZOOM,
        ZOOM_STEP,
        zoom,
        pan,
        documentId,
        isOfflineMode,
        serverError,
        backgroundColor,
        addShape,
        updateShape,
        deleteShape,
        selectShape,
        selectShapeWithAdd,
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
        duplicateSelectedShape,
        copySelectedShape,
        pasteShape,
        undo,
        redo,
        canUndo,
        canRedo,
        setZoom,
        zoomIn,
        zoomOut,
        zoomAtCenter,
        setPan,
        movePan,
        setBackgroundColor,
        openDocumentById,
        startInteraction,
        endInteraction,
        exportToJson,
        importFromJson,
    };
});

