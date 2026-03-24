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

/**
 * Хранилище состояния активного инструмента редактора.
 */
export const useToolsStore = defineStore('tools', () => {
    const activeTool = ref<ToolType>('select');
    const creationParams = ref<CreationParams>(null);

    function setActiveTool(tool: ToolType) {
        activeTool.value = tool;

        if (tool === 'select' || tool === 'hand' || tool === 'eraser') {
            creationParams.value = null;
        }
    }

    function setCreationParams(params: CreationParams) {
        creationParams.value = params;
    }

    return { activeTool, setActiveTool, creationParams, setCreationParams };
});
