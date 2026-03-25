import { Editable } from '../property';
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

export class ArrowShape extends BaseShape {
    type = 'arrow';

    flipY = () => {
        this.scaleY *= -1;
    };

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

    @Editable({ label: 'Длина', type: 'number', min: 20, max: 500 })
    length: number = 150;

    @Editable({
        label: 'Размер наконечника',
        type: 'number',
        min: 10,
        max: 100,
    })
    headSize: number = 30;

    @Editable({ label: 'Толщина', type: 'number', min: 5, max: 50 })
    thickness: number = 15;

    @Editable({ label: 'Поворот', type: 'number', min: 0, max: 360, step: 1 })
    rotation: number = 0;

    @Editable({ label: 'Цвет заливки', type: 'color' })
    fill: string;

    @Editable({
        label: 'Прозрачность заливки',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.1,
    })
    fillOpacity: number = 1;

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

    constructor(
        id: string,
        position: Point,
        length: number = 150,
        headSize: number = 30,
        thickness: number = 15,
        rotation: number = 0,
        fill: string = '#3498db',
        fillOpacity: number = 0,
        stroke: string = '#2c3e50',
        strokeOpacity: number = 1,
        strokeWidth: number = 2
    ) {
        super(id, position);
        this.length = length;
        this.headSize = headSize;
        this.thickness = thickness;
        this.rotation = rotation;
        this.fill = fill;
        this.fillOpacity = fillOpacity;
        this.stroke = stroke;
        this.strokeOpacity = strokeOpacity;
        this.strokeWidth = strokeWidth;
        this.strokeWidth = Math.min(10, Math.max(0.5, strokeWidth));
    }

    setSize(width: number, height: number): void {
        this.length = Math.max(20, width);
        this.thickness = Math.max(5, height);
        this.headSize = Math.min(this.headSize, this.length);
    }
    
    private _strokeWidth: number = 2;

    private getLocalLinePoints(): { start: Point; end: Point } {
        const headBase = this.length - this.headSize;
        const centerX = this.length / 2; // Центр по X
        return {
            start: { x: -centerX, y: 0 },
            end: { x: headBase - centerX, y: 0 }
        };
    }

    private getLocalHeadLines(): { left: { start: Point; end: Point }; right: { start: Point; end: Point } } {
        const headBase = this.length - this.headSize;
        const centerX = this.length / 2;
        const angle = Math.PI / 4;
        const headLength = this.headSize;
        
        const leftEnd = {
            x: (headBase - headLength * Math.cos(angle)) - centerX,
            y: -headLength * Math.sin(angle)
        };
        
        const rightEnd = {
            x: (headBase - headLength * Math.cos(angle)) - centerX,
            y: headLength * Math.sin(angle)
        };
        
        return {
            left: {
                start: { x: headBase - centerX, y: this.strokeWidth * 0.28},
                end: leftEnd
            },
            right: {
                start: { x: headBase - centerX, y: this.strokeWidth * (-0.28)},
                end: rightEnd
            }
        };
    }

    private getLocalArrowPoints(): Point[] {
        const halfThick = this.thickness / 2;
        const headBase = this.length - this.headSize;
        const centerX = this.length / 2;

        return [
            { x: -centerX, y: -halfThick },
            { x: headBase - centerX, y: -halfThick },
            { x: headBase - centerX, y: -this.headSize },
            { x: this.length - centerX, y: 0 },
            { x: headBase - centerX, y: this.headSize },
            { x: headBase - centerX, y: halfThick },
            { x: -centerX, y: halfThick },
        ];
    }

    private getScaledLocalArrowPoints(): Point[] {
        const points = this.getLocalArrowPoints();
        return points.map((p) => ({
            x: p.x * this.scaleX,
            y: p.y * this.scaleY,
        }));
    }

    private getScaledLocalLinePoints(): { start: Point; end: Point } {
        const { start, end } = this.getLocalLinePoints();
        return {
            start: { x: start.x * this.scaleX, y: start.y * this.scaleY },
            end: { x: end.x * this.scaleX, y: end.y * this.scaleY }
        };
    }

    private getScaledLocalHeadLines(): { left: { start: Point; end: Point }; right: { start: Point; end: Point } } {
        const { left, right } = this.getLocalHeadLines();
        return {
            left: {
                start: { x: left.start.x * this.scaleX, y: left.start.y * this.scaleY },
                end: { x: left.end.x * this.scaleX, y: left.end.y * this.scaleY }
            },
            right: {
                start: { x: right.start.x * this.scaleX, y: right.start.y * this.scaleY },
                end: { x: right.end.x * this.scaleX, y: right.end.y * this.scaleY }
            }
        };
    }

    hitTest(globalPoint: Point): boolean {
        const point = this.toVLocalPoint(globalPoint);
        const points = this.getScaledLocalArrowPoints();
        const padding = this.strokeWidth / 2 + 3;

        let inside = false;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            const pi = points[i];
            const pj = points[j];

            if (!pi || !pj) continue;

            const intersect =
                pi.y > point.y !== pj.y > point.y &&
                point.x <
                    ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;

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

        return inside;
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
        const box = this.getLocalBox();
        const corners = [
            this.toGlobalPoint({ x: box.minX, y: box.minY }),
            this.toGlobalPoint({ x: box.maxX, y: box.minY }),
            this.toGlobalPoint({ x: box.maxX, y: box.maxY }),
            this.toGlobalPoint({ x: box.minX, y: box.maxY }),
        ];
        return {
            minX: Math.min(...corners.map((p) => p.x)),
            minY: Math.min(...corners.map((p) => p.y)),
            maxX: Math.max(...corners.map((p) => p.x)),
            maxY: Math.max(...corners.map((p) => p.y)),
        };
    }

    getLocalBox(): BoundingBox {
        const halfThick = this.thickness / 2;
        const halfHead = this.headSize;
        const centerX = this.length / 2;
        return {
            minX: -centerX,
            minY: -Math.max(halfThick, halfHead),
            maxX: this.length - centerX,
            maxY: Math.max(halfThick, halfHead),
        };
    }

    render(ctx: CanvasRenderingContext2D): void {
        const linePoints = this.getScaledLocalLinePoints();
        const headLines = this.getScaledLocalHeadLines();

        ctx.save();
        const m = this.getVMatrix();
        ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);

        ctx.beginPath();
        ctx.moveTo(linePoints.start.x, linePoints.start.y);
        ctx.lineTo(linePoints.end.x, linePoints.end.y);
        
        ctx.globalAlpha = this.strokeOpacity;
        ctx.strokeStyle = this.stroke;
        ctx.lineWidth = this.strokeWidth;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(headLines.left.start.x, headLines.left.start.y);
        ctx.lineTo(headLines.left.end.x, headLines.left.end.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(headLines.right.start.x, headLines.right.start.y);
        ctx.lineTo(headLines.right.end.x, headLines.right.end.y);
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.restore();
    }

    move(delta: Point): void {
        this.position.x += delta.x;
        this.position.y += delta.y;
    }
}

shapeRegistry.register('arrow', ArrowShape);
