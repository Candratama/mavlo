<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { formatCentsToRupiah, parseRupiahToCents } from '$lib/utils/money.js';

	type Props = {
		/** Form field name; submits as integer cents. */
		name: string;
		/** Initial value in cents. */
		value?: number | null;
		required?: boolean;
		min?: number;
		id?: string;
		placeholder?: string;
		class?: string;
	};

	let {
		name,
		value = null,
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

	function formatDigits(digits: string): string {
		if (!digits) return '';
		return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
	}

	function onInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const raw = input.value;
		const oldCursor = input.selectionStart ?? raw.length;
		const digitsBeforeCursor = raw.slice(0, oldCursor).replace(/\D/g, '').length;
		const digits = raw.replace(/\D/g, '');
		const formatted = formatDigits(digits);
		display = formatted;
		queueMicrotask(() => {
			let target = 0;
			let count = 0;
			while (target < formatted.length && count < digitsBeforeCursor) {
				if (/\d/.test(formatted[target])) count++;
				target++;
			}
			try {
				input.setSelectionRange(target, target);
			} catch {
				// non-text inputs don't support selection
			}
		});
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
		onblur={reformat}
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
