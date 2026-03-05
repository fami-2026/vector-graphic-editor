/**
 * Круг или эллипс.
 */
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

export class CircleShape extends BaseShape {
    type = 'circle';

    radiusX: number;
    radiusY: number;

    fill: string;
    fillOpacity: number = 1;
    stroke: string;
    strokeOpacity: number = 1;
    strokeWidth: number;

    /**
     * @param id Идентификатор
     * @param position Центр круга
     * @param radiusX Горизонтальный радиус (по умолчанию 50)
     * @param radiusY Вертикальный радиус (по умолчанию 50)
     * @param fill Цвет заливки (по умолчанию #3498db)
     * @param stroke Цвет границы (по умолчанию #2c3e50)
     * @param strokeWidth Толщина границы (по умолчанию 2)
     */
    constructor(
        id: string,
        position: Point,
        radiusX: number = 50,
        radiusY: number = 50,
        fill: string = '#3498db',
        stroke: string = '#2c3e50',
        strokeWidth: number = 2
    ) {
        super(id, position);
        this.radiusX = radiusX;
        this.radiusY = radiusY;
        this.fill = fill;
        this.stroke = stroke;
        this.strokeWidth = strokeWidth;
    }

    get width(): number {
        return this.radiusX * 2;
    }
    set width(v: number) {
        this.radiusX = v / 2;
    }

    get height(): number {
        return this.radiusY * 2;
    }
    set height(v: number) {
        this.radiusY = v / 2;
    }

    setSize(width: number, height: number): void {
        this.width = width;
        this.height = height;
    }

    hitTest(globalPoint: Point): boolean {
        const localPoint = this.toVLocalPoint(globalPoint);
        const padding = this.strokeWidth / 2 + 3;
        const minRadiusHit = 6;
        const rX =
            Math.max(Math.abs((this.width / 2) * this.scaleX), minRadiusHit) +
            padding;
        const rY =
            Math.max(Math.abs((this.height / 2) * this.scaleY), minRadiusHit) +
            padding;

        return (
            (localPoint.x * localPoint.x) / (rX * rX) +
                (localPoint.y * localPoint.y) / (rY * rY) <=
            1
        );
    }

    getLocalBox(): BoundingBox {
        return {
            minX: -this.radiusX,
            minY: -this.radiusY,
            maxX: this.radiusX,
            maxY: this.radiusY,
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
        const rX = Math.abs(this.radiusX * this.scaleX);
        const rY = Math.abs(this.radiusY * this.scaleY);

        ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
        ctx.scale(Math.sign(this.scaleX), Math.sign(this.scaleY));

        const alpha = ctx.globalAlpha;
        ctx.beginPath();
        ctx.ellipse(0, 0, rX, rY, 0, 0, Math.PI * 2);
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

shapeRegistry.register('circle', CircleShape);
