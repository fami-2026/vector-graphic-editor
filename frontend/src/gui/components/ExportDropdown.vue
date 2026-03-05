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
                @click="pick('png')"
            >
                PNG
            </button>
            <button
                class="item"
                role="menuitem"
                type="button"
                @click="pick('svg')"
            >
                SVG
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

type ExportFormat = 'png' | 'svg';

const open = ref(false);
const root = ref<HTMLElement | null>(null);

function toggle() {
    open.value = !open.value;
}

function close() {
    open.value = false;
}

function pick(format: ExportFormat) {
    console.log('export:', format);
    close();
}

function onDocPointerDown(e: PointerEvent) {
    const el = root.value;
    if (!el) return;
    if (e.target instanceof Node && !el.contains(e.target)) close();
}

function onDocKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
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
</style>
