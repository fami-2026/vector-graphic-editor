export type { Point, BoundingBox } from './base';
export { BaseShape } from './base';
export { CircleShape } from './circle';
export { RectShape } from './rect';
export { LineShape } from './line';
export { PolygonShape } from './polygon';
export { TriangleShape } from './triangle';
export { StarShape } from './star';
export { ArrowShape } from './arrow';
export { HexagonShape } from './hexagon';
export { shapeRegistry } from './registry';
export { SELECTION_PADDING } from './base';

export type Shape = import('./base').BaseShape;
export type ShapeType = string;

export interface Viewport {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
}
