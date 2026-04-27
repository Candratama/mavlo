import { describe, it, expect } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import PickerSheet from './picker-sheet.svelte';

describe('PickerSheet (smoke)', () => {
	it('renders trigger with placeholder when no value selected', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const cmp = mount(PickerSheet, {
			target,
			props: {
				items: [
					{ value: 'a', label: 'Apple' },
					{ value: 'b', label: 'Banana' }
				],
				value: '',
				placeholder: 'Choose…'
			}
		});
		flushSync();
		expect(target.textContent).toContain('Choose…');
		unmount(cmp);
		target.remove();
	});

	it('renders selected label when value matches an item', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const cmp = mount(PickerSheet, {
			target,
			props: {
				items: [
					{ value: 'a', label: 'Apple' },
					{ value: 'b', label: 'Banana' }
				],
				value: 'b',
				placeholder: 'Choose…'
			}
		});
		flushSync();
		expect(target.textContent).toContain('Banana');
		unmount(cmp);
		target.remove();
	});

	it('renders hidden input when name prop is set', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const cmp = mount(PickerSheet, {
			target,
			props: {
				items: [
					{ value: 'a', label: 'Apple' },
					{ value: 'b', label: 'Banana' }
				],
				value: 'a',
				name: 'fruit'
			}
		});
		flushSync();
		const hidden = target.querySelector<HTMLInputElement>('input[type="hidden"][name="fruit"]');
		expect(hidden?.value).toBe('a');
		unmount(cmp);
		target.remove();
	});
});
