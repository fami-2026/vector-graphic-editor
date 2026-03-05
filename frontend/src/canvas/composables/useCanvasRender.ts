import type { Ref } from 'vue';
import type { Shape, LineShape } from '@/canvas/types';
import { SELECTION_PADDING } from '@/canvas/types';

/**
 * Composable для отрисовки фигур на канвасе.
 */

function isLineShape(shape: Shape): shape is LineShape {
    return shape.type === 'line';
}

const HANDLE_RADIUS = 4;

export function useCanvasRender(
    canvasRef: Ref<HTMLCanvasElement | null>,
    shapes: Ref<Shape[]>,
    selectedId: Ref<string | null>
) {
    /**
     * Рисует рамку выделения вокруг фигуры с учетом её поворота и масштаба.
     */
    function drawSelectionBox(ctx: CanvasRenderingContext2D, shape: Shape) {
        ctx.save();

        const m = shape.getVMatrix();
        ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);

        if (isLineShape(shape)) {
            const line = shape;

            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#2196F3'; // Синий цвет Figma
            ctx.lineWidth = 1.5;

            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            if (line.localEndPoint) {
                const ex = line.localEndPoint.x * line.scaleX;
                const ey = line.localEndPoint.y * line.scaleY;

                ctx.beginPath();
                ctx.arc(ex, ey, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        } else {
            const box = shape.getLocalBox();

            const x1 = box.minX * shape.scaleX;
            const y1 = box.minY * shape.scaleY;
            const x2 = box.maxX * shape.scaleX;
            const y2 = box.maxY * shape.scaleY;

            const rawX = Math.min(x1, x2);
            const rawY = Math.min(y1, y2);
            const rawW = Math.abs(x2 - x1);
            const rawH = Math.abs(y2 - y1);

            const rectX = rawX - SELECTION_PADDING;
            const rectY = rawY - SELECTION_PADDING;
            const rectW = rawW + SELECTION_PADDING * 2;
            const rectH = rawH + SELECTION_PADDING * 2;

            ctx.strokeStyle = '#2196F3';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(rectX, rectY, rectW, rectH);

            const visualAnchorY = rectY;
            const visualRotY = visualAnchorY - 20 + SELECTION_PADDING;

            ctx.beginPath();
            ctx.moveTo(0, visualAnchorY);
            ctx.lineTo(0, visualRotY);
            ctx.stroke();

            ctx.setLineDash([0, 0]);
            ctx.beginPath();
            ctx.arc(0, visualRotY, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.stroke();

            const hX1 = rectX;
            const hY1 = rectY;
            const hX2 = rectX + rectW;
            const hY2 = rectY + rectH;

            const handles: Array<[number, number]> = [
                [hX1, hY1], // lt
                [hX2, hY1], // rt
                [hX2, hY2], // rb
                [hX1, hY2], // lb
            ];

            handles.forEach(([x, y]) => {
                ctx.beginPath();
                ctx.arc(x, y, HANDLE_RADIUS, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });
        }
        ctx.restore();
    }

    /**
     * Основной цикл отрисовки. Очищает канвас и отрисовывает все фигуры.
     */
    function draw() {
        const canvas = canvasRef.value;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const shape of shapes.value) {
            ctx.save();
            shape.render(ctx);
            ctx.restore();
        }

        if (selectedId.value) {
            const selectedShape = shapes.value.find(
                (s) => s.id === selectedId.value
            );
            if (selectedShape) {
                drawSelectionBox(ctx, selectedShape);
            }
        }
    }

    return { draw };
}
