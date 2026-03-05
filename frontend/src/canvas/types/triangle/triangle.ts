import { Editable } from '../property';
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

export class TriangleShape extends BaseShape {
    type = 'triangle';

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
        width: number = 80,
        height: number = 80,
        rotation: number = 0,
        fill: string = 'transparent',
        fillOpacity: number = 1,
        stroke: string = '#000000',
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

    private getVertices(): Point[] {
        const rotationRad = (this.rotation * Math.PI) / 180;
        const cos = Math.cos(rotationRad);
        const sin = Math.sin(rotationRad);

        const halfW = this.width / 2;
        const halfH = this.height / 2;

        const localPoints = [
            { x: 0, y: -halfH },
            { x: -halfW, y: halfH },
            { x: halfW, y: halfH },
        ];

        return localPoints.map((p) => ({
            x: this.position.x + p.x * cos - p.y * sin,
            y: this.position.y + p.x * sin + p.y * cos,
        }));
    }

    hitTest(point: Point): boolean {
        const vertices = this.getVertices();

        const p1 = vertices[0];
        const p2 = vertices[1];
        const p3 = vertices[2];

        if (!p1 || !p2 || !p3) return false;

        const padding = this.strokeWidth / 2 + 3;

        const area =
            0.5 *
            Math.abs(
                (p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y)
            );

        const area1 =
            0.5 *
            Math.abs(
                (p1.x - point.x) * (p2.y - point.y) -
                    (p2.x - point.x) * (p1.y - point.y)
            );
        const area2 =
            0.5 *
            Math.abs(
                (p2.x - point.x) * (p3.y - point.y) -
                    (p3.x - point.x) * (p2.y - point.y)
            );
        const area3 =
            0.5 *
            Math.abs(
                (p3.x - point.x) * (p1.y - point.y) -
                    (p1.x - point.x) * (p3.y - point.y)
            );

        if (Math.abs(area - (area1 + area2 + area3)) < 0.1) {
            return true;
        }

        const dist1 = this.distanceToSegment(point, p1, p2);
        const dist2 = this.distanceToSegment(point, p2, p3);
        const dist3 = this.distanceToSegment(point, p3, p1);

        return Math.min(dist1, dist2, dist3) <= padding;
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
            minX: -halfW,
            minY: -halfH,
            maxX: halfW,
            maxY: halfH,
        };
    }

    render(ctx: CanvasRenderingContext2D): void {
        const vertices = this.getVertices();

        const p1 = vertices[0];
        const p2 = vertices[1];
        const p3 = vertices[2];

        if (!p1 || !p2 || !p3) return;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
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

shapeRegistry.register('triangle', TriangleShape);
