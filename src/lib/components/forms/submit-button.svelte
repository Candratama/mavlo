<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Loader2 } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	type Props = {
		pending?: boolean;
		disabled?: boolean;
		variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
		size?: 'default' | 'sm' | 'lg' | 'icon';
		class?: string;
		children?: Snippet;
	};

	let {
		pending = false,
		disabled = false,
		variant = 'default',
		size = 'default',
		class: className = '',
		children
	}: Props = $props();
</script>

<Button type="submit" {variant} {size} disabled={pending || disabled} class={className}>
	{#if pending}
		<Loader2 class="size-4 animate-spin" />
	{/if}
	{@render children?.()}
</Button>
