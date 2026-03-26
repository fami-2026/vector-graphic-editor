import { Editable } from '../property';
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

export class TrapezoidShape extends BaseShape {
    type = 'trapezoid';

    @Editable({ label: 'Позиция X', type: 'number' })
    get x(): number {
        return this.position.x;
    }
    set x(value: number) {
        this.move({ x: value - this.position.x, y: 0 });
    }

    @Editable({ label: 'Позиция Y', type: 'number' })
    get y(): number {
        return this.position.y;
    }
    set y(value: number) {
        this.move({ x: 0, y: value - this.position.y });
    }

    @Editable({ label: 'Ширина (основание)', type: 'number', min: 1 })
    width: number;

    @Editable({ label: 'Высота', type: 'number', min: 1 })
    height: number;

    @Editable({ label: 'Смещение левой вершины', type: 'number' })
    topLeftX: number;

    @Editable({ label: 'Смещение правой вершины', type: 'number' })
    topRightX: number;

    @Editable({ label: 'Поворот', type: 'number', min: 0, max: 360, step: 1 })
    rotation: number;

    @Editable({ label: 'Цвет заливки', type: 'color' })
    fill: string;

    @Editable({
        label: 'Прозрачность заливки',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.1,
    })
    fillOpacity: number;

    @Editable({ label: 'Цвет контура', type: 'color' })
    stroke: string;

    @Editable({
        label: 'Прозрачность контура',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.1,
    })
    strokeOpacity: number;

    @Editable({
        label: 'Толщина контура',
        type: 'number',
        min: 0.5,
        max: 20,
        step: 0.5,
    })
    strokeWidth: number;

    constructor(
        id: string,
        position: Point,
        width: number = 120,
        height: number = 80,
        topLeftX: number = -30,
        topRightX: number = 30,
        rotation: number = 0,
        fill: string = '#3498db',
        fillOpacity: number = 0,
        stroke: string = '#2c3e50',
        strokeOpacity: number = 1,
        strokeWidth: number = 2
    ) {
        super(id, position);
        this.width = width;
        this.height = height;
        this.topLeftX = topLeftX;
        this.topRightX = topRightX;
        this.rotation = rotation;
        this.fill = fill;
        this.fillOpacity = fillOpacity;
        this.stroke = stroke;
        this.strokeOpacity = strokeOpacity;
        this.strokeWidth = strokeWidth;
    }

    setSize(width: number, height: number): void {
        if (this.width > 0) {
            const ratio = width / this.width;
            this.topLeftX = this.topLeftX * ratio;
            this.topRightX = this.topRightX * ratio;
        } else {
            this.topLeftX = -width / 4;
            this.topRightX = width / 4;
        }
        this.width = width;
        this.height = height;
    }

    private getVertices(): Point[] {
        const rotationRad = (this.rotation * Math.PI) / 180;
        const cos = Math.cos(rotationRad);
        const sin = Math.sin(rotationRad);
        const halfW = this.width / 2;
        const halfH = this.height / 2;

        const localPoints = [
            { x: -halfW * this.scaleX, y: halfH * this.scaleY },
            { x: halfW * this.scaleX, y: halfH * this.scaleY },
            { x: this.topRightX * this.scaleX, y: -halfH * this.scaleY },
            { x: this.topLeftX * this.scaleX, y: -halfH * this.scaleY },
        ];

        return localPoints.map((p) => ({
            x: this.position.x + p.x * cos - p.y * sin,
            y: this.position.y + p.x * sin + p.y * cos,
        }));
    }

    getLocalPoints(): Point[] {
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        return [
            { x: -halfW, y: halfH },
            { x: halfW, y: halfH },
            { x: this.topRightX, y: -halfH },
            { x: this.topLeftX, y: -halfH },
        ];
    }

    hitTest(point: Point): boolean {
        const vertices = this.getVertices();
        const n = vertices.length;

        let inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = vertices[i]!.x,
                yi = vertices[i]!.y;
            const xj = vertices[j]!.x,
                yj = vertices[j]!.y;
            if (
                yi > point.y !== yj > point.y &&
                point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
            ) {
                inside = !inside;
            }
        }
        if (inside) return true;

        const padding = this.strokeWidth / 2 + 3;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            if (this.distanceToSegment(point, vertices[j]!, vertices[i]!) <= padding)
                return true;
        }
        return false;
    }

    private distanceToSegment(p: Point, a: Point, b: Point): number {
        const ab = { x: b.x - a.x, y: b.y - a.y };
        const ap = { x: p.x - a.x, y: p.y - a.y };
        const lenSq = ab.x * ab.x + ab.y * ab.y;
        if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
        const t = Math.max(0, Math.min(1, (ab.x * ap.x + ab.y * ap.y) / lenSq));
        return Math.hypot(p.x - (a.x + t * ab.x), p.y - (a.y + t * ab.y));
    }

    getBoundingBox(): BoundingBox {
        const vertices = this.getVertices();
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        for (const v of vertices) {
            minX = Math.min(minX, v.x);
            minY = Math.min(minY, v.y);
            maxX = Math.max(maxX, v.x);
            maxY = Math.max(maxY, v.y);
        }
        const padding = this.strokeWidth / 2 + 5;
        return {
            minX: minX - padding,
            minY: minY - padding,
            maxX: maxX + padding,
            maxY: maxY + padding,
        };
    }

    getLocalBox(): BoundingBox {
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        return {
            minX: Math.min(-halfW, this.topLeftX),
            minY: -halfH,
            maxX: Math.max(halfW, this.topRightX),
            maxY: halfH,
        };
    }

    render(ctx: CanvasRenderingContext2D): void {
        const vertices = this.getVertices();
        if (vertices.length < 4) return;

        ctx.beginPath();
        ctx.moveTo(vertices[0]!.x, vertices[0]!.y);
        for (let i = 1; i < vertices.length; i++) {
            ctx.lineTo(vertices[i]!.x, vertices[i]!.y);
        }
        ctx.closePath();

        ctx.globalAlpha = this.fillOpacity;
        ctx.fillStyle = this.fill;
        ctx.fill();

        ctx.globalAlpha = this.strokeOpacity;
        ctx.strokeStyle = this.stroke;
        ctx.lineWidth = this.strokeWidth;
        ctx.stroke();

        ctx.globalAlpha = 1;
    }

    move(delta: Point): void {
        this.position.x += delta.x;
        this.position.y += delta.y;
    }
}

shapeRegistry.register('trapezoid', TrapezoidShape);
