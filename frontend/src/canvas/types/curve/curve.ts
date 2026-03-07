/**
 * Кривая
 */
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

export class CurveShape extends BaseShape {
    type = 'curve';

    // Точки кривой (в локальных координатах относительно центра)
    private localStartX: number;
    private localStartY: number;
    private localEndX: number;
    private localEndY: number;
    private localCp1X: number;
    private localCp1Y: number;
    private localCp2X: number;
    private localCp2Y: number;

    // Свойства отрисовки
    stroke: string;
    strokeOpacity: number = 1;
    strokeWidth: number;

    // Количество изгибов
    bendCount: number = 0;

    constructor(
        id: string,
        position: Point,
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        cp1X: number,
        cp1Y: number,
        cp2X: number,
        cp2Y: number,
        stroke: string = '#2c3e50',
        strokeWidth: number = 2
    ) {
        super(id, position);

        this.localStartX = startX - position.x;
        this.localStartY = startY - position.y;
        this.localEndX = endX - position.x;
        this.localEndY = endY - position.y;
        this.localCp1X = cp1X - position.x;
        this.localCp1Y = cp1Y - position.y;
        this.localCp2X = cp2X - position.x;
        this.localCp2Y = cp2Y - position.y;

        this.stroke = stroke;
        this.strokeWidth = strokeWidth;

        this.updateBendCount();
    }

    setSize(width: number, height: number): void {
        const centerX = (this.localStartX + this.localEndX) / 2;
        const centerY = (this.localStartY + this.localEndY) / 2;

        const currentWidth = Math.abs(this.localEndX - this.localStartX);
        const currentHeight = Math.abs(this.localEndY - this.localStartY);

        const scaleX = width / (currentWidth || 1);
        const scaleY = height / (currentHeight || 1);

        this.localStartX = centerX + (this.localStartX - centerX) * scaleX;
        this.localStartY = centerY + (this.localStartY - centerY) * scaleY;
        this.localEndX = centerX + (this.localEndX - centerX) * scaleX;
        this.localEndY = centerY + (this.localEndY - centerY) * scaleY;
        this.localCp1X = centerX + (this.localCp1X - centerX) * scaleX;
        this.localCp1Y = centerY + (this.localCp1Y - centerY) * scaleY;
        this.localCp2X = centerX + (this.localCp2X - centerX) * scaleX;
        this.localCp2Y = centerY + (this.localCp2Y - centerY) * scaleY;
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

    get startX(): number {
        return this.position.x + this.localStartX * this.scaleX;
    }
    get startY(): number {
        return this.position.y + this.localStartY * this.scaleY;
    }

    get endX(): number {
        return this.position.x + this.localEndX * this.scaleX;
    }
    get endY(): number {
        return this.position.y + this.localEndY * this.scaleY;
    }

    get cp1X(): number {
        return this.position.x + this.localCp1X * this.scaleX;
    }
    get cp1Y(): number {
        return this.position.y + this.localCp1Y * this.scaleY;
    }

    get cp2X(): number {
        return this.position.x + this.localCp2X * this.scaleX;
    }
    get cp2Y(): number {
        return this.position.y + this.localCp2Y * this.scaleY;
    }

    set startX(value: number) {
        this.localStartX = (value - this.position.x) / this.scaleX;
        this.updateBendCount();
    }
    set startY(value: number) {
        this.localStartY = (value - this.position.y) / this.scaleY;
        this.updateBendCount();
    }

    set endX(value: number) {
        this.localEndX = (value - this.position.x) / this.scaleX;
        this.updateBendCount();
    }
    set endY(value: number) {
        this.localEndY = (value - this.position.y) / this.scaleY;
        this.updateBendCount();
    }

    set cp1X(value: number) {
        this.localCp1X = (value - this.position.x) / this.scaleX;
        this.updateBendCount();
    }
    set cp1Y(value: number) {
        this.localCp1Y = (value - this.position.y) / this.scaleY;
        this.updateBendCount();
    }

    set cp2X(value: number) {
        this.localCp2X = (value - this.position.x) / this.scaleX;
        this.updateBendCount();
    }
    set cp2Y(value: number) {
        this.localCp2Y = (value - this.position.y) / this.scaleY;
        this.updateBendCount();
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

    hitTest(globalPoint: Point): boolean {
        const localPoint = this.toVLocalPoint(globalPoint);
        const padding = this.strokeWidth / 2 + 3;

        const start = {
            x: this.localStartX * this.scaleX,
            y: this.localStartY * this.scaleY,
        };
        const end = {
            x: this.localEndX * this.scaleX,
            y: this.localEndY * this.scaleY,
        };
        const cp1 = {
            x: this.localCp1X * this.scaleX,
            y: this.localCp1Y * this.scaleY,
        };
        const cp2 = {
            x: this.localCp2X * this.scaleX,
            y: this.localCp2Y * this.scaleY,
        };

        const steps = 50;
        let minDistance = Infinity;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = this.cubicBezier(start.x, cp1.x, cp2.x, end.x, t);
            const y = this.cubicBezier(start.y, cp1.y, cp2.y, end.y, t);

            const dx = localPoint.x - x;
            const dy = localPoint.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            minDistance = Math.min(minDistance, distance);

            if (minDistance <= padding) {
                return true;
            }
        }

        return false;
    }

    getLocalBox(): BoundingBox {
        const points = [
            { x: this.localStartX, y: this.localStartY },
            { x: this.localCp1X, y: this.localCp1Y },
            { x: this.localCp2X, y: this.localCp2Y },
            { x: this.localEndX, y: this.localEndY },
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
        ctx.save();

        const m = this.getVMatrix();
        ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
        ctx.scale(Math.sign(this.scaleX), Math.sign(this.scaleY));

        const alpha = ctx.globalAlpha;

        ctx.beginPath();
        ctx.moveTo(this.localStartX, this.localStartY);
        ctx.bezierCurveTo(
            this.localCp1X,
            this.localCp1Y,
            this.localCp2X,
            this.localCp2Y,
            this.localEndX,
            this.localEndY
        );

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

// Класс-обертка для регистрации в реестре
export class CurveShapeWrapper extends CurveShape {
    constructor(id: string, position: Point) {
        super(
            id,
            position,
            position.x,
            position.y,
            position.x + 100,
            position.y,
            position.x + 33,
            position.y,
            position.x + 66,
            position.y,
            '#000000',
            2
        );
    }
}

shapeRegistry.register('curve', CurveShapeWrapper);
