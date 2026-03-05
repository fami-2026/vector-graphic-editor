/**
 * Кривая Безье
 */
import { Editable } from '../property';
import type { BoundingBox, Point } from '../base';
import { BaseShape } from '../base';
import { shapeRegistry } from '../registry';

export class CurveShape extends BaseShape {
    type = 'curve';

    @Editable({ label: 'Start Point X', type: 'number' })
    startX: number;

    @Editable({ label: 'Start Point Y', type: 'number' })
    startY: number;

    @Editable({ label: 'End Point X', type: 'number' })
    endX: number;

    @Editable({ label: 'End Point Y', type: 'number' })
    endY: number;

    @Editable({ label: 'Control Point 1 X', type: 'number' })
    cp1X: number;

    @Editable({ label: 'Control Point 1 Y', type: 'number' })
    cp1Y: number;

    @Editable({ label: 'Control Point 2 X', type: 'number' })
    cp2X: number;

    @Editable({ label: 'Control Point 2 Y', type: 'number' })
    cp2Y: number;

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

    // Флаг для отслеживания количества изгибов
    bendCount: number = 0;

    constructor(
        id: string,
        position: Point,
        startX: number = 50,
        startY: number = 100,
        endX: number = 250,
        endY: number = 100,
        cp1X?: number,
        cp1Y?: number,
        cp2X?: number,
        cp2Y?: number,
        stroke: string = '#2c3e50',
        strokeWidth: number = 2
    ) {
        super(id, position);
        
        this.startX = startX;
        this.startY = startY;
        this.endX = endX;
        this.endY = endY;
        
        // Если контрольные точки не переданы, делаем прямую линию
        // (контрольные точки на 1/3 и 2/3 от начала)
        const dx = endX - startX;
        const dy = endY - startY;
        
        this.cp1X = cp1X ?? startX + dx / 3;
        this.cp1Y = cp1Y ?? startY + dy / 3;
        this.cp2X = cp2X ?? startX + 2 * dx / 3;
        this.cp2Y = cp2Y ?? startY + 2 * dy / 3;
        
        // Подсчитываем количество изгибов (есть ли отклонения от прямой)
        this.updateBendCount();
        
        this.stroke = stroke;
        this.strokeWidth = strokeWidth;
    }

    private updateBendCount() {
        const dx = this.endX - this.startX;
        const dy = this.endY - this.startY;
        
        // Проверяем отклонение первой контрольной точки от прямой
        const straightC1X = this.startX + dx / 3;
        const straightC1Y = this.startY + dy / 3;
        const dist1 = Math.sqrt(
            Math.pow(this.cp1X - straightC1X, 2) + 
            Math.pow(this.cp1Y - straightC1Y, 2)
        );
        
        // Проверяем отклонение второй контрольной точки от прямой
        const straightC2X = this.startX + 2 * dx / 3;
        const straightC2Y = this.startY + 2 * dy / 3;
        const dist2 = Math.sqrt(
            Math.pow(this.cp2X - straightC2X, 2) + 
            Math.pow(this.cp2Y - straightC2Y, 2)
        );
        
        // Считаем изгибами отклонения больше 5 пикселей
        this.bendCount = (dist1 > 5 ? 1 : 0) + (dist2 > 5 ? 1 : 0);
    }

    // Добавить изгиб в указанной точке
    addBend(x: number, y: number): boolean {
        if (this.bendCount >= 2) return false;
        
        // Находим ближайшую позицию для вставки
        const t = this.findClosestT(x, y);
        
        if (this.bendCount === 0) {
            // Первый изгиб - меняем cp1
            this.cp1X = x;
            this.cp1Y = y;
        } else {
            // Второй изгиб - меняем cp2
            this.cp2X = x;
            this.cp2Y = y;
        }
        
        this.bendCount++;
        return true;
    }

    // Найти параметр t ближайшей точки на кривой
    private findClosestT(x: number, y: number): number {
        const steps = 50;
        let minDist = Infinity;
        let bestT = 0.5;
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const tx = this.cubicBezier(this.startX, this.cp1X, this.cp2X, this.endX, t);
            const ty = this.cubicBezier(this.startY, this.cp1Y, this.cp2Y, this.endY, t);
            
            const dist = Math.sqrt(Math.pow(x - tx, 2) + Math.pow(y - ty, 2));
            if (dist < minDist) {
                minDist = dist;
                bestT = t;
            }
        }
        
        return bestT;
    }

    hitTest(point: Point): boolean {
        const padding = this.strokeWidth / 2 + 3;
        
        const steps = 50;
        let minDistance = Infinity;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = this.cubicBezier(this.startX, this.cp1X, this.cp2X, this.endX, t);
            const y = this.cubicBezier(this.startY, this.cp1Y, this.cp2Y, this.endY, t);
            
            const dx = point.x - x;
            const dy = point.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            minDistance = Math.min(minDistance, distance);
            
            if (minDistance <= padding) {
                return true;
            }
        }

        return false;
    }

    private cubicBezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
        const mt = 1 - t;
        return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
    }

    getBoundingBox(): BoundingBox {
        const points = [
            { x: this.startX, y: this.startY },
            { x: this.cp1X, y: this.cp1Y },
            { x: this.cp2X, y: this.cp2Y },
            { x: this.endX, y: this.endY }
        ];

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for (const p of points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }

        return { minX, minY, maxX, maxY };
    }

    render(ctx: CanvasRenderingContext2D): void {
        ctx.strokeStyle = this.stroke;
        ctx.lineWidth = this.strokeWidth;

        ctx.beginPath();
        ctx.moveTo(this.startX, this.startY);
        ctx.bezierCurveTo(
            this.cp1X, this.cp1Y,
            this.cp2X, this.cp2Y,
            this.endX, this.endY
        );
        ctx.stroke();
    }

    move(delta: Point): void {
        this.startX += delta.x;
        this.startY += delta.y;
        this.endX += delta.x;
        this.endY += delta.y;
        this.cp1X += delta.x;
        this.cp1Y += delta.y;
        this.cp2X += delta.x;
        this.cp2Y += delta.y;
        this.position.x += delta.x;
        this.position.y += delta.y;
    }
}

shapeRegistry.register('curve', CurveShape);