/**
 * Правильный многоугольник.
 */
import { Editable, HideProperties } from '../property';
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

@HideProperties(['x', 'y'])
export class PolygonShape extends BaseShape {
    type = 'polygon';

    @Editable({ label: 'Sides', type: 'number', min: 3, max: 12, step: 1 })
    sides: number;

    @Editable({ label: 'Radius', type: 'number', min: 1 })
    radius: number;

    @Editable({ label: 'Rotation', type: 'number', min: 0, max: 360, step: 1 })
    rotation: number;

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

    /**
     * @param id Идентификатор
     * @param position Центр многоугольника
     * @param sides Количество сторон 
     * @param radius Радиус описанной окружности 
     * @param rotation Поворот в градусах 
     * @param fill Цвет заливки 
     * @param stroke Цвет границы 
     * @param strokeWidth Толщина границы 
     */
    constructor(
        id: string,
        position: Point,
        sides: number = 5,
        radius: number = 50,
        rotation: number = 0,
        fill: string = 'transparent',
        stroke: string = '#000000',
        strokeWidth: number = 2
    ) {
        super(id, position);
        this.sides = sides;
        this.radius = radius;
        this.rotation = rotation;
        this.fill = fill;
        this.stroke = stroke;
        this.strokeWidth = strokeWidth;
    }

    private getPoints(): Point[] {
        const points: Point[] = [];
        const angleStep = (Math.PI * 2) / this.sides;
        const rotationRad = (this.rotation * Math.PI) / 180;

        for (let i = 0; i < this.sides; i++) {
            const angle = i * angleStep + rotationRad;
            points.push({
                x: this.position.x + this.radius * Math.cos(angle),
                y: this.position.y + this.radius * Math.sin(angle),
            });
        }
        return points;
    }

    hitTest(point: Point): boolean {
        const points = this.getPoints();
        const padding = this.strokeWidth / 2 + 3;
        
        if (points.length < 3) return false;

        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
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
        const points = this.getPoints();
        
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
    const points = this.getPoints();
    
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

shapeRegistry.register('polygon', PolygonShape);