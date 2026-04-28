<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SvelteComponent } from 'svelte';

	type Props = {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		icon: typeof SvelteComponent<any>;
		title: string;
		description?: string;
		children?: Snippet;
	};

	let { icon: Icon, title, description, children }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
	<div class="bg-muted rounded-full p-3">
		<Icon class="text-muted-foreground size-6" />
	</div>
	<div class="space-y-1">
		<h3 class="text-sm font-medium">{title}</h3>
		{#if description}
			<p class="text-muted-foreground max-w-sm text-xs">{description}</p>
		{/if}
	</div>
	{#if children}
		<div class="mt-1">
			{@render children()}
		</div>
	{/if}
</div>
