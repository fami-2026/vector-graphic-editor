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
    | 'parallelogram'
    | 'arrow'
    | 'eraser'
    | 'pencil';

export const TOOLS_WITHOUT_CREATION_PARAMS = new Set<ToolType>([
    'select',
    'hand',
    'eraser',
]);

export const SHAPE_CREATION_TOOLS: ReadonlyArray<ToolType> = [
    'rect',
    'circle',
    'line',
    'triangle',
    'parallelogram',
    'polygon',
    'star',
    'hexagon',
    'arrow',
];

export const POLYGON_SIDES_LIMITS = {
    min: 3,
    max: 20,
    defaultValue: 5,
} as const;

export const TOOL_TITLES: Readonly<Record<ToolType, string>> = {
    select: 'Курсор',
    hand: 'Рука',
    rect: 'Прямоугольник',
    circle: 'Круг',
    line: 'Линия',
    triangle: 'Треугольник',
    polygon: 'Многоугольник',
    star: 'Звезда',
    hexagon: 'Шестиугольник',
    parallelogram: 'Параллелограмм',
    arrow: 'Стрелка',
    eraser: 'Ластик',
    pencil: 'Карандаш',
};

export function getToolTitle(tool: ToolType): string {
    return TOOL_TITLES[tool] ?? tool;
}

export type ToolbarToolClickMode = 'activate' | 'polygon-dialog';

export const TOOLBAR_TOOLS = [
    { id: 'hand', tool: 'hand' },
    { id: 'cursor', tool: 'select' },
    { id: 'line', tool: 'line' },
    { id: 'rect', tool: 'rect' },
    { id: 'circle', tool: 'circle' },
    { id: 'triangle', tool: 'triangle' },
    { id: 'polygon', tool: 'polygon', clickMode: 'polygon-dialog' },
    { id: 'star', tool: 'star' },
    { id: 'hexagon', tool: 'hexagon' },
    { id: 'parallelogram', tool: 'parallelogram' },
    { id: 'arrow', tool: 'arrow' },
    { id: 'eraser', tool: 'eraser' },
    { id: 'pencil', tool: 'pencil' },
] as const satisfies ReadonlyArray<{
    id: string;
    tool: ToolType;
    clickMode?: ToolbarToolClickMode;
}>;

export type ToolbarToolId = (typeof TOOLBAR_TOOLS)[number]['id'];
export type ToolbarToolMeta = (typeof TOOLBAR_TOOLS)[number];

const TOOLBAR_TOOL_ID_BY_TOOL_MAP = {} as Record<ToolType, ToolbarToolId>;

TOOLBAR_TOOLS.forEach(({ id, tool }) => {
    TOOLBAR_TOOL_ID_BY_TOOL_MAP[tool] = id;
});

export const TOOLBAR_TOOL_ID_BY_TOOL: Readonly<
    Record<ToolType, ToolbarToolId>
> = TOOLBAR_TOOL_ID_BY_TOOL_MAP;

const DIGIT_TOOL_SHORTCUTS_MAP = {
    Digit1: 'select',
    Digit2: 'line',
    Digit3: 'rect',
    Digit4: 'circle',
    Digit5: 'triangle',
    Digit6: 'polygon',
    Digit7: 'star',
    Digit8: 'hexagon',
    Digit9: 'arrow',
    Digit0: 'eraser',
} as const satisfies Record<string, ToolType>;

export const DIGIT_TOOL_SHORTCUTS = DIGIT_TOOL_SHORTCUTS_MAP;

export function getDigitShortcutTool(code: string): ToolType | null {
    const tool =
        DIGIT_TOOL_SHORTCUTS[code as keyof typeof DIGIT_TOOL_SHORTCUTS];
    return tool ?? null;
}

export const DIGIT_SHORTCUTS_HELP: ReadonlyArray<{
    key: string;
    tool: ToolType;
}> = [
    { key: '1', tool: DIGIT_TOOL_SHORTCUTS.Digit1 },
    { key: '2', tool: DIGIT_TOOL_SHORTCUTS.Digit2 },
    { key: '3', tool: DIGIT_TOOL_SHORTCUTS.Digit3 },
    { key: '4', tool: DIGIT_TOOL_SHORTCUTS.Digit4 },
    { key: '5', tool: DIGIT_TOOL_SHORTCUTS.Digit5 },
    { key: '6', tool: DIGIT_TOOL_SHORTCUTS.Digit6 },
    { key: '7', tool: DIGIT_TOOL_SHORTCUTS.Digit7 },
    { key: '8', tool: DIGIT_TOOL_SHORTCUTS.Digit8 },
    { key: '9', tool: DIGIT_TOOL_SHORTCUTS.Digit9 },
    { key: '0', tool: DIGIT_TOOL_SHORTCUTS.Digit0 },
];
