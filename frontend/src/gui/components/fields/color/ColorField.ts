import { BaseField } from '../base/BaseField';
import ColorInput from './ColorInput.vue';
import { fieldRegistry } from '../registry';

export class ColorField extends BaseField {
    readonly type = 'color';

    get renderComponent() {
        return ColorInput;
    }

    coerce(rawValue: unknown): string | null {
        const str = String(rawValue ?? '').trim();
        return /^#[0-9A-Fa-f]{6}$/.test(str) ? str : null;
    }

    validate(value: unknown): string | null {
        if (typeof value !== 'string') return 'Ожидается строка';
        if (!/^#[0-9A-Fa-f]{6}$/.test(value))
            return 'Неверный формат цвета (#RRGGBB)';
        return null;
    }

    format(value: unknown): string {
        return String(value ?? '');
    }
}

fieldRegistry.register('color', new ColorField());
