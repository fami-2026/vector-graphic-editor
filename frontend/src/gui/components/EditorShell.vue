<template>
    <div class="editor">
        <div class="stage">
            <div class="canvasRoot">
                <VectorCanvas />
            </div>

            <div v-show="!isFocusMode" class="topLeft">
                <TopLeftActions />
            </div>

            <div
                v-show="!isFocusMode"
                class="rightPanelWrap"
                :class="{ closed: !isInspectorOpen }"
            >
                <button
                    class="toggleInspectorBtn"
                    type="button"
                    :title="
                        isInspectorOpen ? 'Скрыть панель' : 'Показать панель'
                    "
                    @click="isInspectorOpen = !isInspectorOpen"
                >
                    {{ isInspectorOpen ? '›' : '‹' }}
                </button>

                <div class="rightPanel">
                    <InspectorPanel />
                </div>
            </div>

            <div v-show="!isFocusMode" class="bottomCenter">
                <BottomToolbar />
            </div>

            <div v-show="!isFocusMode" class="bottomLeft">
                <BottomLeftControls />
            </div>

            <HotkeysHelp />
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import TopLeftActions from './TopLeftActions.vue';
import InspectorPanel from './InspectorPanel.vue';
import BottomToolbar from './BottomToolbar.vue';
import BottomLeftControls from './BottomLeftControls.vue';
import VectorCanvas from '@/canvas/components/VectorCanvas.vue';
import { useCanvasStore } from '@/stores/canvas';
import { useToolsStore } from '@/stores/tools';
import HotkeysHelp from './HotkeysHelp.vue';
import { getDigitShortcutTool } from '@/config/tools';
import {
    FOCUS_MODE_SHORTCUT,
    UNDO_SHORTCUT_CODE,
    getCtrlCommandByCode,
    getZoomCommandByCode,
    type EditorMappedCtrlCommand,
} from '@/config/hotkeys';

const canvasStore = useCanvasStore();
const toolsStore = useToolsStore();
const isInspectorOpen = ref(true);
const isFocusMode = ref(false);

function isEditableElement(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return (
        target.isContentEditable ||
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
    );
}

const CTRL_COMMAND_HANDLERS: Readonly<
    Record<EditorMappedCtrlCommand, () => void>
> = {
    redo: () => {
        if (canvasStore.canRedo) canvasStore.redo();
    },
    duplicate: () => {
        canvasStore.duplicateSelectedShape();
    },
    copy: () => {
        canvasStore.copySelectedShape();
    },
    paste: () => {
        canvasStore.pasteShape();
    },
};

const ZOOM_COMMAND_HANDLERS: Readonly<Record<'in' | 'out', () => void>> = {
    in: () => {
        canvasStore.zoomIn();
    },
    out: () => {
        canvasStore.zoomOut();
    },
};

function handleFocusModeShortcut(event: KeyboardEvent): boolean {
    if (
        event.code !== FOCUS_MODE_SHORTCUT.code ||
        event.shiftKey !== FOCUS_MODE_SHORTCUT.requiresShift
    ) {
        return false;
    }

    event.preventDefault();
    isFocusMode.value = !isFocusMode.value;
    return true;
}

function handleToolShortcut(event: KeyboardEvent): boolean {
    const shortcutTool = getDigitShortcutTool(event.code);
    if (!shortcutTool) return false;

    event.preventDefault();
    toolsStore.setActiveTool(shortcutTool);
    return true;
}

function handleZoomShortcut(event: KeyboardEvent): boolean {
    const zoomCommand = getZoomCommandByCode(event.code);
    if (!zoomCommand) return false;

    event.preventDefault();
    ZOOM_COMMAND_HANDLERS[zoomCommand]();
    return true;
}

function handleCtrlShortcut(event: KeyboardEvent): boolean {
    // Используем e.code, чтобы горячие клавиши были независимы от раскладки
    if (event.code === UNDO_SHORTCUT_CODE) {
        event.preventDefault();

        if (event.shiftKey) {
            if (canvasStore.canRedo) canvasStore.redo();
        } else if (canvasStore.canUndo) {
            canvasStore.undo();
        }

        return true;
    }

    const ctrlCommand = getCtrlCommandByCode(event.code);
    if (!ctrlCommand) return false;

    event.preventDefault();
    CTRL_COMMAND_HANDLERS[ctrlCommand]();
    return true;
}

function handleKeydown(event: KeyboardEvent) {
    if (handleFocusModeShortcut(event)) {
        return;
    }

    if (isEditableElement(event.target)) return;

    if (!(event.ctrlKey || event.metaKey)) {
        handleToolShortcut(event);
        handleZoomShortcut(event);
        return;
    }

    handleCtrlShortcut(event);
}

onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.editor {
    height: 100vh;
    width: 100%;
}

.stage {
    position: relative;
    height: 100%;
    width: 100%;
    background: #ffffff;
    overflow: hidden;
}

.canvasRoot {
    position: absolute;
    inset: 0;
}

.topLeft {
    position: absolute;
    top: 14px;
    left: 14px;
}

.bottomCenter {
    position: absolute;
    left: 50%;
    bottom: 14px;
    transform: translateX(-50%);
}

.bottomLeft {
    position: absolute;
    left: 14px;
    bottom: 14px;
}

.rightPanelWrap {
    position: absolute;
    top: 50%;
    right: 18px;
    transform: translateY(-50%);
    transition: transform 0.25s ease;
}

.rightPanelWrap.closed {
    transform: translateY(-50%) translateX(248px);
}

.rightPanel {
    position: relative;
}

.toggleInspectorBtn {
    position: absolute;
    left: -28px;
    top: 50%;
    transform: translateY(-50%);

    width: 28px;
    height: 56px;

    border: 1px solid #e5e7eb;
    border-right: none;
    border-radius: 10px 0 0 10px;

    background: #ffffff;
    color: #6b7280;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;

    display: flex;
    align-items: center;
    justify-content: center;

    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
    z-index: 2;
}

.toggleInspectorBtn:hover {
    background: #f9fafb;
    color: #111827;
}
</style>
