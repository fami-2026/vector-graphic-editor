export type EditorCtrlCommand =
    | 'undo'
    | 'redo'
    | 'duplicate'
    | 'copy'
    | 'paste';

export type EditorMappedCtrlCommand = Exclude<EditorCtrlCommand, 'undo'>;

export const FOCUS_MODE_SHORTCUT = {
    code: 'Space',
    requiresShift: true,
} as const;

const ZOOM_COMMAND_BY_CODE = {
    Equal: 'in',
    NumpadAdd: 'in',
    Minus: 'out',
    NumpadSubtract: 'out',
} as const;

export function getZoomCommandByCode(code: string): 'in' | 'out' | null {
    const zoomCommand = ZOOM_COMMAND_BY_CODE[
        code as keyof typeof ZOOM_COMMAND_BY_CODE
    ];
    return zoomCommand ?? null;
}

export const UNDO_SHORTCUT_CODE = 'KeyZ';

const CTRL_COMMAND_BY_CODE = {
    KeyY: 'redo',
    KeyD: 'duplicate',
    KeyC: 'copy',
    KeyV: 'paste',
} as const satisfies Record<string, EditorMappedCtrlCommand>;

export function getCtrlCommandByCode(code: string): EditorMappedCtrlCommand | null {
    const command = CTRL_COMMAND_BY_CODE[
        code as keyof typeof CTRL_COMMAND_BY_CODE
    ];
    return command ?? null;
}

export const GENERAL_SHORTCUTS_HELP: ReadonlyArray<{
    key: string;
    description: string;
}> = [
    { key: '+', description: 'увеличить масштаб' },
    { key: '-', description: 'уменьшить масштаб' },
    { key: 'Ctrl + C', description: 'копировать фигуру' },
    { key: 'Ctrl + V', description: 'вставить фигуру' },
    { key: 'Ctrl + D', description: 'дублировать фигуру' },
    { key: 'Delete', description: 'удалить фигуру' },
    { key: 'Ctrl + Z', description: 'отмена' },
    { key: 'Ctrl + Shift + Z', description: 'повтор' },
    {
        key: 'Shift + Space',
        description: 'скрыть / показать рабочую область',
    },
];
