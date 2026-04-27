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
	import { ChevronRight, Check, Search } from 'lucide-svelte';
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

	const flat = $derived<PickerItem[]>(groups ? groups.flatMap((g) => g.items) : (items ?? []));
	const selected = $derived(flat.find((i) => i.value === value));

	function matches(it: PickerItem, q: string): boolean {
		if (!q) return true;
		const needle = q.toLowerCase();
		return it.label.toLowerCase().includes(needle);
	}

	const filteredGroups = $derived<PickerGroup[]>(
		groups
			? groups.map((g) => ({ label: g.label, items: g.items.filter((i) => matches(i, query)) })).filter((g) => g.items.length)
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
</script>

<Sheet.Root bind:open>
	<Sheet.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				type="button"
				{id}
				{disabled}
				class={cn(
					'flex h-9 md:h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm transition-colors disabled:opacity-50 hover:bg-accent/30',
					!selected && 'text-muted-foreground',
					className
				)}
			>
				<span class="flex items-center gap-2 min-w-0">
					{#if selected?.icon}
						<selected.icon class="size-4 shrink-0" />
					{/if}
					<span class="truncate">{selected?.label ?? placeholder}</span>
				</span>
				<ChevronRight class="size-4 shrink-0 opacity-60" />
			</button>
		{/snippet}
	</Sheet.Trigger>
	<Sheet.Content side="bottom" class="max-h-[calc(80dvh-var(--keyboard-h,0px))] flex flex-col p-0">
		<Sheet.Header class="text-left p-4 pb-2">
			<Sheet.Title>{title}</Sheet.Title>
		</Sheet.Header>
		{#if searchable}
			<div class="px-4 pb-2 relative">
				<Search class="absolute left-7 top-1/2 -translate-y-1/2 size-4 opacity-50 pointer-events-none" />
				<Input
					type="search"
					placeholder="Search…"
					bind:value={query}
					class="pl-9"
					autofocus
				/>
			</div>
		{/if}
		<div class="flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
			{#if groups}
				{#each filteredGroups as g (g.label)}
					<div class="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
						{g.label}
					</div>
					<ul>
						{#each g.items as it (it.value)}
							<li>
								<button
									type="button"
									onclick={() => pick(it.value)}
									class={cn(
										'w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-accent/50',
										value === it.value && 'bg-accent/30'
									)}
								>
									<span class="flex items-center gap-2 min-w-0">
										{#if it.icon}
											<it.icon class="size-4 shrink-0" />
										{/if}
										<span class="flex flex-col min-w-0">
											<span class="truncate">{it.label}</span>
											{#if it.description}
												<span class="text-xs text-muted-foreground truncate">{it.description}</span>
											{/if}
										</span>
									</span>
									{#if value === it.value}
										<Check class="size-4 text-primary" />
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
									'w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-accent/50',
									value === it.value && 'bg-accent/30'
								)}
							>
								<span class="flex items-center gap-2 min-w-0">
									{#if it.icon}
										<it.icon class="size-4 shrink-0" />
									{/if}
									<span class="flex flex-col min-w-0">
										<span class="truncate">{it.label}</span>
										{#if it.description}
											<span class="text-xs text-muted-foreground truncate">{it.description}</span>
										{/if}
									</span>
								</span>
								{#if value === it.value}
									<Check class="size-4 text-primary" />
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>

{#if name}
	<input type="hidden" {name} {value} />
{/if}
