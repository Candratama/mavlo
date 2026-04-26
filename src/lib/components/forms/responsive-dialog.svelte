<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Sheet from '$lib/components/ui/sheet';
	import type { Snippet } from 'svelte';

	type Props = {
		open: boolean;
		title: string;
		description?: string;
		children: Snippet;
		class?: string;
	};

	let {
		open = $bindable(),
		title,
		description,
		children,
		class: className = ''
	}: Props = $props();
</script>

<div class="md:hidden">
	<Sheet.Root bind:open>
		<Sheet.Content
			side="bottom"
			class="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] {className}"
		>
			<Sheet.Header class="text-left">
				<Sheet.Title>{title}</Sheet.Title>
				{#if description}<Sheet.Description>{description}</Sheet.Description>{/if}
			</Sheet.Header>
			<div class="mt-2">
				{@render children()}
			</div>
		</Sheet.Content>
	</Sheet.Root>
</div>

<div class="hidden md:block">
	<Dialog.Root bind:open>
		<Dialog.Content class={className}>
			<Dialog.Header>
				<Dialog.Title>{title}</Dialog.Title>
				{#if description}<Dialog.Description>{description}</Dialog.Description>{/if}
			</Dialog.Header>
			{@render children()}
		</Dialog.Content>
	</Dialog.Root>
</div>
