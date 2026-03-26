<template>
    <div class="wrap">
        <button
            class="helpBtn"
            type="button"
            title="Горячие клавиши"
            @click="isOpen = !isOpen"
        >
            ?
        </button>

        <div v-if="isOpen" class="popup">
            <h4 class="title">Горячие клавиши</h4>

            <div class="columns">
                <div class="column">
                    <h5 class="columnTitle">Инструменты</h5>
                    <ul class="list">
                        <li v-for="shortcut in toolShortcuts" :key="shortcut.key">
                            <span>{{ shortcut.key }}</span> — {{ shortcut.title }}
                        </li>
                    </ul>
                </div>

                <div class="column">
                    <h5 class="columnTitle">Другое</h5>
                    <ul class="list">
                        <li
                            v-for="shortcut in GENERAL_SHORTCUTS_HELP"
                            :key="shortcut.key"
                        >
                            <span>{{ shortcut.key }}</span> —
                            {{ shortcut.description }}
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { DIGIT_SHORTCUTS_HELP, getToolTitle } from '@/config/tools';
import { GENERAL_SHORTCUTS_HELP } from '@/config/hotkeys';

const isOpen = ref(false);

const toolShortcuts = computed(() =>
    DIGIT_SHORTCUTS_HELP.map((shortcut) => ({
        key: shortcut.key,
        title: getToolTitle(shortcut.tool).toLowerCase(),
    }))
);
</script>

<style scoped>
.wrap {
    position: absolute;
    right: 28px;
    bottom: 14px;
    z-index: 30;
}

.helpBtn {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    font-size: 20px;
    font-weight: 700;
    cursor: pointer;

    display: flex;
    align-items: center;
    justify-content: center;

    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

.popup {
    position: absolute;
    right: 0;
    bottom: 54px;

    width: 420px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 10px;

    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.15);
}

.title {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 700;
}

.columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
}

.column {
    display: grid;
    gap: 8px;
}

.columnTitle {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
}

.list {
    list-style: none;
    padding: 0;
    margin: 0;

    display: grid;
    gap: 6px;
}

.list li {
    font-size: 12px;
    line-height: 1.35;
    color: #374151;
}

.list span {
    font-weight: 600;
    margin-right: 6px;
    font-weight: 600;
    color: #111827;
}
</style>