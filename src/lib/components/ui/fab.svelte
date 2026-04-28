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
		'lg:hidden fixed right-4 z-30 size-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform',
		'bottom-[calc(var(--bottom-nav-h)+1rem+env(safe-area-inset-bottom))]',
		className
	)}
>
	<Plus class="size-6" />
</button>
