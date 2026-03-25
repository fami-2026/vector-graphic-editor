import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToolType =
    | 'select'
    | 'hand'
    | 'rect'
    | 'circle'
    | 'line'
    | 'triangle'
    | 'polygon'
    | 'star'
    | 'hexagon'
    | 'arrow'
    | 'eraser'
    | 'pencil';

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

        if (tool === 'select' || tool === 'hand' || tool === 'eraser') {
            creationParams.value = null;
        }
    }

    function setCreationParams(params: CreationParams) {
        creationParams.value = params;
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
        pencilDefaults,
        setPencilDefaults,
    };
});
