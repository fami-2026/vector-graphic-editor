import type { Point, Shape } from '@/canvas/types';
import type { SerializedShape } from './types';

type CreateShapeFn = (type: string, id: string, position: Point) => Shape;
type GenerateIdFn = () => string;

export type CreateOffsetCloneOptions = {
    offset: Point;
    nameSuffix: string;
    createShape: CreateShapeFn;
    generateId: GenerateIdFn;
};

export function getShapeNameForClone(plain: SerializedShape): string {
    const rawName = (plain as SerializedShape & { name?: unknown }).name;
    if (typeof rawName === 'string' && rawName.trim()) {
        return rawName;
    }

    return plain.type;
}

export function createOffsetShapeClone(
    plain: SerializedShape,
    options: CreateOffsetCloneOptions
): Shape {
    const { type, id: _oldId, position, ...rest } = plain;

    const newId = options.generateId();
    const newPosition = {
        x: position.x + options.offset.x,
        y: position.y + options.offset.y,
    };

    const clonedShape = options.createShape(type, newId, newPosition);
    Object.assign(clonedShape, rest);

    clonedShape.id = newId;
    clonedShape.position = newPosition;

    if ('name' in clonedShape) {
        (clonedShape as Shape).name = `${getShapeNameForClone(plain)}${options.nameSuffix}`;
    }

    return clonedShape as Shape;
}
