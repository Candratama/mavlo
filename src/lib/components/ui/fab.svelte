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
	onclick={() => openAddTransaction({ defaultKind: 'expense' })}
	class={cn(
		'mavlo-pill flex size-16 shrink-0 items-center justify-center rounded-full border !bg-white/80 text-neutral-900 backdrop-blur-md transition-transform hover:-translate-y-0.5 hover:!bg-white/90 active:scale-95',
		className
	)}
>
	<Plus class="size-6" />
</button>
