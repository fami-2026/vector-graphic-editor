/**
 * Прямоугольник, центрирован в позиции.
 */
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

export class RectShape extends BaseShape {
    type = 'rect';

    width: number;

    height: number;

    fill: string;
    fillOpacity: number = 1;
    stroke: string;
    strokeOpacity: number = 1;
    strokeWidth: number;

    /**
     * @param id Идентификатор
     * @param position Центр прямоугольника
     * @param width Ширина (по умолчанию 100)
     * @param height Высота (по умолчанию 80)
     * @param fill Цвет заливки (по умолчанию #e74c3c)
     * @param stroke Цвет границы (по умолчанию #2c3e50)
     * @param strokeWidth Толщина границы (по умолчанию 2)
     */
    constructor(
        id: string,
        position: Point,
        width: number = 100,
        height: number = 80,
        fill: string = '#e74c3c',
        stroke: string = '#2c3e50',
        strokeWidth: number = 2
    ) {
        super(id, position);
        this.width = width;
        this.height = height;
        this.fill = fill;
        this.stroke = stroke;
        this.strokeWidth = strokeWidth;
    }

    setSize(width: number, height: number): void {
        this.width = width;
        this.height = height;
    }

    hitTest(globalPoint: Point): boolean {
        const localPoint = this.toVLocalPoint(globalPoint);
        const padding = this.strokeWidth / 2 + 3;
        const minHalfHit = 6;
        const halfW = Math.max(
            Math.abs(this.width * this.scaleX) / 2,
            minHalfHit
        );
        const halfH = Math.max(
            Math.abs(this.height * this.scaleY) / 2,
            minHalfHit
        );

        return (
            localPoint.x >= -halfW - padding &&
            localPoint.x <= halfW + padding &&
            localPoint.y >= -halfH - padding &&
            localPoint.y <= halfH + padding
        );
    }

    getLocalBox(): BoundingBox {
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        return { minX: -halfW, minY: -halfH, maxX: halfW, maxY: halfH };
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
        const w = Math.abs(this.width * this.scaleX);
        const h = Math.abs(this.height * this.scaleY);

        ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
        ctx.scale(Math.sign(this.scaleX), Math.sign(this.scaleY));

        const alpha = ctx.globalAlpha;
        ctx.fillStyle = this.fill;
        ctx.globalAlpha = this.fillOpacity;
        ctx.fillRect(-w / 2, -h / 2, w, h);

        ctx.strokeStyle = this.stroke;
        ctx.lineWidth = this.strokeWidth;
        ctx.globalAlpha = this.strokeOpacity;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.globalAlpha = alpha;
        ctx.restore();
    }

    move(delta: Point): void {
        this.position.x += delta.x;
        this.position.y += delta.y;
    }
}
shapeRegistry.register('rect', RectShape);
