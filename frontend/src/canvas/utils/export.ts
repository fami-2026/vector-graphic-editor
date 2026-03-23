import type { Shape, Point } from '@/canvas/types';

export type ExportFormat = 'png' | 'svg';
export type ExportArea = 'scene';
export type PngScale = 1 | 2 | 3;
export type ExportBackground = 'transparent' | 'white';

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

    const fileName = ensureExtension(options.fileName, options.format);

    if (options.format === 'svg') {
        await exportSvg(target, fileName, options);
    } else {
        await exportPng(target, fileName, options);
    }
}

function resolveExportTarget(options: ExportOptions): ExportTarget | null {
    if (options.shapes.length === 0) return null;

    const width = Math.max(1, Math.round(options.sceneSize.width));
    const height = Math.max(1, Math.round(options.sceneSize.height));

    return {
        shapes: options.shapes,
        bounds: { x: 0, y: 0, width, height },
    };
}

async function exportPng(
    target: ExportTarget,
    fileName: string,
    options: ExportOptions
): Promise<void> {
    const scale = options.pngScale ?? 1;
    const background = options.background ?? 'transparent';

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

    if (background === 'white') {
        ctx.fillStyle = '#ffffff';
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

    if (background === 'white') {
        svgParts.push(
            `  <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`
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

function shapeToSvgElement(shape: Shape): string | null {
    const transform = buildSvgTransform(shape);
    const style = buildSvgStyle(shape);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = shape as any;

    switch (shape.type) {
        case 'rect': {
            const w = Math.abs(s.width * shape.scaleX);
            const h = Math.abs(s.height * shape.scaleY);
            const x = -w / 2;
            const y = -h / 2;
            return `<rect x="${x}" y="${y}" width="${w}" height="${h}"${transform}${style}/>`;
        }
        case 'circle': {
            const rx = Math.abs(s.radiusX * shape.scaleX);
            const ry = Math.abs(s.radiusY * shape.scaleY);
            return `<ellipse cx="0" cy="0" rx="${rx}" ry="${ry}"${transform}${style}/>`;
        }
        case 'triangle': {
            const halfW = s.width / 2;
            const halfH = s.height / 2;
            const points = [
                { x: 0, y: -halfH },
                { x: -halfW, y: halfH },
                { x: halfW, y: halfH },
            ];
            const pointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');
            return `<polygon points="${pointsStr}"${transform}${style}/>`;
        }
        case 'polygon': {
            const points = s.getLocalPoints();
            if (!points) return null;
            const pointsStr = points
                .map((p: Point) => `${p.x},${p.y}`)
                .join(' ');
            return `<polygon points="${pointsStr}"${transform}${style}/>`;
        }
        case 'line': {
            if (!s.localEndPoint) return null;
            const x2 = s.localEndPoint.x * shape.scaleX;
            const y2 = s.localEndPoint.y * shape.scaleY;
            return `<line x1="0" y1="0" x2="${x2}" y2="${y2}"${transform}${style}/>`;
        }
        case 'arrow': {
            if (!s.getLocalArrowPoints) return null;
            const points = s.getLocalArrowPoints();
            if (!points || points.length === 0) return null;
            const pointsStr = points
                .map((p: Point) => `${p.x},${p.y}`)
                .join(' ');
            return `<polygon points="${pointsStr}"${transform}${style}/>`;
        }
        case 'star': {
            if (!s.getLocalPoints) return null;
            const points = s.getLocalPoints();
            if (!points || points.length === 0) return null;
            const pointsStr = points
                .map((p: Point) => `${p.x},${p.y}`)
                .join(' ');
            return `<polygon points="${pointsStr}"${transform}${style}/>`;
        }
        case 'hexagon': {
            if (!s.getLocalPoints) return null;
            const points = s.getLocalPoints();
            if (!points || points.length === 0) return null;
            const pointsStr = points
                .map((p: Point) => `${p.x},${p.y}`)
                .join(' ');
            return `<polygon points="${pointsStr}"${transform}${style}/>`;
        }
        default:
            return null;
    }
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
    if (shape.scaleX !== 1 || shape.scaleY !== 1) {
        transforms.push(`scale(${shape.scaleX}, ${shape.scaleY})`);
    }

    return transforms.length > 0 ? ` transform="${transforms.join(' ')}"` : '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSvgStyle(shape: any): string {
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
                reject(new Error('Не удалось сформировать файл экспорта.'));
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
