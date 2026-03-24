import { Editable } from '../property';
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

export class PencilShape extends BaseShape {
    type = 'pencil';

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

    // Локальные точки относительно position
    points: Point[];

    constructor(
        id: string,
        position: Point,
        points: Point[] = [{ x: 0, y: 0 }],
        stroke: string = '#2c3e50',
        strokeOpacity: number = 1,
        strokeWidth: number = 2
    ) {
        super(id, position);
        this.points = points;
        this.stroke = stroke;
        this.strokeOpacity = strokeOpacity;
        this.strokeWidth = strokeWidth;
    }

    addPoint(globalPoint: Point) {
        const local = this.toVLocalPoint(globalPoint);
        this.points.push({ x: local.x, y: local.y });
    }

    // После рисования переносим центр в position (0,0 в локале)
    recenterToBoundingBox() {
        if (!this.points.length) return;
        /*const box = this.getLocalBox();*/
        const box = this.getStrokeBounds();
        const cx = (box.minX + box.maxX) / 2;
        const cy = (box.minY + box.maxY) / 2;

        this.position.x += cx;
        this.position.y += cy;

        this.points = this.points.map((p) => ({
            x: p.x - cx,
            y: p.y - cy,
        }));
    }

    private getStrokeBounds(): BoundingBox {
        if (!this.points.length) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        }

        const xs = this.points.map((p) => p.x);
        const ys = this.points.map((p) => p.y);

        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    }

    get width(): number {
        //const box = this.getLocalBox();
        const box = this.getStrokeBounds();
        return Math.max(1, Math.round(box.maxX - box.minX));
    }

    set width(value: number) {
        //this.setSize(value, this.height);
        this.setSize(Math.max(1, Math.round(value)), this.height);
    }

    get height(): number {
        //const box = this.getLocalBox();
        const box = this.getStrokeBounds();
        return Math.max(1, Math.round(box.maxY - box.minY));
    }

    set height(value: number) {
        //this.setSize(this.width, value);
        this.setSize(this.width, Math.max(1, Math.round(value)));
    }

    setSize(width: number, height: number): void {
        if (!this.points.length) return;
        //const box = this.getLocalBox();
        const box = this.getStrokeBounds();
        const curW = Math.max(1, box.maxX - box.minX);
        const curH = Math.max(1, box.maxY - box.minY);

        const sx = width / curW;
        const sy = height / curH;

        const cx = (box.minX + box.maxX) / 2;
        const cy = (box.minY + box.maxY) / 2;

        this.points = this.points.map((p) => ({
            x: (p.x - cx) * sx,
            y: (p.y - cy) * sy,
        }));
    }

    hitTest(globalPoint: Point): boolean {
        if (!this.points.length) return false;

        const localPoint = this.toVLocalPoint(globalPoint);

        const scaled = this.points.map((p) => ({
            x: p.x * this.scaleX,
            y: p.y * this.scaleY,
        }));

        const threshold = this.strokeWidth / 2 + 5;

        if (scaled.length === 1) {
            const firstPoint = scaled[0];
            if (!firstPoint) return false;

            return (
                Math.hypot(
                    localPoint.x - firstPoint.x,
                    localPoint.y - firstPoint.y
                ) <= threshold
            );
        }

        let minDist = Infinity;
        for (let i = 0; i < scaled.length - 1; i++) {
            const a = scaled[i];
            const b = scaled[i + 1];

            if (!a || !b) continue;

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len2 = dx * dx + dy * dy;

            let t = 0;
            if (len2 > 0) {
                t =
                    ((localPoint.x - a.x) * dx + (localPoint.y - a.y) * dy) /
                    len2;
                t = Math.max(0, Math.min(1, t));
            }

            const projX = a.x + t * dx;
            const projY = a.y + t * dy;
            const dist = Math.hypot(localPoint.x - projX, localPoint.y - projY);
            minDist = Math.min(minDist, dist);
        }

        return minDist <= threshold;
    }

    // getLocalBox(): BoundingBox {
    //     if (!this.points.length) {
    //         return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    //     }
    //     const xs = this.points.map((p) => p.x);
    //     const ys = this.points.map((p) => p.y);
    //     const padding = this.strokeWidth / 2 + 5;

    //     return {
    //         minX: Math.min(...xs) - padding,
    //         minY: Math.min(...ys) - padding,
    //         maxX: Math.max(...xs) + padding,
    //         maxY: Math.max(...ys) + padding,
    //     };
    // }

    getLocalBox(): BoundingBox {
        const box = this.getStrokeBounds();
        const padding = this.strokeWidth / 2 + 2;

        return {
            minX: box.minX - padding,
            minY: box.minY - padding,
            maxX: box.maxX + padding,
            maxY: box.maxY + padding,
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
        return {
            minX: Math.min(...corners.map((p) => p.x)),
            minY: Math.min(...corners.map((p) => p.y)),
            maxX: Math.max(...corners.map((p) => p.x)),
            maxY: Math.max(...corners.map((p) => p.y)),
        };
    }

    render(ctx: CanvasRenderingContext2D): void {
        if (!this.points.length) return;

        const p0 = this.points[0];
        if (!p0) return;

        ctx.save();
        const m = this.getVMatrix();
        ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);

        const alpha = ctx.globalAlpha;
        ctx.strokeStyle = this.stroke;
        ctx.lineWidth = this.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = this.strokeOpacity;

        ctx.beginPath();
        //ctx.moveTo(p0.x * this.scaleX, p0.y * this.scaleY);

        // for (let i = 1; i < this.points.length; i++) {
        //     const p = this.points[i];
        //     if (!p) continue;

        //     ctx.lineTo(p.x * this.scaleX, p.y * this.scaleY);
        // }

        if (this.points.length === 1) {
            ctx.moveTo(p0.x * this.scaleX, p0.y * this.scaleY);
            ctx.lineTo(p0.x * this.scaleX, p0.y * this.scaleY);
        } else {
            ctx.moveTo(p0.x * this.scaleX, p0.y * this.scaleY);

            for (let i = 1; i < this.points.length - 1; i++) {
                const current = this.points[i];
                const next = this.points[i + 1];
                if (!current || !next) continue;

                const midX = ((current.x + next.x) / 2) * this.scaleX;
                const midY = ((current.y + next.y) / 2) * this.scaleY;

                ctx.quadraticCurveTo(
                    current.x * this.scaleX,
                    current.y * this.scaleY,
                    midX,
                    midY
                );
            }

            const last = this.points[this.points.length - 1];
            if (last) {
                ctx.lineTo(last.x * this.scaleX, last.y * this.scaleY);
            }
        }

        ctx.stroke();
        ctx.globalAlpha = alpha;
        ctx.restore();
    }

    move(delta: Point): void {
        this.position.x += delta.x;
        this.position.y += delta.y;
    }
}

shapeRegistry.register('pencil', PencilShape);
