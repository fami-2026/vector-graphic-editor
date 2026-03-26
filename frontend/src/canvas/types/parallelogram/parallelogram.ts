import { Editable } from '../property';
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

export class ParallelogramShape extends BaseShape {
    type = 'parallelogram';

    @Editable({ label: 'Позиция X', type: 'number' })
    get x(): number {
        return this.position.x;
    }
    set x(value: number) {
        const delta = value - this.position.x;
        this.move({ x: delta, y: 0 });
    }

    @Editable({ label: 'Позиция Y', type: 'number' })
    get y(): number {
        return this.position.y;
    }
    set y(value: number) {
        const delta = value - this.position.y;
        this.move({ x: 0, y: delta });
    }

    @Editable({ label: 'Ширина', type: 'number', min: 1 })
    width: number;

    @Editable({ label: 'Высота', type: 'number', min: 1 })
    height: number;

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
        width: number = 100,
        height: number = 80,
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
        this.rotation = rotation;
        this.fill = fill;
        this.fillOpacity = fillOpacity;
        this.stroke = stroke;
        this.strokeOpacity = strokeOpacity;
        this.strokeWidth = strokeWidth;
    }

    setSize(width: number, height: number): void {
        this.width = width;
        this.height = height;
    }

    private getLocalPoints(): Point[] {
        const w = Math.abs(this.width * this.scaleX);
        const h = Math.abs(this.height * this.scaleY);
        const halfW = w / 2;
        const halfH = h / 2;
        const offset = Math.min(w * 0.25, halfW - 1);

        return [
            { x: -halfW + offset, y: -halfH },
            { x: halfW, y: -halfH },
            { x: halfW - offset, y: halfH },
            { x: -halfW, y: halfH },
        ];
    }

    hitTest(globalPoint: Point): boolean {
        const localPoint = this.toVLocalPoint(globalPoint);
        const points = this.getLocalPoints();
        const padding = this.strokeWidth / 2 + 3;

        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const p1 = points[i];
            const p2 = points[j];
            if (!p1 || !p2) continue;

            const intersect =
                p1.y > localPoint.y !== p2.y > localPoint.y &&
                localPoint.x <
                    ((p2.x - p1.x) * (localPoint.y - p1.y)) / (p2.y - p1.y) +
                        p1.x;

            if (intersect) inside = !inside;
        }

        if (inside) return true;

        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            const pi = points[i];
            const pj = points[j];
            if (!pi || !pj) continue;

            if (this.distanceToSegment(localPoint, pi, pj) <= padding) {
                return true;
            }
        }

        return false;
    }

    private distanceToSegment(p: Point, a: Point, b: Point): number {
        const ab = { x: b.x - a.x, y: b.y - a.y };
        const ap = { x: p.x - a.x, y: p.y - a.y };
        const t = (ab.x * ap.x + ab.y * ap.y) / (ab.x * ab.x + ab.y * ab.y);

        if (t < 0) return Math.hypot(p.x - a.x, p.y - a.y);
        if (t > 1) return Math.hypot(p.x - b.x, p.y - b.y);

        const proj = { x: a.x + t * ab.x, y: a.y + t * ab.y };
        return Math.hypot(p.x - proj.x, p.y - proj.y);
    }

    getLocalBox(): BoundingBox {
        const points = this.getLocalPoints();
        return {
            minX: Math.min(...points.map((p) => p.x)),
            minY: Math.min(...points.map((p) => p.y)),
            maxX: Math.max(...points.map((p) => p.x)),
            maxY: Math.max(...points.map((p) => p.y)),
        };
    }

    getBoundingBox(): BoundingBox {
        const localBox = this.getLocalBox();
        const corners = [
            this.toGlobalPoint({ x: localBox.minX, y: localBox.minY }),
            this.toGlobalPoint({ x: localBox.maxX, y: localBox.minY }),
            this.toGlobalPoint({ x: localBox.maxX, y: localBox.maxY }),
            this.toGlobalPoint({ x: localBox.minX, y: localBox.maxY }),
        ];

        const padding = this.strokeWidth / 2 + 5;
        return {
            minX: Math.min(...corners.map((p) => p.x)) - padding,
            minY: Math.min(...corners.map((p) => p.y)) - padding,
            maxX: Math.max(...corners.map((p) => p.x)) + padding,
            maxY: Math.max(...corners.map((p) => p.y)) + padding,
        };
    }

    render(ctx: CanvasRenderingContext2D): void {
        const points = this.getLocalPoints();
        const first = points[0];
        if (!first) return;

        ctx.save();

        const m = this.getVMatrix();
        ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
        ctx.scale(Math.sign(this.scaleX), Math.sign(this.scaleY));

        ctx.beginPath();
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < points.length; i++) {
            const point = points[i];
            if (point) {
                ctx.lineTo(point.x, point.y);
            }
        }
        ctx.closePath();

        const alpha = ctx.globalAlpha;
        ctx.fillStyle = this.fill;
        ctx.globalAlpha = this.fillOpacity;
        ctx.fill();

        ctx.strokeStyle = this.stroke;
        ctx.lineWidth = this.strokeWidth;
        ctx.globalAlpha = this.strokeOpacity;
        ctx.stroke();

        ctx.globalAlpha = alpha;
        ctx.restore();
    }

    move(delta: Point): void {
        this.position.x += delta.x;
        this.position.y += delta.y;
    }
}

shapeRegistry.register('parallelogram', ParallelogramShape);
