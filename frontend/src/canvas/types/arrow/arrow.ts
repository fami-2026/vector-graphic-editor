/**
 * Стрелка.
 */
import { Editable, HideProperties } from '../property';
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

@HideProperties(['x', 'y'])
export class ArrowShape extends BaseShape {
    type = 'arrow';

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

    @Editable({ label: 'Length', type: 'number', min: 20, max: 500 })
    length: number = 150;

    @Editable({ label: 'Head Size', type: 'number', min: 10, max: 100 })
    headSize: number = 30;

    @Editable({ label: 'Thickness', type: 'number', min: 5, max: 50 })
    thickness: number = 15;

    @Editable({ label: 'Rotation', type: 'number', min: 0, max: 360, step: 1 })
    rotation: number = 0;

    constructor(
        id: string,
        position: Point,
        length: number = 150,
        headSize: number = 30,
        thickness: number = 15,
        rotation: number = 0,
        fill: string = 'transparent',
        stroke: string = '#000000',
        strokeWidth: number = 2
    ) {
        super(id, position);
        this.length = length;
        this.headSize = headSize;
        this.thickness = thickness;
        this.rotation = rotation;
        this.fill = fill;
        this.stroke = stroke;
        this.strokeWidth = strokeWidth;
    }

    private getArrowPoints(): Point[] {
        const angle = (this.rotation * Math.PI) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const halfThick = this.thickness / 2;
        const headBase = this.length - this.headSize;

        const localPoints = [
            { x: 0, y: -halfThick },
            { x: headBase, y: -halfThick },
            { x: headBase, y: -this.headSize },
            { x: this.length, y: 0 },
            { x: headBase, y: this.headSize },
            { x: headBase, y: halfThick },
            { x: 0, y: halfThick },
        ];

        return localPoints.map(p => ({
            x: this.position.x + p.x * cos - p.y * sin,
            y: this.position.y + p.x * sin + p.y * cos
        }));
    }

    hitTest(point: Point): boolean {
        const points = this.getArrowPoints();
        const padding = this.strokeWidth / 2 + 3;

        let inside = false;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            const pi = points[i];
            const pj = points[j];
            
            if (!pi || !pj) continue;

            const intersect = ((pi.y > point.y) !== (pj.y > point.y)) &&
                (point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x);
            
            if (intersect) inside = !inside;
        }

        if (inside) return true;

        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            const pi = points[i];
            const pj = points[j];
            
            if (pi && pj) {
                const distance = this.distanceToSegment(point, pi, pj);
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
        const points = this.getArrowPoints();
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for (const p of points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
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
    const points = this.getArrowPoints();
    
    const validPoints: Point[] = [];
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        if (point) {
            validPoints.push(point);
        }
    }
    
    if (validPoints.length < 3) return;

    ctx.fillStyle = this.fill;
    ctx.strokeStyle = this.stroke;
    ctx.lineWidth = this.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    
    const firstPoint = validPoints[0];
    if (!firstPoint) return;
    ctx.moveTo(firstPoint.x, firstPoint.y);
    
    for (let i = 1; i < validPoints.length; i++) {
        const point = validPoints[i];
        if (point) {
            ctx.lineTo(point.x, point.y);
        }
    }
    
    ctx.closePath();
    
    ctx.fill();
    ctx.stroke();
}

    move(delta: Point): void {
        this.position.x += delta.x;
        this.position.y += delta.y;
    }
}

shapeRegistry.register('arrow', ArrowShape);