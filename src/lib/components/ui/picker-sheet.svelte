<script lang="ts" module>
	import type { Component } from 'svelte';

	export type PickerItem = {
		value: string;
		label: string;
		description?: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		icon?: Component<any, any, any>;
	};

	export type PickerGroup = {
		label: string;
		items: PickerItem[];
	};
</script>

<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { ChevronDown, Check, Search } from 'lucide-svelte';
	import { Popover } from 'bits-ui';
	import { MediaQuery } from 'svelte/reactivity';
	import { cn } from '$lib/utils.js';

	type Props = {
		items?: PickerItem[];
		groups?: PickerGroup[];
		value: string;
		name?: string;
		placeholder?: string;
		title?: string;
		searchable?: boolean;
		disabled?: boolean;
		id?: string;
		class?: string;
	};

	let {
		items,
		groups,
		value = $bindable(),
		name,
		placeholder = 'Select…',
		title = 'Select',
		searchable = false,
		disabled = false,
		id,
		class: className = ''
	}: Props = $props();

	let open = $state(false);
	let query = $state('');

	const isDesktop = new MediaQuery('(min-width: 768px)');

	const flat = $derived<PickerItem[]>(groups ? groups.flatMap((g) => g.items) : (items ?? []));
	const selected = $derived(flat.find((i) => i.value === value));

	function matches(it: PickerItem, q: string): boolean {
		if (!q) return true;
		const needle = q.toLowerCase();
		return it.label.toLowerCase().includes(needle);
	}

	const filteredGroups = $derived<PickerGroup[]>(
		groups
			? groups
					.map((g) => ({ label: g.label, items: g.items.filter((i) => matches(i, query)) }))
					.filter((g) => g.items.length)
			: []
	);

	const filteredItems = $derived<PickerItem[]>(
		!groups ? (items ?? []).filter((i) => matches(i, query)) : []
	);

	function pick(v: string) {
		value = v;
		open = false;
		query = '';
	}

	const triggerClass = $derived(
		cn(
			'flex h-9 md:h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm transition-colors disabled:opacity-50 hover:bg-accent/30',
			!selected && 'text-muted-foreground',
			className
		)
	);
</script>

{#snippet listBody()}
	{#if searchable}
		<div class="relative px-2 pt-2 pb-2">
			<Search
				class="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 opacity-50"
			/>
			<Input type="search" placeholder="Search…" bind:value={query} class="pl-9" />
		</div>
	{/if}
	{#if groups}
		{#each filteredGroups as g (g.label)}
			<div class="text-muted-foreground px-3 pt-3 pb-1 text-xs font-medium tracking-wide uppercase">
				{g.label}
			</div>
			<ul>
				{#each g.items as it (it.value)}
					<li>
						<button
							type="button"
							onclick={() => pick(it.value)}
							class={cn(
								'hover:bg-accent/50 flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
								value === it.value && 'bg-accent/30'
							)}
						>
							<span class="flex min-w-0 items-center gap-2">
								{#if it.icon}
									<it.icon class="size-4 shrink-0" />
								{/if}
								<span class="flex min-w-0 flex-col">
									<span class="truncate">{it.label}</span>
									{#if it.description}
										<span class="text-muted-foreground truncate text-xs">{it.description}</span>
									{/if}
								</span>
							</span>
							{#if value === it.value}
								<Check class="text-primary size-4" />
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/each}
	{:else}
		<ul>
			{#each filteredItems as it (it.value)}
				<li>
					<button
						type="button"
						onclick={() => pick(it.value)}
						class={cn(
							'hover:bg-accent/50 flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
							value === it.value && 'bg-accent/30'
						)}
					>
						<span class="flex min-w-0 items-center gap-2">
							{#if it.icon}
								<it.icon class="size-4 shrink-0" />
							{/if}
							<span class="flex min-w-0 flex-col">
								<span class="truncate">{it.label}</span>
								{#if it.description}
									<span class="text-muted-foreground truncate text-xs">{it.description}</span>
								{/if}
							</span>
						</span>
						{#if value === it.value}
							<Check class="text-primary size-4" />
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

{#if isDesktop.current}
	<Popover.Root bind:open>
		<Popover.Trigger>
			{#snippet child({ props })}
				<button {...props} type="button" {id} {disabled} class={triggerClass}>
					<span class="flex min-w-0 items-center gap-2">
						{#if selected?.icon}
							<selected.icon class="size-4 shrink-0" />
						{/if}
						<span class="truncate">{selected?.label ?? placeholder}</span>
					</span>
					<ChevronDown class="size-4 shrink-0 opacity-60" />
				</button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content
			side="bottom"
			align="start"
			sideOffset={4}
			onOpenAutoFocus={(e) => e.preventDefault()}
			class="bg-popover text-popover-foreground z-50 max-h-80 overflow-y-auto rounded-md border shadow-md outline-none"
			style="width: var(--bits-popover-anchor-width)"
		>
			{@render listBody()}
		</Popover.Content>
	</Popover.Root>
{:else}
	<Sheet.Root bind:open>
		<Sheet.Trigger>
			{#snippet child({ props })}
				<button {...props} type="button" {id} {disabled} class={triggerClass}>
					<span class="flex min-w-0 items-center gap-2">
						{#if selected?.icon}
							<selected.icon class="size-4 shrink-0" />
						{/if}
						<span class="truncate">{selected?.label ?? placeholder}</span>
					</span>
					<ChevronDown class="size-4 shrink-0 opacity-60" />
				</button>
			{/snippet}
		</Sheet.Trigger>
		<Sheet.Content
			side="bottom"
			onOpenAutoFocus={(e) => e.preventDefault()}
			class="flex max-h-[calc(80dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left">
				<Sheet.Title>{title}</Sheet.Title>
			</Sheet.Header>
			<div class="flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
				{@render listBody()}
			</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}

{#if name}
	<input type="hidden" {name} {value} />
{/if}
