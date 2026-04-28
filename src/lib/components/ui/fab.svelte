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
		'bg-primary text-primary-foreground fixed right-4 z-30 flex size-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 lg:hidden',
		'bottom-[calc(var(--bottom-nav-h)+1rem+env(safe-area-inset-bottom))]',
		className
	)}
>
	<Plus class="size-6" />
</button>
