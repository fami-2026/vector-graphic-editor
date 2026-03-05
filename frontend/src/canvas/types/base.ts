import { getEditableProperties } from './property';

export interface Point {
    x: number;
    y: number;
}

export interface BoundingBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export const MIN_ABS_SCALE = 0.01;

export const SELECTION_PADDING = 4;
/**
 * Абстрактная фигура на холсте.
 */
export abstract class BaseShape {
    abstract readonly type: string;

    constructor(
        public id: string,
        public position: Point
    ) {}

    get x(): number {
        return this.position.x;
    }
    set x(v: number) {
        this.position.x = v;
    }
    get y(): number {
        return this.position.y;
    }
    set y(v: number) {
        this.position.y = v;
    }
    rotation: number = 0;

    points?: Point[];

    _scaleX: number = 1;
    _scaleY: number = 1;

    /**
     * Масштабирование может быть использовано для изменения размера групп и отражений
     * Масштабирование не влияет на размеры объекта, а только умножает эти размеры на значения (возможно требует переработки)
     * Сейчас используется в основном для отражения
     */

    get scaleX(): number {
        return this._scaleX;
    }

    set scaleX(v: number) {
        this._scaleX = this.processScaleUpdate(v, this._scaleX);
    }

    get scaleY(): number {
        return this._scaleY;
    }

    set scaleY(v: number) {
        this._scaleY = this.processScaleUpdate(v, this._scaleY);
    }

    processScaleUpdate(newValue: number, oldValue: number): number {
        if (!Number.isFinite(newValue)) return 1;
        if (Math.abs(newValue) < 0.05) {
            return newValue < oldValue ? -MIN_ABS_SCALE : MIN_ABS_SCALE;
        }
        return Math.round(newValue * 10) / 10;
    }

    /**
     * Отражение.
     */
    flipX = () => {
        this.scaleX *= -1;
        this.rotation = (360 - this.rotation) % 360;
    };

    flipY = () => {
        this.scaleY *= -1;
        this.rotation = (180 - this.rotation + 360) % 360;
    };

    /**
     * Полная матрица (со скейлом).
     * Нужна для hitTest самого тела фигуры и для финальных расчетов.
     */
    getMatrix(): DOMMatrix {
        const m = this.getVMatrix();
        m.scaleSelf(this.scaleX, this.scaleY);
        return m;
    }

    getInverseMatrix(): DOMMatrix {
        return this.getMatrix().inverse();
    }

    /**
     * Возвращает аффинную матрицу трансформации для фигуры.
     * Матрица "Вида" (Позиция и Поворот) — для интерфейса и корректной обводки
     */
    getVMatrix(): DOMMatrix {
        const m = new DOMMatrix();
        m.translateSelf(this.position.x, this.position.y);
        m.rotateSelf(this.rotation);
        return m;
    }

    getInverseVMatrix(): DOMMatrix {
        return this.getVMatrix().inverse();
    }

    /**
     * Переводит точку из глобальных координат в локальные координаты фигуры.
     */
    toLocalPoint(globalPoint: Point): Point {
        const local = new DOMPoint(
            globalPoint.x,
            globalPoint.y
        ).matrixTransform(this.getInverseMatrix());

        return { x: local.x, y: local.y };
    }

    toVLocalPoint(globalPoint: Point): Point {
        const local = new DOMPoint(
            globalPoint.x,
            globalPoint.y
        ).matrixTransform(this.getInverseVMatrix());

        return { x: local.x, y: local.y };
    }

    /**
     * Переводит точку из локальных координат фигуры в глобальные.
     */
    toGlobalPoint(localPoint: Point): Point {
        const global = new DOMPoint(localPoint.x, localPoint.y).matrixTransform(
            this.getMatrix()
        );

        return { x: global.x, y: global.y };
    }

    abstract hitTest(globalPoint: Point): boolean;

    abstract getBoundingBox(): BoundingBox;

    abstract getLocalBox(): BoundingBox;

    abstract render(ctx: CanvasRenderingContext2D): void;
    abstract move(delta: Point): void;

    /**
     * Устанавливает новые размеры фигуры.
     */
    abstract setSize(width: number, height: number): void;

    /**
     * Получает список редактируемых свойств для панели управления.
     */
    getProperties() {
        return getEditableProperties(this);
    }
}
