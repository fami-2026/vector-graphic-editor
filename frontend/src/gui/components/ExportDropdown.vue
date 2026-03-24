<template>
    <div class="wrap" ref="root">
        <button class="btn" type="button" @click="toggle" :aria-expanded="open">
            <span>Экспорт</span>
            <svg
                class="chevron"
                width="14"
                height="14"
                viewBox="0 0 20 20"
                aria-hidden="true"
            >
                <path
                    d="M5 7l5 5 5-5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </svg>
        </button>

        <div v-if="open" class="menu" role="menu">
            <button
                class="item"
                role="menuitem"
                type="button"
                @click="openExport('png')"
            >
                PNG
            </button>
            <button
                class="item"
                role="menuitem"
                type="button"
                @click="openExport('svg')"
            >
                SVG
            </button>
            <button
                class="item"
                role="menuitem"
                type="button"
                @click="exportJson"
            >
                JSON
            </button>
        </div>
    </div>

    <div
        v-if="showExport"
        class="modalOverlay"
        role="dialog"
        aria-modal="true"
        @click.self="closeExport"
    >
        <div class="modalCard">
            <div class="modalHead">
                <h3>Экспорт {{ form.format.toUpperCase() }}</h3>
            </div>

            <label class="field">
                <span>Имя файла</span>
                <input
                    v-model="form.fileName"
                    type="text"
                    placeholder="vector-export"
                    @blur="normalizeFileName"
                />
            </label>

            <label class="field">
                <span>Фон</span>
                <select v-model="form.pngBackground">
                    <option value="transparent">Прозрачный</option>
                    <option value="white">Белый</option>
                </select>
            </label>

            <label v-if="form.format === 'png'" class="field">
                <span>Качество PNG</span>
                <select v-model.number="form.pngScale">
                    <option :value="1">1x (обычное)</option>
                    <option :value="2">2x (четче)</option>
                    <option :value="3">3x (максимум)</option>
                </select>
            </label>

            <div class="actions">
                <button class="btn ghost" type="button" @click="closeExport">
                    Отмена
                </button>
                <button class="btn" type="button" @click="submitExport">
                    Скачать {{ form.format.toUpperCase() }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useCanvasStore } from '@/stores/canvas';
import {
    buildDefaultFileName,
    exportScene,
    sanitizeFileName,
    type ExportArea,
    type ExportBackground,
    type ExportFormat,
    type PngScale,
} from '@/canvas/utils/export';

const open = ref(false);
const showExport = ref(false);
const root = ref<HTMLElement | null>(null);
const canvasStore = useCanvasStore();
const { shapes, selectedId } = storeToRefs(canvasStore);

const form = reactive<{
    fileName: string;
    format: ExportFormat;
    area: ExportArea;
    pngScale: PngScale;
    pngBackground: ExportBackground;
}>({
    fileName: 'vector-export',
    format: 'png',
    area: 'scene',
    pngScale: 1,
    pngBackground: 'transparent',
});

function toggle() {
    open.value = !open.value;
}

function close() {
    open.value = false;
}

function openExport(format: ExportFormat) {
    form.format = format;
    form.fileName = buildDefaultFileName(format, 'vector-export').replace(
        /\.[^.]$/,
        ''
    );
    normalizeFileName();
    showExport.value = true;
    close();
}

function closeExport() {
    showExport.value = false;
}

function getSceneSize() {
    const canvas = document.querySelector(
        '.main-canvas'
    ) as HTMLCanvasElement | null;

    if (canvas?.width && canvas?.height) {
        return {
            width: canvas.width,
            height: canvas.height,
        };
    }

    return { width: 1, height: 1 };
}

function normalizeFileName() {
    form.fileName = sanitizeFileName(form.fileName);
}

function exportJson() {
    const json = canvasStore.exportToJson();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `vector-editor-${timestamp}.json`;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);

    close();
}

async function submitExport() {
    normalizeFileName();

    try {
        await exportScene({
            format: form.format,
            fileName: form.fileName,
            area: form.area,
            shapes: shapes.value,
            sceneSize: getSceneSize(),
            selectedId: selectedId.value,
            pngScale: form.pngScale,
            background: form.pngBackground,
        });

        closeExport();
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : 'Не удалось выполнить экспорт.';
        window.alert(message);
    }
}

function onDocPointerDown(e: PointerEvent) {
    const el = root.value;
    if (!el) return;
    if (e.target instanceof Node && !el.contains(e.target)) close();
}

function onDocKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
    if (e.key === 'Escape' && showExport.value) closeExport();
}

onMounted(() => {
    document.addEventListener('pointerdown', onDocPointerDown);
    document.addEventListener('keydown', onDocKeyDown);
});

onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onDocPointerDown);
    document.removeEventListener('keydown', onDocKeyDown);
});
</script>

<style scoped>
.wrap {
    position: relative;
    display: inline-block;
}

.btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;

    background: #2563eb;
    color: #ffffff;
    border: 0;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.1);
}

.btn:hover {
    background: #1d4ed8;
}

.btn.ghost {
    background: #f3f4f6;
    color: #111827;
    box-shadow: none;
}

.btn.ghost:hover {
    background: #e5e7eb;
}

.chevron {
    opacity: 0.95;
}

.menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    min-width: 140px;

    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
    padding: 6px;
    z-index: 20;
}

.item {
    width: 100%;
    text-align: left;

    background: transparent;
    border: 0;
    border-radius: 8px;
    padding: 8px 10px;
    cursor: pointer;
    color: #111827;
}

.item:hover {
    background: #f3f4f6;
}

.modalOverlay {
    position: fixed;
    inset: 0;
    background: rgba(17, 24, 39, 0.45);
    display: grid;
    place-items: center;
    z-index: 60;
}

.modalCard {
    width: min(90vw, 420px);
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    box-shadow: 0 14px 36px rgba(0, 0, 0, 0.22);
    padding: 16px;
    display: grid;
    gap: 12px;
}

.modalHead h3 {
    margin: 0;
    font-size: 18px;
    color: #111827;
}

.field {
    display: grid;
    gap: 6px;
}

.field span {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
}

.field input,
.field select {
    width: 100%;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 8px 10px;
    font: inherit;
    color: #111827;
    background: #fff;
}

.field input:focus,
.field select:focus {
    outline: 2px solid #93c5fd;
    border-color: #2563eb;
}

.hint {
    color: #6b7280;
    font-size: 12px;
}

.actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 6px;
}
</style>
