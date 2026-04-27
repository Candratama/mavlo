import { describe, it, expect } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import SegmentedControl from './segmented-control.svelte';

describe('SegmentedControl (smoke)', () => {
	it('renders one button per option', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const cmp = mount(SegmentedControl, {
			target,
			props: {
				options: [
					{ value: 'a', label: 'A' },
					{ value: 'b', label: 'B' },
					{ value: 'c', label: 'C' }
				],
				value: 'a'
			}
		});
		flushSync();
		expect(target.querySelectorAll('[role="radio"]').length).toBe(3);
		unmount(cmp);
		target.remove();
	});

	it('marks selected option aria-checked=true', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const cmp = mount(SegmentedControl, {
			target,
			props: {
				options: [
					{ value: 'a', label: 'A' },
					{ value: 'b', label: 'B' }
				],
				value: 'b'
			}
		});
		flushSync();
		const buttons = target.querySelectorAll<HTMLButtonElement>('[role="radio"]');
		expect(buttons[0].getAttribute('aria-checked')).toBe('false');
		expect(buttons[1].getAttribute('aria-checked')).toBe('true');
		unmount(cmp);
		target.remove();
	});

	it('renders hidden input when name prop is set', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const cmp = mount(SegmentedControl, {
			target,
			props: {
				options: [
					{ value: 'a', label: 'A' },
					{ value: 'b', label: 'B' }
				],
				value: 'a',
				name: 'kind'
			}
		});
		flushSync();
		const hidden = target.querySelector<HTMLInputElement>('input[type="hidden"][name="kind"]');
		expect(hidden?.value).toBe('a');
		unmount(cmp);
		target.remove();
	});
});
