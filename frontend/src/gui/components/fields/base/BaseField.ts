import type { PropertyDescriptor } from '@/canvas/types/property';
import type { Component } from 'vue';

/**
 * Базовая стратегия обработки и рендеринга поля ввода.
 * Каждый наследник полностью определяет, как значение преобразуется и как оно отображается.
 */
export abstract class BaseField {
    abstract readonly type: string;

    /**
     * Какой Vue-компонент использовать для рендеринга этого поля
     */
    abstract get renderComponent(): Component;

    /**
     * Преобразование сырого значения из UI в целевой тип
     */
    abstract coerce(rawValue: unknown): unknown | null;

    /**
     * Валидация значения с учётом дескриптора свойства
     */
    abstract validate(
        value: unknown,
        descriptor: PropertyDescriptor
    ): string | null;

    /**
     * Форматирование значения для отображения в UI
     */
    abstract format(value: unknown): string;
}
