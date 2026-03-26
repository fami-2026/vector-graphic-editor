import type { Shape, Point } from '@/canvas/types';
import { getShapeLabel } from '@/config/shapeLabels';

export type ExportFormat = 'png' | 'svg';
export type ExportArea = 'scene' | 'region';
export type PngScale = 1 | 2 | 3;
export type ExportBackground = 'transparent' | 'white' | string;

export interface ExportSceneSize {
    width: number;
    height: number;
}

export interface ExportOptions {
    format: ExportFormat;
    fileName: string;
    area: ExportArea;
    shapes: Shape[];
    selectedId: string | null;
    sceneSize: ExportSceneSize;
    pngScale?: PngScale;
    background?: ExportBackground;
    regionBounds?: { x: number; y: number; width: number; height: number };
}

interface ExportBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ExportTarget {
    shapes: Shape[];
    bounds: ExportBounds;
}

const ILLEGAL_FILENAME_CHARS = /[<>:"/\\|?*]/g;
const CONTROL_CHARS = /\p{Cc}/gu;

export function sanitizeFileName(name: string): string {
    const cleaned = name
        .replace(/\.[a-zA-Z0-9]+$/, '')
        .replace(ILLEGAL_FILENAME_CHARS, '_')
        .replace(CONTROL_CHARS, '_')
        .trim()
        .replace(/\s+/g, ' ');

    return cleaned || 'vector-export';
}

export function buildDefaultFileName(
    format: ExportFormat,
    baseName = 'vector'
): string {
    const now = new Date();
    const date = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
    ].join('-');
    const time = [
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0'),
        String(now.getMilliseconds()).padStart(3, '0'),
    ].join('-');

    return `${sanitizeFileName(baseName)}-${date}-${time}.${format}`;
}

export async function exportScene(options: ExportOptions): Promise<void> {
    const target = resolveExportTarget(options);
    if (!target) {
        throw new Error('Нет фигур для экспорта.');
    }

    if (options.shapes.length > 0) {
        validateShapeBounds(options.shapes);
    }

    const fileName = ensureExtension(options.fileName, options.format);

    if (options.format === 'svg') {
        await exportSvg(target, fileName, options);
    } else {
        await exportPng(target, fileName, options);
    }
}

function resolveExportTarget(options: ExportOptions): ExportTarget | null {
    if (options.area === 'region') {
        if (!options.regionBounds) return null;
        const { x, y, width, height } = options.regionBounds;
        return {
            shapes: options.shapes,
            bounds: {
                x,
                y,
                width: Math.max(1, width),
                height: Math.max(1, height),
            },
        };
    }

    if (options.shapes.length === 0) return null;

    const bounds = getTotalBounds(options.shapes);

    return {
        shapes: options.shapes,
        bounds: bounds,
    };
}

function resolveBackgroundFill(background: ExportBackground): string | null {
    if (background === 'transparent') {
        return null;
    }

    if (background === 'white') {
        return '#ffffff';
    }

    return background;
}

async function exportPng(
    target: ExportTarget,
    fileName: string,
    options: ExportOptions
): Promise<void> {
    const scale = options.pngScale ?? 1;
    const background = options.background ?? 'transparent';
    const backgroundFill = resolveBackgroundFill(background);

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(target.bounds.width * scale));
    canvas.height = Math.max(1, Math.round(target.bounds.height * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error(
            'Не удалось получить контекст canvas для PNG-экспорта.'
        );
    }

    ctx.scale(scale, scale);

    if (backgroundFill) {
        ctx.fillStyle = backgroundFill;
        ctx.fillRect(0, 0, target.bounds.width, target.bounds.height);
    }

    ctx.translate(-target.bounds.x, -target.bounds.y);

    for (const shape of target.shapes) {
        ctx.save();
        shape.render(ctx);
        ctx.restore();
    }

    const blob = await canvasToBlob(canvas, 'image/png');
    triggerDownload(blob, fileName);
}

async function exportSvg(
    target: ExportTarget,
    fileName: string,
    options: ExportOptions
): Promise<void> {
    const background = options.background ?? 'transparent';
    const { width, height } = target.bounds;

    const svgParts: string[] = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    ];

    if (background !== 'transparent') {
        svgParts.push(
            `  <rect x="0" y="0" width="${width}" height="${height}" fill="${background === 'white' ? '#ffffff' : background}"/>`
        );
    }

    svgParts.push(
        `  <g transform="translate(${-target.bounds.x}, ${-target.bounds.y})">`
    );

    for (const shape of target.shapes) {
        const svgElement = shapeToSvgElement(shape);
        if (svgElement) {
            svgParts.push(`    ${svgElement}`);
        }
    }

    svgParts.push(`  </g>`);
    svgParts.push(`</svg>`);

    const svgContent = svgParts.join('\n');
    const blob = new Blob([svgContent], {
        type: 'image/svg+xml;charset=utf-8',
    });
    triggerDownload(blob, fileName);
}

