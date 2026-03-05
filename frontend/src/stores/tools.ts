import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToolType =
    | 'select'
    | 'rect'
    | 'circle'
    | 'line'
    | 'triangle'
    | 'polygon'
    | 'star'
    | 'hexagon'
    | 'arrow'
    | 'eraser';

/**
 * Хранилище состояния активного инструмента редактора.
 */
export const useToolsStore = defineStore('tools', () => {
    const activeTool = ref<ToolType>('select');

    function setActiveTool(tool: ToolType) {
        activeTool.value = tool;
    }

    return { activeTool, setActiveTool };
});
