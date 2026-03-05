<template>
    <div class="topLeftActions">
        <button class="primaryBtn" type="button">Импорт</button>
        <ExportDropdown />
    </div>
</template>

<script setup lang="ts">
import ExportDropdown from './ExportDropdown.vue';
</script>

<style scoped>
.topLeftActions {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.primaryBtn {
    background: #2563eb;
    color: #ffffff;
    border: 0;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.1);
}
.primaryBtn:hover {
    background: #1d4ed8;
}
</style>