type SvgShapeAccess = Shape & {
    width?: number;
    height?: number;
    radiusX?: number;
    radiusY?: number;
    fill?: string;
    fillOpacity?: number;
    stroke?: string;
    strokeOpacity?: number;
    strokeWidth?: number;
    localEndPoint?: Point;
    points?: Point[];
    getLocalPoints?: () => Point[];
    getLocalArrowPoints?: () => Point[];
    getScaledLocalArrowPoints?: () => Point[];
};

type SvgRendererContext = {
    shape: Shape;
    access: SvgShapeAccess;
    transform: string;
    style: string;
};

type SvgShapeRenderer = (ctx: SvgRendererContext) => string | null;

function pointsToSvgString(points: Point[]): string {
    return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function renderPolygonSvg(
    points: Point[] | null,
    transform: string,
    style: string
): string | null {
    if (!points || points.length < 3) return null;
    return `<polygon points="${pointsToSvgString(points)}"${transform}${style} stroke-linejoin="round"/>`;
}

function getScaledArrowPoints(shape: Shape, access: SvgShapeAccess): Point[] | null {
    if (access.getScaledLocalArrowPoints) {
        return access.getScaledLocalArrowPoints();
    }

    if (!access.getLocalArrowPoints) {
        return null;
    }

    return access.getLocalArrowPoints().map((point) => ({
        x: point.x * shape.scaleX,
        y: point.y * shape.scaleY,
    }));
}

function getParallelogramPoints(
    shape: Shape,
    access: SvgShapeAccess
): Point[] | null {
    const rawPoints = access.getLocalPoints?.() ?? null;
    if (!rawPoints || rawPoints.length < 3) {
        return null;
    }

    const signX = Math.sign(shape.scaleX) || 1;
    const signY = Math.sign(shape.scaleY) || 1;

    return rawPoints.map((point) => ({
        x: point.x * signX,
        y: point.y * signY,
    }));
}

const SVG_SHAPE_RENDERERS: Readonly<Record<string, SvgShapeRenderer>> = {
    rect: ({ shape, access, transform, style }) => {
        const width = typeof access.width === 'number' ? access.width : 0;
        const height = typeof access.height === 'number' ? access.height : 0;
        const renderedWidth = Math.abs(width * shape.scaleX);
        const renderedHeight = Math.abs(height * shape.scaleY);
        const x = -renderedWidth / 2;
        const y = -renderedHeight / 2;

        return `<rect x="${x}" y="${y}" width="${renderedWidth}" height="${renderedHeight}"${transform}${style}/>`;
    },
    circle: ({ shape, access, transform, style }) => {
        const radiusX = typeof access.radiusX === 'number' ? access.radiusX : 0;
        const radiusY = typeof access.radiusY === 'number' ? access.radiusY : 0;
        const rx = Math.abs(radiusX * shape.scaleX);
        const ry = Math.abs(radiusY * shape.scaleY);

        return `<ellipse cx="0" cy="0" rx="${rx}" ry="${ry}"${transform}${style}/>`;
    },
    triangle: ({ access, transform, style }) =>
        renderPolygonSvg(access.getLocalPoints?.() ?? null, transform, style),
    polygon: ({ access, transform, style }) =>
        renderPolygonSvg(access.getLocalPoints?.() ?? null, transform, style),
    line: ({ shape, access, transform, style }) => {
        if (!access.localEndPoint) return null;

        const x2 = access.localEndPoint.x * shape.scaleX;
        const y2 = access.localEndPoint.y * shape.scaleY;

        return `<line x1="0" y1="0" x2="${x2}" y2="${y2}"${transform}${style} stroke-linecap="round"/>`;
    },
    arrow: ({ shape, access, transform, style }) =>
        renderPolygonSvg(getScaledArrowPoints(shape, access), transform, style),
    star: ({ access, transform, style }) =>
        renderPolygonSvg(access.getLocalPoints?.() ?? null, transform, style),
    hexagon: ({ access, transform, style }) =>
        renderPolygonSvg(access.getLocalPoints?.() ?? null, transform, style),
    parallelogram: ({ shape, access, transform, style }) =>
        renderPolygonSvg(getParallelogramPoints(shape, access), transform, style),
    pencil: ({ shape, access, transform, style }) => {
        const points = access.points ?? [];
        const pathData = buildPencilPath(points, shape.scaleX, shape.scaleY);
        if (!pathData) return null;

        return `<path d="${pathData}" fill="none"${transform}${style} stroke-linecap="round" stroke-linejoin="round"/>`;
    },
};

function shapeToSvgElement(shape: Shape): string | null {
    const transform = buildSvgTransform(shape);
    const style = buildSvgStyle(shape as unknown as SvgStyleShape);
    const renderer = SVG_SHAPE_RENDERERS[shape.type];

    if (!renderer) {
        return null;
    }

    return renderer({
        shape,
        access: shape as SvgShapeAccess,
        transform,
        style,
    });
}

function buildPencilPath(
    points: Point[],
    scaleX: number,
    scaleY: number
): string | null {
    if (points.length === 0) return null;

    const first = points[0];
    if (!first) return null;

    const firstX = first.x * scaleX;
    const firstY = first.y * scaleY;

    if (points.length === 1) {
        return `M ${firstX} ${firstY} L ${firstX} ${firstY}`;
    }

    let d = `M ${firstX} ${firstY}`;

    for (let i = 1; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        if (!current || !next) continue;

        const midX = ((current.x + next.x) / 2) * scaleX;
        const midY = ((current.y + next.y) / 2) * scaleY;
        const controlX = current.x * scaleX;
        const controlY = current.y * scaleY;

        d += ` Q ${controlX} ${controlY} ${midX} ${midY}`;
    }

    const last = points[points.length - 1];
    if (last) {
        d += ` L ${last.x * scaleX} ${last.y * scaleY}`;
    }

    return d;
}

function buildSvgTransform(shape: Shape): string {
    const transforms: string[] = [];
    const { x, y } = shape.position;
    const { rotation } = shape;

    if (x !== 0 || y !== 0) {
        transforms.push(`translate(${x}, ${y})`);
    }
    if (rotation !== 0) {
        transforms.push(`rotate(${rotation})`);
    }
    if (shape.type !== 'line' && shape.skewX !== 0) {
        transforms.push(`skewX(${shape.skewX})`);
    }
    if (shape.type !== 'line' && shape.skewY !== 0) {
        transforms.push(`skewY(${shape.skewY})`);
    }

    return transforms.length > 0 ? ` transform="${transforms.join(' ')}"` : '';
}

type SvgStyleShape = Partial<{
    fill: string;
    fillOpacity: number;
    stroke: string;
    strokeOpacity: number;
    strokeWidth: number;
}>;

function buildSvgStyle(shape: SvgStyleShape): string {
    const attrs: string[] = [];

    const fillOpacity = shape.fillOpacity ?? 1;
    const strokeOpacity = shape.strokeOpacity ?? 1;

    if (fillOpacity === 0) {
        attrs.push(`fill="none"`);
    } else if (shape.fill) {
        attrs.push(`fill="${shape.fill}"`);
        if (fillOpacity !== 1) {
            attrs.push(`fill-opacity="${fillOpacity}"`);
        }
    }

    if (shape.stroke) {
        attrs.push(`stroke="${shape.stroke}"`);
        if (strokeOpacity !== 1) {
            attrs.push(`stroke-opacity="${strokeOpacity}"`);
        }
    }
    if (shape.strokeWidth !== undefined && shape.strokeWidth > 0) {
        attrs.push(`stroke-width="${shape.strokeWidth}"`);
    }

    return attrs.length > 0 ? ' ' + attrs.join(' ') : '';
}

function ensureExtension(fileName: string, format: ExportFormat): string {
    const safeBase = sanitizeFileName(fileName);
    return `${safeBase}.${format}`;
}

function canvasToBlob(
    canvas: HTMLCanvasElement,
    mimeType: string
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(
                    new Error(
                        'Не удалось сформировать файл экспорта. Попробуйте уменьшить размер объектов или выбрать меньший масштаб экспорта.'
                    )
                );
                return;
            }
            resolve(blob);
        }, mimeType);
    });
}

function triggerDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}

function getTotalBounds(shapes: Shape[]): ExportBounds {
    if (shapes.length === 0) {
        return { x: 0, y: 0, width: 1, height: 1 };
    }
    const bounds = shapes.map((shape) => shape.getBoundingBox());

    const minX = Math.min(...bounds.map((b) => b.minX));
    const minY = Math.min(...bounds.map((b) => b.minY));
    const maxX = Math.max(...bounds.map((b) => b.maxX));
    const maxY = Math.max(...bounds.map((b) => b.maxY));

    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    return { x: minX, y: minY, width, height };
}

function getShapeDisplayName(shape: Shape): string {
    const shapeWithName = shape as Shape & { name?: string };
    if (shapeWithName.name && shapeWithName.name.trim()) {
        return shapeWithName.name;
    }

    return getShapeLabel(shape.type);
}

function validateShapeBounds(shapes: Shape[]): void {
    const MAX_LAYER_DIMENSION = 16384;
    const MAX_LAYER_AREA = 100_000_000;

    for (const shape of shapes) {
        const box = shape.getBoundingBox();

        const width = Math.abs(box.maxX - box.minX);
        const height = Math.abs(box.maxY - box.minY);
        const area = width * height;

        const hasInvalidNumbers =
            !Number.isFinite(box.minX) ||
            !Number.isFinite(box.minY) ||
            !Number.isFinite(box.maxX) ||
            !Number.isFinite(box.maxY) ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            !Number.isFinite(area);

        if (hasInvalidNumbers) {
            throw new Error(
                `Слой "${getShapeDisplayName(shape)}" не может быть экспортирован в PNG. Попробуйте изменить его размер.`
            );
        }

        if (
            width > MAX_LAYER_DIMENSION ||
            height > MAX_LAYER_DIMENSION ||
            area > MAX_LAYER_AREA
        ) {
            throw new Error(
                `Слой "${getShapeDisplayName(shape)}" слишком большой для экспорта PNG. Уменьшите его размер.`
            );
        }
    }
}
