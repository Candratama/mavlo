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

<div class="flex flex-col items-center justify-center gap-4 px-4 py-14 text-center">
	<div class="relative">
		<div class="bg-muted/60 border-border/50 flex size-14 items-center justify-center rounded-2xl border shadow-sm">
			<Icon class="text-muted-foreground size-6" />
		</div>
	</div>
	<div class="space-y-1.5">
		<h3 class="text-sm font-semibold tracking-tight">{title}</h3>
		{#if description}
			<p class="text-muted-foreground max-w-[22rem] text-xs leading-relaxed">{description}</p>
		{/if}
	</div>
	{#if children}
		<div class="mt-1">
			{@render children()}
		</div>
	{/if}
</div>
