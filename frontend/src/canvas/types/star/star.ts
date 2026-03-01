/**
 * Звезда.
 */
import { Editable } from '../property';
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

export class StarShape extends BaseShape {
    type = 'star';

    @Editable({ label: 'Points', type: 'number', min: 3, max: 20, step: 1 })
    numPoints: number;

    @Editable({ label: 'Outer Radius', type: 'number', min: 1 })
    outerRadius: number;

    @Editable({ label: 'Inner Radius', type: 'number', min: 1 })
    innerRadius: number;

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
     * @param position Центр звезды
     * @param numPoints Количество лучей (по умолчанию 5)
     * @param outerRadius Внешний радиус (по умолчанию 60)
     * @param innerRadius Внутренний радиус (по умолчанию 30)
     * @param rotation Поворот в градусах (по умолчанию 0)
     * @param fill Цвет заливки (по умолчанию #e67e22)
     * @param stroke Цвет границы (по умолчанию #d35400)
     * @param strokeWidth Толщина границы (по умолчанию 2)
     */
    constructor(
        id: string,
        position: Point,
        numPoints: number = 5,
        outerRadius: number = 60,
        innerRadius: number = 30,
        rotation: number = 0,
        fill: string = '#e67e22',
        stroke: string = '#d35400',
        strokeWidth: number = 2
    ) {
        super(id, position);
        this.numPoints = numPoints;
        this.outerRadius = outerRadius;
        this.innerRadius = innerRadius;
        this.rotation = rotation;
        this.fill = fill;
        this.stroke = stroke;
        this.strokeWidth = strokeWidth;
    }

    private getPoints(): Point[] {
        const step = Math.PI / this.numPoints;
        const rotRad = (this.rotation * Math.PI) / 180;
        const result: Point[] = [];

        for (let i = 0; i < this.numPoints * 2; i++) {
            const radius = i % 2 === 0 ? this.outerRadius : this.innerRadius;
            const angle = i * step + rotRad;
            result.push({
                x: this.position.x + radius * Math.cos(angle),
                y: this.position.y + radius * Math.sin(angle),
            });
        }

        return result;
    }

    hitTest(point: Point): boolean {
        const points = this.getPoints();
        const padding = this.strokeWidth / 2 + 3;

        if (points.length < 3) return false;

        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const p1 = points[i];
            const p2 = points[j];
            
            if (!p1 || !p2) continue;
            
            const xi = p1.x;
            const yi = p1.y;
            const xj = p2.x;
            const yj = p2.y;

            const intersect = ((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            
            if (intersect) inside = !inside;
        }

        if (!inside) {
            for (let i = 0; i < points.length; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % points.length];
                
                if (p1 && p2) {
                    const distance = this.distanceToSegment(point, p1, p2);
                    if (distance <= padding) return true;
                }
            }
        }

        return inside;
    }

    private distanceToSegment(p: Point, a: Point, b: Point): number {
        if (!a || !b) return Infinity;
        
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
        
        if (points.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasValidPoints = false;

        for (const p of points) {
            if (p) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
                hasValidPoints = true;
            }
        }

        if (!hasValidPoints) {
            const maxRadius = Math.max(this.outerRadius, this.innerRadius);
            return {
                minX: this.position.x - maxRadius,
                minY: this.position.y - maxRadius,
                maxX: this.position.x + maxRadius,
                maxY: this.position.y + maxRadius,
            };
        }

        return { minX, minY, maxX, maxY };
    }

render(ctx: CanvasRenderingContext2D): void {
    const validPoints: Point[] = [];
    const points = this.getPoints();
    
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
    
    ctx.lineTo(firstPoint.x, firstPoint.y);
    
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

    move(delta: Point): void {
        this.position.x += delta.x;
        this.position.y += delta.y;
    }
}

shapeRegistry.register('star', StarShape);