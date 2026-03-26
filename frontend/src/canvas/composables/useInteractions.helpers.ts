import type { BoundingBox, LineShape, Point, Shape } from '@/canvas/types';
import { SELECTION_PADDING } from '@/canvas/types';

export type ResizeHandle =
    | 'l'
    | 'r'
    | 't'
    | 'b'
    | 'lt'
    | 'rt'
    | 'lb'
    | 'rb'
    | 's'
    | 'e'
    | 'rot';

/**
 * Определяет активный хэндл изменения размера/поворота по позиции курсора.
 * Для линии используются только старт/эндпоинт, для остальных фигур — углы и грани bbox.
 */
export function detectResizeHandle(
    shape: Shape,
    globalPoint: Point,
    zoom: number
): ResizeHandle | null {
    const zoomCoef = 100 / zoom;
    const cornerRadius = 8 * zoomCoef;
    const edgeRadius = 4 * zoomCoef;

    if (shape.type === 'line') {
        const line = shape as LineShape;
        if (!line.localEndPoint) return null;

        const vPt = line.toVLocalPoint(globalPoint);

        const ex = line.localEndPoint.x * line.scaleX;
        const ey = line.localEndPoint.y * line.scaleY;

        const distS = Math.hypot(vPt.x, vPt.y);
        const distE = Math.hypot(vPt.x - ex, vPt.y - ey);

        if (distS <= cornerRadius && distS <= distE) return 's';
        if (distE <= cornerRadius) return 'e';

        return null;
    }

    const box = shape.getLocalBox();
    const pad = SELECTION_PADDING * zoomCoef;

    const minX = box.minX - pad;
    const maxX = box.maxX + pad;
    const minY = box.minY - pad;
    const maxY = box.maxY + pad;

    const x1 = box.minX * shape.scaleX;
    const y1 = box.minY * shape.scaleY;
    const x2 = box.maxX * shape.scaleX;
    const y2 = box.maxY * shape.scaleY;
    const rawX = Math.min(x1, x2);
    const rawY = Math.min(y1, y2);
    const rawW = Math.abs(x2 - x1);
    const rawH = Math.abs(y2 - y1);
    const rectX = rawX - pad;
    const rectY = rawY - pad;
    const rectW = rawW + pad * 2;
    const rectH = rawH + pad * 2;
    const visualRotY = rectY - 20 * zoomCoef;

    const hX1 = rectX;
    const hY1 = rectY;
    const hX2 = rectX + rectW;
    const hY2 = rectY + rectH;
    const vMatrix = shape.getVMatrix();

    const handles: Array<[ResizeHandle, number, number]> = [
        ['rot', 0, visualRotY],
        ['lt', hX1, hY1],
        ['rt', hX2, hY1],
        ['rb', hX2, hY2],
        ['lb', hX1, hY2],
    ];

    let closestHandle: ResizeHandle | null = null;
    let closestDistance = cornerRadius;

    handles.forEach(([handle, x, y]) => {
        const p = new DOMPoint(x, y).matrixTransform(vMatrix);
        const dist = Math.hypot(globalPoint.x - p.x, globalPoint.y - p.y);
        if (dist <= closestDistance) {
            closestDistance = dist;
            closestHandle = handle;
        }
    });

    if (closestHandle) return closestHandle;

    const localPoint = shape.toLocalPoint(globalPoint);

    const dxMin = Math.abs(localPoint.x - minX);
    const dxMax = Math.abs(localPoint.x - maxX);
    const dyMin = Math.abs(localPoint.y - minY);
    const dyMax = Math.abs(localPoint.y - maxY);

    const inX = localPoint.x >= minX && localPoint.x <= maxX;
    const inY = localPoint.y >= minY && localPoint.y <= maxY;

    let minE = edgeRadius;
    let closestEdge: ResizeHandle | null = null;

    if (inY) {
        if (dxMin <= minE) {
            minE = dxMin;
            closestEdge = 'l';
        }
        if (dxMax <= minE) {
            minE = dxMax;
            closestEdge = 'r';
        }
    }
    if (inX) {
        if (dyMin <= minE) {
            minE = dyMin;
            closestEdge = 't';
        }
        if (dyMax <= minE) {
            minE = dyMax;
            closestEdge = 'b';
        }
    }

    return closestEdge;
}

const GLOBAL_CURSOR_MAP: Readonly<Record<string, string>> = {
    t: 'ns-resize',
    b: 'ns-resize',
    l: 'ew-resize',
    r: 'ew-resize',
    lt: 'nwse-resize',
    rb: 'nwse-resize',
    rt: 'nesw-resize',
    lb: 'nesw-resize',
};

