/**
 * Отрезок прямой с началом и концом.
 */
import { HideProperties } from '../property';
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

@HideProperties(['x', 'y', 'rotation'])
export class LineShape extends BaseShape {
    type = 'line';

    stroke: string;
    strokeOpacity: number = 1;
    strokeWidth: number;

    localEndPoint: Point;

    /**
     * @param id Идентификатор
     * @param position Начало линии
     * @param endPoint Конец линии (по умолчанию +100 по X и Y от position)
     * @param stroke Цвет границы (по умолчанию #2c3e50)
     * @param strokeWidth Толщина границы (по умолчанию 2)
     */
    constructor(
        id: string,
        position: Point,
        endPoint: Point = { x: position.x + 100, y: position.y + 100 },
        stroke: string = '#2c3e50',
        strokeWidth: number = 2
    ) {
        super(id, position);
        this.localEndPoint = {
            x: endPoint.x - position.x,
            y: endPoint.y - position.y,
        };
        this.stroke = stroke;
        this.strokeWidth = strokeWidth;
    }

    get endPoint(): Point {
        return this.toGlobalPoint(this.localEndPoint);
    }

    set endPoint(globalPoint: Point) {
        this.localEndPoint = this.toLocalPoint(globalPoint);
    }

    setSize(width: number, height: number): void {
        const signX = Math.sign(this.localEndPoint.x) || 1;
        const signY = Math.sign(this.localEndPoint.y) || 1;
        this.localEndPoint.x = width * signX;
        this.localEndPoint.y = height * signY;
    }

    hitTest(globalPoint: Point): boolean {
        const localPoint = this.toVLocalPoint(globalPoint);
        const dx = this.localEndPoint.x * this.scaleX;
        const dy = this.localEndPoint.y * this.scaleY;
        const lenSquared = dx * dx + dy * dy;

        let t = 0;
        if (lenSquared > 0) {
            t = (localPoint.x * dx + localPoint.y * dy) / lenSquared;
            t = Math.max(0, Math.min(1, t));
        }

        const projX = t * dx;
        const projY = t * dy;
        return (
            Math.hypot(localPoint.x - projX, localPoint.y - projY) <=
            this.strokeWidth / 2 + 5
        );
    }

    getLocalBox(): BoundingBox {
        const padding = this.strokeWidth / 2 + 5;
        return {
            minX: Math.min(0, this.localEndPoint.x) - padding,
            minY: Math.min(0, this.localEndPoint.y) - padding,
            maxX: Math.max(0, this.localEndPoint.x) + padding,
            maxY: Math.max(0, this.localEndPoint.y) + padding,
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
        ctx.save();
        const m = this.getVMatrix();
        ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);

        const alpha = ctx.globalAlpha;
        ctx.strokeStyle = this.stroke;
        ctx.lineWidth = this.strokeWidth;
        ctx.lineCap = 'round';
        ctx.globalAlpha = this.strokeOpacity;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(
            this.localEndPoint.x * this.scaleX,
            this.localEndPoint.y * this.scaleY
        );
        ctx.stroke();
        ctx.globalAlpha = alpha;
        ctx.restore();
    }

    move(delta: Point): void {
        this.position.x += delta.x;
        this.position.y += delta.y;
    }
}
shapeRegistry.register('line', LineShape);
