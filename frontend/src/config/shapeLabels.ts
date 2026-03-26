export const SHAPE_LABELS: Readonly<Record<string, string>> = {
    rect: 'Прямоугольник',
    circle: 'Круг',
    line: 'Линия',
    triangle: 'Треугольник',
    polygon: 'Многоугольник',
    star: 'Звезда',
    arrow: 'Стрелка',
    hexagon: 'Шестиугольник',
    parallelogram: 'Параллелограмм',
    pencil: 'Карандаш',
};

export function getShapeLabel(type: string): string {
    return SHAPE_LABELS[type] ?? type;
}