const HANDLE_ANGLES: Readonly<Partial<Record<ResizeHandle, number>>> = {
    t: 0,
    rt: 45,
    r: 90,
    rb: 135,
    b: 180,
    lb: 225,
    l: 270,
    lt: 315,
};

const ROTATED_CURSOR_SEQUENCE = [
    'ns-resize',
    'nesw-resize',
    'ew-resize',
    'nwse-resize',
    'ns-resize',
    'nesw-resize',
    'ew-resize',
    'nwse-resize',
] as const;

export function getGlobalCursorStyle(handle: string): string {
    return GLOBAL_CURSOR_MAP[handle] ?? 'default';
}

/**
 * Возвращает курсор для конкретного хэндла с учетом текущего поворота и отражения фигуры.
 */
export function getCursorStyle(handle: string, shape: Shape): string {
    if (handle === 's' || handle === 'e') return 'crosshair';
    if (handle === 'rot') return 'grabbing';

    let baseAngle = HANDLE_ANGLES[handle as ResizeHandle];
    if (baseAngle === undefined) return 'default';

    if (shape.scaleX < 0) baseAngle = (360 - baseAngle) % 360;
    if (shape.scaleY < 0) baseAngle = (180 - baseAngle + 360) % 360;

    const totalAngle = (baseAngle + shape.rotation) % 360;
    const index = Math.round(totalAngle / 45) % 8;

    return ROTATED_CURSOR_SEQUENCE[index] ?? 'default';
}

export function getSelectionBox(
    selectionRect: { start: Point; end: Point } | null,
    selectedCount: number
): BoundingBox | null {
    if (!selectionRect || selectedCount === 0) return null;

    return {
        minX: Math.min(selectionRect.start.x, selectionRect.end.x),
        minY: Math.min(selectionRect.start.y, selectionRect.end.y),
        maxX: Math.max(selectionRect.start.x, selectionRect.end.x),
        maxY: Math.max(selectionRect.start.y, selectionRect.end.y),
    };
}

/**
 * Выполняет hit-test по рамке мультивыделения: определяет хэндл ресайза и попадание внутрь.
 */
export function hitTestSelectionBox(
    point: Point,
    selectionBox: BoundingBox | null,
    zoom: number
): {
    handle: ResizeHandle | null;
    isInside: boolean;
} {
    if (!selectionBox) return { handle: null, isInside: false };

    const zoomCoef = 100 / zoom;
    const padding = SELECTION_PADDING * zoomCoef;

    const cornerRadius = 8 * zoomCoef;
    const edgeRadius = 4 * zoomCoef;

    const minX = selectionBox.minX - padding;
    const maxX = selectionBox.maxX + padding;
    const minY = selectionBox.minY - padding;
    const maxY = selectionBox.maxY + padding;

    const inX = point.x >= minX && point.x <= maxX;
    const inY = point.y >= minY && point.y <= maxY;
    const isInside = inX && inY;

    const dxMin = Math.abs(point.x - minX);
    const dxMax = Math.abs(point.x - maxX);
    const dyMin = Math.abs(point.y - minY);
    const dyMax = Math.abs(point.y - maxY);

    const dLT = Math.hypot(dxMin, dyMin);
    const dRT = Math.hypot(dxMax, dyMin);
    const dLB = Math.hypot(dxMin, dyMax);
    const dRB = Math.hypot(dxMax, dyMax);

    let minC = cornerRadius;
    let closestCorner: ResizeHandle | null = null;

    if (dLT <= minC) {
        minC = dLT;
        closestCorner = 'lt';
    }
    if (dRT <= minC) {
        minC = dRT;
        closestCorner = 'rt';
    }
    if (dLB <= minC) {
        minC = dLB;
        closestCorner = 'lb';
    }
    if (dRB <= minC) {
        minC = dRB;
        closestCorner = 'rb';
    }

    if (closestCorner) return { handle: closestCorner, isInside: false };

    let minE = edgeRadius;
    let closestEdge: ResizeHandle | null = null;

    if (inY) {
        if (dxMin <= minE) {
            minE = dxMin;
            closestEdge = 'l';
        }
        if (dxMax <= minE) {
            minE = dxMax;
            closestEdge = 'r';
        }
    }
    if (inX) {
        if (dyMin <= minE) {
            minE = dyMin;
            closestEdge = 't';
        }
        if (dyMax <= minE) {
            minE = dyMax;
            closestEdge = 'b';
        }
    }

    return { handle: closestEdge, isInside };
}
