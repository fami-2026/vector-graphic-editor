import type { Point } from '@/canvas/types';

export interface ShapeParams extends Record<string, unknown> {
    sides?: number;
    width?: number;
    height?: number;
    radius?: number;
    fill?: string;
    fillOpacity?: number;
    stroke?: string;
    strokeOpacity?: number;
    strokeWidth?: number;
    rotation?: number;
}

export type SerializedShapeBase = {
    type: string;
    id: string;
    position: { x: number; y: number };
    rotation: number;
    scaleX: number;
    scaleY: number;
    skewX: number;
    skewY: number;
};

export type SerializedShape = SerializedShapeBase & Record<string, unknown>;

export type SceneSnapshot = {
    shapes: SerializedShape[];
    selectedId: string | null;
};

export type CanvasStorageData = {
    documentId: string;
    isOfflineMode: boolean;
    shapes: SerializedShape[];
    selectedId: string | null;
    selectedIds?: string[];
    selectionRect?: { start: Point; end: Point } | null;
    zoom: number;
    pan: { x: number; y: number };
    backgroundColor?: string;
};

export type VectorEditorExport = {
    format: 'vector-editor';
    version: 1;
    exportedAt: string;
    backgroundColor: string;
    scene: SceneSnapshot;
};
