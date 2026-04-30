<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { Input } from '$lib/components/ui/input';
	import { formatCentsToRupiah, parseRupiahToCents } from '$lib/utils/money.js';

	type Props = {
		name: string;
		value?: number | null;
		required?: boolean;
		min?: number;
		id?: string;
		placeholder?: string;
		class?: string;
	};

	let {
		name,
		value = $bindable(null),
		required = false,
		min = 0,
		id,
		placeholder = '0',
		class: className = ''
	}: Props = $props();

	let display = $state(value !== null && value !== undefined ? formatCentsToRupiah(value) : '');

	const cents = $derived(parseRupiahToCents(display));

	// Sync prop → display when parent updates value externally (e.g. opening edit sheet).
	// Uses $effect.pre so display is reconciled BEFORE the display→value effect reads it,
	// avoiding a race where stale empty display overwrites the just-set prop back to null.
	// `untrack` keeps display reads non-reactive — effect only re-fires on value changes,
	// so user typing won't trigger this branch and reset the cursor.
	$effect.pre(() => {
		const v = value;
		untrack(() => {
			if (v === null || v === undefined) {
				if (display !== '') display = '';
				return;
			}
			if (parseRupiahToCents(display) !== v) {
				display = formatCentsToRupiah(v);
			}
		});
	});

	// Sync display → value when user types.
	$effect(() => {
		if (cents !== value) value = cents;
	});

	function formatDigits(digits: string): string {
		if (!digits) return '';
		return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
	}

	function onBeforeInput(e: Event) {
		const ev = e as InputEvent;
		// Block any inserted text that isn't a pure digit string.
		if (ev.inputType?.startsWith('insert') && typeof ev.data === 'string') {
			if (!/^\d+$/.test(ev.data)) ev.preventDefault();
		}
	}

	async function onInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const raw = input.value;
		const oldCursor = input.selectionStart ?? raw.length;
		const digitsBeforeCursor = raw.slice(0, oldCursor).replace(/\D/g, '').length;
		const digits = raw.replace(/\D/g, '');
		const formatted = formatDigits(digits);
		display = formatted;
		await tick();
		let target = 0;
		let count = 0;
		while (target < formatted.length && count < digitsBeforeCursor) {
			if (/\d/.test(formatted[target])) count++;
			target++;
		}
		const apply = () => {
			try {
				input.setSelectionRange(target, target);
			} catch {
				// non-text inputs don't support selection
			}
		};
		apply();
		// Defensive: bind:value on the inner input may write input.value reactively
		// after our setSelectionRange (especially when formatted length differs from
		// raw, e.g. when the thousands separator is added). Re-apply on the next
		// frame so our cursor wins.
		requestAnimationFrame(apply);
	}
</script>

<div class="relative">
	<span
		class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
	>
		Rp
	</span>
	<Input
		{id}
		type="text"
		inputmode="numeric"
		pattern="[0-9]*"
		autocomplete="off"
		value={display}
		oninput={onInput}
		onbeforeinput={onBeforeInput}
		{placeholder}
		{required}
		class="pl-9 tabular-nums {className}"
	/>
	<input type="hidden" {name} value={cents ?? ''} />
	{#if required && cents === null && display !== ''}
		<p class="text-destructive mt-1 text-xs">Invalid amount</p>
	{:else if min !== undefined && cents !== null && cents < min}
		<p class="text-destructive mt-1 text-xs">Min Rp {formatCentsToRupiah(min)}</p>
	{/if}
</div>
