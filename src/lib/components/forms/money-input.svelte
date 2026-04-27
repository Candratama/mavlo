<script lang="ts">
	import { tick } from 'svelte';
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

	let display = $state(
		value !== null && value !== undefined ? formatCentsToRupiah(value) : ''
	);

	const cents = $derived(parseRupiahToCents(display));

	$effect(() => {
		if (cents !== value) value = cents;
	});

	$effect(() => {
		if (value === null || value === undefined) {
			if (display !== '') display = '';
			return;
		}
		if (parseRupiahToCents(display) !== value) {
			display = formatCentsToRupiah(value);
		}
	});

	function formatDigits(digits: string): string {
		if (!digits) return '';
		return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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
		class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
	>
		Rp
	</span>
	<Input
		{id}
		type="text"
		inputmode="numeric"
		autocomplete="off"
		value={display}
		oninput={onInput}
		{placeholder}
		{required}
		class="pl-9 tabular-nums {className}"
	/>
	<input type="hidden" {name} value={cents ?? ''} />
	{#if required && cents === null && display !== ''}
		<p class="mt-1 text-xs text-destructive">Invalid amount</p>
	{:else if min !== undefined && cents !== null && cents < min}
		<p class="mt-1 text-xs text-destructive">Min Rp {formatCentsToRupiah(min)}</p>
	{/if}
</div>
