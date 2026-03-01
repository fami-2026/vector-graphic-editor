/**
 * Треугольник.
 */
import { Editable, HideProperties } from '../property';
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

@HideProperties(['x', 'y'])
export class TriangleShape extends BaseShape {
    type = 'triangle';

    @Editable({ label: 'Fill', type: 'color' })
    fill: string;

    @Editable({ label: 'Stroke', type: 'color' })
    stroke: string;

    @Editable({
        label: 'Stroke Width',
        type: 'number',
        min: 0.5,
        max: 20,
        step: 0.5,
    })
    strokeWidth: number;

    @Editable({ label: 'Width', type: 'number', min: 10, max: 500 })
    width: number = 80;

    @Editable({ label: 'Height', type: 'number', min: 10, max: 500 })
    height: number = 80;

    constructor(
        id: string,
        position: Point,
        width: number = 80,
        height: number = 80,
        fill: string = 'transparent',
        stroke: string = '#000000',
        strokeWidth: number = 2
    ) {
        super(id, position);
        this.width = width;
        this.height = height;
        this.fill = fill;
        this.stroke = stroke;
        this.strokeWidth = strokeWidth;
    }

    private getVertices(): Point[] {
        return [
            { x: this.position.x - this.width / 2, y: this.position.y + this.height / 2 }, // лево-низ
            { x: this.position.x + this.width / 2, y: this.position.y + this.height / 2 }, // право-низ
            { x: this.position.x, y: this.position.y - this.height / 2 } // верх
        ];
    }

    hitTest(point: Point): boolean {
        const vertices = this.getVertices();
        
        const p1 = vertices[0];
        const p2 = vertices[1];
        const p3 = vertices[2];
        
        if (!p1 || !p2 || !p3) return false;
        
        const padding = this.strokeWidth / 2 + 3;

        const area = 0.5 * Math.abs(
            (p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y)
        );

        const area1 = 0.5 * Math.abs(
            (p1.x - point.x) * (p2.y - point.y) - (p2.x - point.x) * (p1.y - point.y)
        );
        const area2 = 0.5 * Math.abs(
            (p2.x - point.x) * (p3.y - point.y) - (p3.x - point.x) * (p2.y - point.y)
        );
        const area3 = 0.5 * Math.abs(
            (p3.x - point.x) * (p1.y - point.y) - (p1.x - point.x) * (p3.y - point.y)
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
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

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

    render(ctx: CanvasRenderingContext2D): void {
        const vertices = this.getVertices();
        
        const p1 = vertices[0];
        const p2 = vertices[1];
        const p3 = vertices[2];
        
        if (!p1 || !p2 || !p3) return;

        ctx.fillStyle = this.fill;
        ctx.strokeStyle = this.stroke;
        ctx.lineWidth = this.strokeWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        
        ctx.fill();
        ctx.stroke();
    }

    move(delta: Point): void {
        this.position.x += delta.x;
        this.position.y += delta.y;
    }
}

shapeRegistry.register('triangle', TriangleShape);