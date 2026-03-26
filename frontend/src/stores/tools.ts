import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
    type ToolType,
    TOOLS_WITHOUT_CREATION_PARAMS,
} from '@/config/tools';

export type { ToolType };

type CreationParams = Record<string, unknown> | null;

type PencilDefaults = {
    stroke: string;
    strokeOpacity: number;
    strokeWidth: number;
};

/**
 * Хранилище состояния активного инструмента редактора.
 */
export const useToolsStore = defineStore('tools', () => {
    const activeTool = ref<ToolType>('select');
    const creationParams = ref<CreationParams>(null);

    const pencilDefaults = ref<PencilDefaults>({
        stroke: '#2c3e50',
        strokeOpacity: 1,
        strokeWidth: 2,
    });

    function setActiveTool(tool: ToolType) {
        activeTool.value = tool;

        if (TOOLS_WITHOUT_CREATION_PARAMS.has(tool)) {
            clearCreationParams();
        }
    }

    function setCreationParams(params: CreationParams) {
        creationParams.value = params;
    }

    function clearCreationParams() {
        creationParams.value = null;
    }

    function setPencilDefaults(updates: Partial<PencilDefaults>) {
        pencilDefaults.value = {
            ...pencilDefaults.value,
            ...updates,
        };
    }

    return {
        activeTool,
        setActiveTool,
        creationParams,
        setCreationParams,
        clearCreationParams,
        pencilDefaults,
        setPencilDefaults,
    };
});
