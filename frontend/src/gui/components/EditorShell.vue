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

function handleKeydown(e: KeyboardEvent) {
    if (e.code === 'Space' && e.shiftKey) {
        e.preventDefault();
        isFocusMode.value = !isFocusMode.value;
        return;
    }

    if (isEditableElement(e.target)) return;

    const isCtrl = e.ctrlKey || e.metaKey;

    if (!isCtrl) {
        if (!isEditableElement(e.target)) {
            switch (e.code) {
                case 'Digit1':
                    e.preventDefault();
                    toolsStore.setActiveTool('select');
                    break;
                case 'Digit2':
                    e.preventDefault();
                    toolsStore.setActiveTool('line');
                    break;
                case 'Digit3':
                    e.preventDefault();
                    toolsStore.setActiveTool('rect');
                    break;
                case 'Digit4':
                    e.preventDefault();
                    toolsStore.setActiveTool('circle');
                    break;
                case 'Digit5':
                    e.preventDefault();
                    toolsStore.setActiveTool('triangle');
                    break;
                case 'Digit6':
                    e.preventDefault();
                    toolsStore.setActiveTool('polygon');
                    break;
                case 'Digit7':
                    e.preventDefault();
                    toolsStore.setActiveTool('star');
                    break;
                case 'Digit8':
                    e.preventDefault();
                    toolsStore.setActiveTool('hexagon');
                    break;
                case 'Digit9':
                    e.preventDefault();
                    toolsStore.setActiveTool('arrow');
                    break;
                case 'Digit0':
                    e.preventDefault();
                    toolsStore.setActiveTool('eraser');
                    break;
            }
        }

        if (e.code === 'Equal' || e.code === 'NumpadAdd') {
            e.preventDefault();
            canvasStore.zoomIn();
        } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
            e.preventDefault();
            canvasStore.zoomOut();
        }
        return;
    }

    // Используем e.code, чтобы горячие клавиши были независимы от раскладки
    if (e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) {
            if (canvasStore.canRedo) canvasStore.redo();
        } else {
            if (canvasStore.canUndo) canvasStore.undo();
        }
    } else if (e.code === 'KeyY') {
        e.preventDefault();
        if (canvasStore.canRedo) canvasStore.redo();
    }
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
