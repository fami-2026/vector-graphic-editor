/**
 * Шестиугольник.
 */
import { Editable } from '../property';
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

export class HexagonShape extends BaseShape {
    type = 'hexagon';

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
     * @param position Центр шестиугольника
     * @param radius Радиус описанной окружности 
     * @param rotation Поворот в градусах
     * @param fill Цвет заливки 
     * @param stroke Цвет границы 
     * @param strokeWidth Толщина границы 
     */
    constructor(
        id: string,
        position: Point,
        radius: number = 50,
        rotation: number = 0,
        fill: string = '#2ecc71',
        stroke: string = '#27ae60',
        strokeWidth: number = 2
    ) {
        super(id, position);
        this.radius = radius;
        this.rotation = rotation;
        this.fill = fill;
        this.stroke = stroke;
        this.strokeWidth = strokeWidth;
    }

    private getPoints(): Point[] {
        const points: Point[] = [];
        const angleStep = (Math.PI * 2) / 6; 
        const rotationRad = (this.rotation * Math.PI) / 180;

        for (let i = 0; i < 6; i++) {
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
            const xi = points[i]?.x;
            const yi = points[i]?.y;
            const xj = points[j]?.x;
            const yj = points[j]?.y;

            if (xi === undefined || yi === undefined || xj === undefined || yj === undefined) {
                continue;
            }

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

        for (const p of points) {
            if (p) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }
        }

        if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
            return {
                minX: this.position.x - this.radius,
                minY: this.position.y - this.radius,
                maxX: this.position.x + this.radius,
                maxY: this.position.y + this.radius,
            };
        }

        return { minX, minY, maxX, maxY };
    }

   render(ctx: CanvasRenderingContext2D): void {
    const points = this.getPoints();

    if (points.length < 3) return;

    ctx.fillStyle = this.fill;
    ctx.strokeStyle = this.stroke;
    ctx.lineWidth = this.strokeWidth;

    ctx.beginPath();
    
    let firstPoint: Point | null = null;
    let firstPointIndex = -1;
    
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        if (point) {
            firstPoint = point;
            firstPointIndex = i;
            ctx.moveTo(point.x, point.y);
            break;
        }
    }
    
    if (!firstPoint) return;
    
    for (let i = firstPointIndex + 1; i < points.length; i++) {
        const point = points[i];
        if (point) {
            ctx.lineTo(point.x, point.y);
        }
    }
    
    // Замыкаем путь к первой точке
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

shapeRegistry.register('hexagon', HexagonShape);