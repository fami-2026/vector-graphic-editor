<script setup lang="ts">
import type { PropertyDescriptor } from '@/canvas/types/property';

defineProps<{
    modelValue: string | null;
    descriptor: PropertyDescriptor;
    readonly?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
}>();
</script>

<template>
    <input
        type="color"
        :value="modelValue ?? '#000000'"
        :disabled="readonly"
        @input="
            emit(
                'update:modelValue',
                ($event.target as HTMLInputElement)?.value
            )
        "
    />
</template>

<style scoped>
input[type='color'] {
    height: 36px;
    padding: 2px;
    width: 100%;
    cursor: pointer;
}
</style>
