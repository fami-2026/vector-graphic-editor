import { Editable } from '../property';
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

export class StarShape extends BaseShape {
    type = 'star';

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

    @Editable({
        label: 'Количество лучей',
        type: 'number',
        min: 3,
        max: 20,
        step: 1,
    })
    numPoints: number;

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

    private innerRatio: number = 0.5;

    constructor(
        id: string,
        position: Point,
        numPoints: number = 5,
        width: number = 120,
        height: number = 120,
        rotation: number = 0,
        fill: string = '#3498db',
        fillOpacity: number = 0,
        stroke: string = '#2c3e50',
        strokeOpacity: number = 1,
        strokeWidth: number = 2
    ) {
        super(id, position);
        this.numPoints = numPoints;
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
        const step = Math.PI / this.numPoints;
        const startAngle = -Math.PI / 2;
        const tempPoints: Point[] = [];

        for (let i = 0; i < this.numPoints * 2; i++) {
            const r = i % 2 === 0 ? 1 : this.innerRatio;
            const angle = i * step + startAngle;
            tempPoints.push({
                x: r * Math.cos(angle),
                y: r * Math.sin(angle),
            });
        }

        const minX = Math.min(...tempPoints.map((p) => p.x));
        const maxX = Math.max(...tempPoints.map((p) => p.x));
        const minY = Math.min(...tempPoints.map((p) => p.y));
        const maxY = Math.max(...tempPoints.map((p) => p.y));

        const currentW = maxX - minX;
        const currentH = maxY - minY;

        return tempPoints.map((p) => ({
            x: ((p.x - minX) / currentW - 0.5) * this.width * this.scaleX,
            y: ((p.y - minY) / currentH - 0.5) * this.height * this.scaleY,
        }));
    }

    hitTest(globalPoint: Point): boolean {
        const localPoint = this.toVLocalPoint(globalPoint);
        const points = this.getLocalPoints();
        const padding = this.strokeWidth / 2 + 3;

        if (points.length < 3) return false;

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

            if (pi && pj) {
                const distance = this.distanceToSegment(localPoint, pi, pj);
                if (distance <= padding) return true;
            }
        }

        return inside;
    }

    private distanceToSegment(p: Point, a: Point, b: Point): number {
        const ab = { x: b.x - a.x, y: b.y - a.y };
        const ap = { x: p.x - a.x, y: p.y - a.y };

        const t = (ab.x * ap.x + ab.y * ap.y) / (ab.x * ab.x + ab.y * ab.y);

        if (t < 0) {
            const dx = p.x - a.x;
            const dy = p.y - a.y;
            return Math.sqrt(dx * dx + dy * dy);
        } else if (t > 1) {
            const dx = p.x - b.x;
            const dy = p.y - b.y;
            return Math.sqrt(dx * dx + dy * dy);
        } else {
            const proj = { x: a.x + t * ab.x, y: a.y + t * ab.y };
            const dx = p.x - proj.x;
            const dy = p.y - proj.y;
            return Math.sqrt(dx * dx + dy * dy);
        }
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

    getLocalBox(): BoundingBox {
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        return {
            minX: -halfW,
            minY: -halfH,
            maxX: halfW,
            maxY: halfH,
        };
    }

    render(ctx: CanvasRenderingContext2D): void {
        const points = this.getLocalPoints();

        if (points.length < 3) return;

        const firstPoint = points[0];
        if (!firstPoint) return;

        ctx.save();

        const m = this.getVMatrix();
        ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);

        ctx.beginPath();
        ctx.moveTo(firstPoint.x, firstPoint.y);

        for (let i = 1; i < points.length; i++) {
            const p = points[i];
            if (p) {
                ctx.lineTo(p.x, p.y);
            }
        }

        ctx.closePath();

        ctx.globalAlpha = this.fillOpacity;
        ctx.fillStyle = this.fill;
        ctx.fill();

        ctx.globalAlpha = this.strokeOpacity;
        ctx.strokeStyle = this.stroke;
        ctx.lineWidth = this.strokeWidth;
        ctx.stroke();

        ctx.restore();
    }

    move(delta: Point): void {
        this.position.x += delta.x;
        this.position.y += delta.y;
    }
}

shapeRegistry.register('star', StarShape);
