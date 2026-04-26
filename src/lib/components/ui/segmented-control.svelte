<script lang="ts" module>
	import type { Component } from 'svelte';

	export type SegmentedOption = {
		value: string;
		label: string;
		icon?: Component;
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils.js';

	type Props = {
		options: SegmentedOption[];
		value: string;
		name?: string;
		ariaLabel?: string;
		class?: string;
	};

	let {
		options,
		value = $bindable(),
		name,
		ariaLabel = 'Selection',
		class: className = ''
	}: Props = $props();

	let buttonEls: HTMLButtonElement[] = [];

	function onKeydown(e: KeyboardEvent) {
		const idx = options.findIndex((o) => o.value === value);
		if (idx < 0) return;
		let next = -1;
		if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
			e.preventDefault();
			next = (idx + 1) % options.length;
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
			e.preventDefault();
			next = (idx - 1 + options.length) % options.length;
		}
		if (next >= 0) {
			value = options[next].value;
			queueMicrotask(() => buttonEls[next]?.focus());
		}
	}
</script>

<div
	role="radiogroup"
	aria-label={ariaLabel}
	tabindex="-1"
	class={cn(
		'inline-grid w-full rounded-lg bg-muted p-1 gap-1',
		className
	)}
	style="grid-template-columns: repeat({options.length}, minmax(0, 1fr));"
	onkeydown={onKeydown}
>
	{#each options as opt, i (opt.value)}
		<button
			bind:this={buttonEls[i]}
			type="button"
			role="radio"
			aria-checked={value === opt.value}
			tabindex={value === opt.value ? 0 : -1}
			onclick={() => (value = opt.value)}
			class={cn(
				'flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm transition-all',
				value === opt.value
					? 'bg-background text-foreground shadow-sm font-medium'
					: 'text-muted-foreground hover:text-foreground'
			)}
		>
			{#if opt.icon}
				<opt.icon class="size-4" />
			{/if}
			<span>{opt.label}</span>
		</button>
	{/each}
</div>

{#if name}
	<input type="hidden" {name} {value} />
{/if}
