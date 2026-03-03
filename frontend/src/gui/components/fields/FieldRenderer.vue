<script setup lang="ts">
import { computed } from 'vue';
import type { BaseField } from './base/BaseField';
import type { PropertyDescriptor } from '@/canvas/types/property';

const props = defineProps<{
    field: BaseField;
    descriptor: PropertyDescriptor;
    modelValue: unknown;
    readonly?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: unknown): void;
}>();

const RenderComp = computed(() => props.field.renderComponent);
</script>

<template>
    <RenderComp
        :model-value="modelValue"
        :descriptor="descriptor"
        :readonly="readonly ?? false"
        @update:model-value="emit('update:modelValue', $event)"
    />
</template>
