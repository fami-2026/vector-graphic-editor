import { Editable } from '../property';
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

export class PolygonShape extends BaseShape {
    type = 'polygon';

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
        label: 'Количество углов',
        type: 'number',
        min: 3,
        max: 12,
        step: 1,
    })
    sides: number;

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
        sides: number = 5,
        width: number = 100,
        height: number = 100,
        rotation: number = 0,
        fill: string = '#3498db',
        fillOpacity: number = 0,
        stroke: string = '#2c3e50',
        strokeOpacity: number = 1,
        strokeWidth: number = 2
    ) {
        super(id, position);
        this.sides = sides;
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
        const tempPoints: Point[] = [];
        const angleStep = (Math.PI * 2) / this.sides;
        const startAngle = -Math.PI / 2;

        for (let i = 0; i < this.sides; i++) {
            const angle = i * angleStep + startAngle;
            tempPoints.push({
                x: Math.cos(angle),
                y: Math.sin(angle),
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
            const pi = points[i];
            const pj = points[j];

            if (!pi || !pj) continue;

            const intersect =
                pi.y > localPoint.y !== pj.y > localPoint.y &&
                localPoint.x <
                    ((pj.x - pi.x) * (localPoint.y - pi.y)) / (pj.y - pi.y) +
                        pi.x;

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

        return false;
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

        const padding = this.strokeWidth / 2;

        return {
            minX: Math.min(...corners.map((p) => p.x)) - padding,
            minY: Math.min(...corners.map((p) => p.y)) - padding,
            maxX: Math.max(...corners.map((p) => p.x)) + padding,
            maxY: Math.max(...corners.map((p) => p.y)) + padding,
        };
    }

    getLocalBox(): BoundingBox {
        return {
            minX: -this.width / 2,
            minY: -this.height / 2,
            maxX: this.width / 2,
            maxY: this.height / 2,
        };
    }

    render(ctx: CanvasRenderingContext2D): void {
        const points = this.getLocalPoints();

        if (points.length < 3 || !points[0]) return;

        ctx.save();

        const m = this.getVMatrix();
        ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);

        ctx.beginPath();
        const startPoint = points[0];
        ctx.moveTo(startPoint.x, startPoint.y);

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

shapeRegistry.register('polygon', PolygonShape);
