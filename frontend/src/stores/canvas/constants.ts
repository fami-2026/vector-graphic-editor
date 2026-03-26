export const HISTORY_LIMIT = 50;
export const CONTINUOUS_CHANGE_TIMEOUT_MS = 700;
export const SYNC_DOCUMENT_DEBOUNCE_MS = 400;

export const CANVAS_VIEWPORT_LIMITS = {
    minZoom: 10,
    maxZoom: 500,
    zoomStep: 10,
} as const;

export const CANVAS_DEFAULTS = {
    documentId: '0',
    zoom: 100,
    pan: { x: 0, y: 0 },
    backgroundColor: '#ffffff',
};

export const CANVAS_STORAGE_KEYS = {
    scene: 'vector-editor-canvas',
    backgroundColor: 'canvas-bg-color',
} as const;

export const SHAPE_CLONE_OFFSET = {
    x: 20,
    y: 20,
} as const;

export const SHAPE_COPY_SUFFIX = ' копия';
