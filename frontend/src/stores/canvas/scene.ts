import type { Point, Shape } from '@/canvas/types';
import type { SerializedShape } from './types';

type CreateShapeFn = (type: string, id: string, position: Point) => Shape;

export function serializeShape(shape: Shape): SerializedShape {
    const plain = JSON.parse(JSON.stringify(shape)) as SerializedShape;
    plain.type = (shape as unknown as { type: string }).type;
    plain.id = shape.id;
    plain.position = { x: shape.position.x, y: shape.position.y };
    plain.rotation = shape.rotation;
    plain.scaleX = shape.scaleX;
    plain.scaleY = shape.scaleY;
    plain.skewX = shape.skewX;
    plain.skewY = shape.skewY;
    return plain;
}

export function deserializeShapes(
    source: SerializedShape[],
    createShape: CreateShapeFn
): Shape[] {
    return source.map((plain) => {
        const { type, id, position, ...rest } = plain;
        const shape = createShape(type, id, position);
        Object.assign(shape, rest);
        return shape as Shape;
    });
}
