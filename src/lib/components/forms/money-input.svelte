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

	function reformat() {
		if (cents === null) return;
		display = formatCentsToRupiah(cents);
	}

	function onInput(e: Event) {
		const raw = (e.currentTarget as HTMLInputElement).value;
		const cleaned = raw.replace(/[^\d.]/g, '');
		display = cleaned;
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
