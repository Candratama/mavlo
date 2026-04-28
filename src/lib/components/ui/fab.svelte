<script lang="ts">
	import { Plus } from 'lucide-svelte';
	import { openAddTransaction } from '$lib/stores/add-transaction.svelte.js';
	import { cn } from '$lib/utils.js';

	type Props = { class?: string };
	let { class: className = '' }: Props = $props();
</script>

<button
	type="button"
	aria-label="Add transaction"
	onclick={() => openAddTransaction('expense')}
	class={cn(
		'mavlo-pill mavlo-pill-solid text-foreground flex size-16 shrink-0 items-center justify-center rounded-full border transition-transform hover:-translate-y-0.5 active:scale-95',
		className
	)}
>
	<Plus class="size-6" />
</button>
