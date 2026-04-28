<script lang="ts" module>
	import type { Component } from 'svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export type IconComponent = Component<any> | (new (...args: any[]) => any);

	export type SegmentedOption = {
		value: string;
		label: string;
		icon?: IconComponent;
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

	const buttonEls: HTMLButtonElement[] = $state([]);

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
	class={cn('bg-muted inline-grid w-full gap-1 rounded-lg p-1', className)}
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
				'flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm transition-all',
				value === opt.value
					? 'bg-background text-foreground font-medium shadow-sm'
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
