import { BaseField } from '../base/BaseField';
import type { PropertyDescriptor } from '@/canvas/types/property';
import NumberInput from './NumberInput.vue';
import { fieldRegistry } from '../registry';

export class NumberField extends BaseField {
    readonly type = 'number';

    get renderComponent() {
        return NumberInput;
    }

    coerce(rawValue: unknown): number | null {
        if (typeof rawValue === 'number') return rawValue;
        const parsed = parseFloat(String(rawValue).trim());
        return isNaN(parsed) ? null : parsed;
    }

    validate(value: unknown, descriptor: PropertyDescriptor): string | null {
        if (typeof value !== 'number') return 'Значение должно быть числом';
        if (descriptor.min !== undefined && value < descriptor.min) {
            return `Минимум: ${descriptor.min}`;
        }
        if (descriptor.max !== undefined && value > descriptor.max) {
            return `Максимум: ${descriptor.max}`;
        }
        return null;
    }

    format(value: unknown): string {
        const num = Number(value);
        if (isNaN(num)) return '';
        return Number.isInteger(num) ? String(num) : num.toFixed(2);
    }
}

fieldRegistry.register('number', new NumberField());
