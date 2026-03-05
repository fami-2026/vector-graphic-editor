import { Editable } from '../property';
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

export class CurveShape extends BaseShape {
    type = 'curve';

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

    @Editable({ label: 'Поворот', type: 'number', min: 0, max: 360, step: 1 })
    rotation: number = 0;

    private localStartX: number;
    private localStartY: number;
    private localEndX: number;
    private localEndY: number;
    private localCp1X: number;
    private localCp1Y: number;
    private localCp2X: number;
    private localCp2Y: number;

    get startX(): number {
        const cos = Math.cos((this.rotation * Math.PI) / 180);
        const sin = Math.sin((this.rotation * Math.PI) / 180);
        return (
            this.position.x + this.localStartX * cos - this.localStartY * sin
        );
    }
    get startY(): number {
        const cos = Math.cos((this.rotation * Math.PI) / 180);
        const sin = Math.sin((this.rotation * Math.PI) / 180);
        return (
            this.position.y + this.localStartX * sin + this.localStartY * cos
        );
    }

    get endX(): number {
        const cos = Math.cos((this.rotation * Math.PI) / 180);
        const sin = Math.sin((this.rotation * Math.PI) / 180);
        return this.position.x + this.localEndX * cos - this.localEndY * sin;
    }
    get endY(): number {
        const cos = Math.cos((this.rotation * Math.PI) / 180);
        const sin = Math.sin((this.rotation * Math.PI) / 180);
        return this.position.y + this.localEndX * sin + this.localEndY * cos;
    }

    get cp1X(): number {
        const cos = Math.cos((this.rotation * Math.PI) / 180);
        const sin = Math.sin((this.rotation * Math.PI) / 180);
        return this.position.x + this.localCp1X * cos - this.localCp1Y * sin;
    }
    get cp1Y(): number {
        const cos = Math.cos((this.rotation * Math.PI) / 180);
        const sin = Math.sin((this.rotation * Math.PI) / 180);
        return this.position.y + this.localCp1X * sin + this.localCp1Y * cos;
    }

    get cp2X(): number {
        const cos = Math.cos((this.rotation * Math.PI) / 180);
        const sin = Math.sin((this.rotation * Math.PI) / 180);
        return this.position.x + this.localCp2X * cos - this.localCp2Y * sin;
    }
    get cp2Y(): number {
        const cos = Math.cos((this.rotation * Math.PI) / 180);
        const sin = Math.sin((this.rotation * Math.PI) / 180);
        return this.position.y + this.localCp2X * sin + this.localCp2Y * cos;
    }

    @Editable({ label: 'Цвет контура', type: 'color' })
    stroke: string;

    @Editable({
        label: 'Прозрачность контура',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.1,
    })
    strokeOpacity: number = 1;

    @Editable({
        label: 'Толщина контура',
        type: 'number',
        min: 0.5,
        max: 20,
        step: 0.5,
    })
    strokeWidth: number;

    bendCount: number = 0;

    constructor(
        id: string,
        position: Point,
        startX: number = 50,
        startY: number = 100,
        endX: number = 250,
        endY: number = 100,
        cp1X?: number,
        cp1Y?: number,
        cp2X?: number,
        cp2Y?: number,
        stroke: string = '#2c3e50',
        strokeOpacity: number = 1,
        strokeWidth: number = 2,
        rotation: number = 0
    ) {
        super(id, position);

        this.localStartX = startX - position.x;
        this.localStartY = startY - position.y;
        this.localEndX = endX - position.x;
        this.localEndY = endY - position.y;

        const dx = endX - startX;
        const dy = endY - startY;

        if (cp1X === undefined || cp1Y === undefined) {
            this.localCp1X = this.localStartX + dx / 3;
            this.localCp1Y = this.localStartY + dy / 3;
        } else {
            this.localCp1X = cp1X - position.x;
            this.localCp1Y = cp1Y - position.y;
        }

        if (cp2X === undefined || cp2Y === undefined) {
            this.localCp2X = this.localStartX + (2 * dx) / 3;
            this.localCp2Y = this.localStartY + (2 * dy) / 3;
        } else {
            this.localCp2X = cp2X - position.x;
            this.localCp2Y = cp2Y - position.y;
        }

        this.rotation = rotation;
        this.updateBendCount();

        this.stroke = stroke;
        this.strokeOpacity = strokeOpacity;
        this.strokeWidth = strokeWidth;
    }

    private updateBendCount() {
        const dx = this.endX - this.startX;
        const dy = this.endY - this.startY;

        const straightC1X = this.startX + dx / 3;
        const straightC1Y = this.startY + dy / 3;
        const dist1 = Math.sqrt(
            Math.pow(this.cp1X - straightC1X, 2) +
                Math.pow(this.cp1Y - straightC1Y, 2)
        );

        const straightC2X = this.startX + (2 * dx) / 3;
        const straightC2Y = this.startY + (2 * dy) / 3;
        const dist2 = Math.sqrt(
            Math.pow(this.cp2X - straightC2X, 2) +
                Math.pow(this.cp2Y - straightC2Y, 2)
        );

        this.bendCount = (dist1 > 5 ? 1 : 0) + (dist2 > 5 ? 1 : 0);
    }

    hitTest(point: Point): boolean {
        const padding = this.strokeWidth / 2 + 3;

        const steps = 50;
        let minDistance = Infinity;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = this.cubicBezier(
                this.startX,
                this.cp1X,
                this.cp2X,
                this.endX,
                t
            );
            const y = this.cubicBezier(
                this.startY,
                this.cp1Y,
                this.cp2Y,
                this.endY,
                t
            );

            const dx = point.x - x;
            const dy = point.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            minDistance = Math.min(minDistance, distance);

            if (minDistance <= padding) {
                return true;
            }
        }

        return false;
    }

    private cubicBezier(
        p0: number,
        p1: number,
        p2: number,
        p3: number,
        t: number
    ): number {
        const mt = 1 - t;
        return (
            mt * mt * mt * p0 +
            3 * mt * mt * t * p1 +
            3 * mt * t * t * p2 +
            t * t * t * p3
        );
    }

    getBoundingBox(): BoundingBox {
        const points = [
            { x: this.startX, y: this.startY },
            { x: this.cp1X, y: this.cp1Y },
            { x: this.cp2X, y: this.cp2Y },
            { x: this.endX, y: this.endY },
        ];

        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        for (const p of points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }

        return { minX, minY, maxX, maxY };
    }

    render(ctx: CanvasRenderingContext2D): void {
        ctx.beginPath();
        ctx.moveTo(this.startX, this.startY);
        ctx.bezierCurveTo(
            this.cp1X,
            this.cp1Y,
            this.cp2X,
            this.cp2Y,
            this.endX,
            this.endY
        );

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

    setStartPoint(x: number, y: number) {
        this.localStartX = x - this.position.x;
        this.localStartY = y - this.position.y;
        this.updateBendCount();
    }

    setEndPoint(x: number, y: number) {
        this.localEndX = x - this.position.x;
        this.localEndY = y - this.position.y;
        this.updateBendCount();
    }

    setControlPoint1(x: number, y: number) {
        this.localCp1X = x - this.position.x;
        this.localCp1Y = y - this.position.y;
        this.updateBendCount();
    }

    setControlPoint2(x: number, y: number) {
        this.localCp2X = x - this.position.x;
        this.localCp2Y = y - this.position.y;
        this.updateBendCount();
    }
}

shapeRegistry.register('curve', CurveShape);
