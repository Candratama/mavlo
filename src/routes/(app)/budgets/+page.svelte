<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import MoneyInput from '$lib/components/forms/money-input.svelte';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import PickerSheet, { type PickerItem } from '$lib/components/ui/picker-sheet.svelte';
	import { Plus, MoreHorizontal, Pencil, Trash2, PiggyBank } from 'lucide-svelte';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { notify } from '$lib/utils/toast.js';
	import EmptyState from '$lib/components/empty-state.svelte';
	import { MediaQuery } from 'svelte/reactivity';

	let { data, form } = $props();

	const isDesktop = new MediaQuery('(min-width: 768px)');

	type BudgetRow = (typeof data.budgets)[number];

	let createOpen = $state(false);
	let editOpen = $state(false);
	let editTarget = $state<BudgetRow | null>(null);
	let createPending = $state(false);
	let editPending = $state(false);

	const categoryById = $derived(new Map(data.categories.map((c) => [c.id, c])));

	const formatCents = (cents: number) => formatCentsAsCurrency(cents, 'IDR');

	const openEdit = (b: BudgetRow) => {
		editTarget = b;
		editOpen = true;
	};

	const totalAllocated = $derived(data.budgets.reduce((s, b) => s + b.limitCents, 0));
	const totalSpent = $derived(data.budgets.reduce((s, b) => s + (data.spentByCategory[b.categoryId] ?? 0), 0));

	const pct = (spent: number, limit: number) =>
		limit === 0 ? 0 : Math.min(100, Math.round((spent / limit) * 100));

	const expenseCategoryItems = $derived<PickerItem[]>(
		data.expenseCategories.map((c) => ({ value: c.id, label: c.name }))
	);

	let createCategoryId = $state('');
	let editCategoryId = $state('');

	$effect(() => {
		if (createOpen && !createCategoryId) {
			createCategoryId = data.expenseCategories[0]?.id ?? '';
		}
	});

	$effect(() => {
		if (editTarget) editCategoryId = editTarget.categoryId;
	});
</script>

<svelte:head><title>Budgets — Mavlo</title></svelte:head>

<div class="flex items-center justify-between mb-6">
	<div>
		<h1 class="text-2xl font-semibold">Budgets</h1>
		<p class="text-sm text-muted-foreground mt-1">Monthly category spending limits.</p>
	</div>
	<Button onclick={() => (createOpen = true)}>
		<Plus class="size-4 mr-1" /> New budget
	</Button>
</div>

<Card.Root class="mb-6">
	<Card.Content class="grid grid-cols-2 gap-4 p-4">
		<div>
			<p class="text-xs text-muted-foreground">Allocated</p>
			<p class="text-lg sm:text-xl font-semibold tabular-nums">
				{formatCents(totalAllocated)}
			</p>
		</div>
		<div>
			<p class="text-xs text-muted-foreground">Spent</p>
			<p class="text-lg sm:text-xl font-semibold tabular-nums {totalSpent > totalAllocated ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}">
				{formatCents(totalSpent)}
			</p>
		</div>
	</Card.Content>
</Card.Root>

<!-- Mobile: period chip -->
<form method="GET" class="md:hidden mb-4 flex items-center gap-2">
	<label class="inline-flex items-center gap-1.5 px-3 h-9 rounded-full border border-input bg-background text-sm relative">
		{data.periodMonth}
		<input
			type="month"
			name="period"
			value={data.periodMonth}
			onchange={(e) => (e.currentTarget.form as HTMLFormElement).submit()}
			class="absolute inset-0 opacity-0 cursor-pointer"
		/>
	</label>
	{#if data.monthStartDay && data.monthStartDay !== 1}
		<span class="text-xs text-muted-foreground truncate">
			(cycle starts day {data.monthStartDay})
		</span>
	{/if}
</form>

<!-- Desktop: existing form with month input -->
<Card.Root class="hidden md:block mb-6">
	<Card.Content class="p-4">
		<form method="GET" class="flex items-end gap-3">
			<div class="space-y-1 flex-1 max-w-xs">
				<Label for="filter-period">Period</Label>
				<Input id="filter-period" type="month" name="period" value={data.periodMonth} />
			</div>
			<Button type="submit">Apply</Button>
		</form>
	</Card.Content>
</Card.Root>

{#if form?.message}
	<p class="mb-4 text-sm text-destructive">{form.message}</p>
{/if}

<div class="grid gap-4 md:grid-cols-2">
	{#each data.budgets as budget (budget.id)}
		{@const cat = categoryById.get(budget.categoryId)}
		{@const spent = data.spentByCategory[budget.categoryId] ?? 0}
		{@const percentage = pct(spent, budget.limitCents)}
		{@const over = spent > budget.limitCents}
		<Card.Root>
			<Card.Header class="flex flex-row items-start justify-between">
				<div>
					<Card.Title>{cat?.name ?? 'Unknown'}</Card.Title>
					<Card.Description>{budget.periodMonth}</Card.Description>
				</div>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="ghost" size="icon" class="size-11 md:size-8 shrink-0">
								<MoreHorizontal class="size-4" />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end">
						<DropdownMenu.Item onclick={() => openEdit(budget)}>
							<Pencil class="size-4 mr-2" /> Edit
						</DropdownMenu.Item>
						<form method="POST" action="?/delete" use:enhance={() => async ({ result }) => {
								await goto(page.url.pathname + page.url.search, {
									invalidateAll: true,
									replaceState: true,
									keepFocus: true,
									noScroll: true
								});
								if (result.type === 'success') {
									notify.success('Budget deleted');
								} else if (result.type === 'failure') {
									const message = (result.data as { message?: string } | undefined)?.message;
									notify.error(message ?? 'Could not delete budget');
								}
							}}>
							<input type="hidden" name="id" value={budget.id} />
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<button {...props} type="submit" class="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left text-destructive rounded-sm hover:bg-accent/50">
										<Trash2 class="size-4" /> Delete
									</button>
								{/snippet}
							</DropdownMenu.Item>
						</form>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</Card.Header>
			<Card.Content>
				<div class="flex items-baseline justify-between text-sm tabular-nums mb-2">
					<span class={over ? 'text-rose-600 dark:text-rose-400 font-medium' : ''}>
						{formatCents(spent)}
					</span>
					<span class="text-muted-foreground">of {formatCents(budget.limitCents)}</span>
				</div>
				<div class="h-2 rounded-full bg-muted overflow-hidden">
					<div
						class={over
							? 'h-full bg-rose-500'
							: percentage >= 80
								? 'h-full bg-amber-500'
								: 'h-full bg-emerald-500'}
						style="width: {percentage}%"
					></div>
				</div>
				<p class="mt-2 text-xs text-muted-foreground">
					{percentage}% used{#if over} · over by {formatCents(spent - budget.limitCents)}{/if}
				</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="md:col-span-2">
			<EmptyState icon={PiggyBank} title="No budgets for {data.periodMonth}" description="Set a monthly limit per expense category to track your spending.">
				<Button onclick={() => (createOpen = true)}>Add budget</Button>
			</EmptyState>
		</div>
	{/each}
</div>

<!-- Create dialog/sheet -->
{#snippet createForm()}
	<form
		method="POST"
		action="?/create"
		use:enhance={() => {
			createPending = true;
			return async ({ result }) => {
				await goto(page.url.pathname + page.url.search, {
					invalidateAll: true,
					replaceState: true,
					keepFocus: true,
					noScroll: true
				});
				createPending = false;
				if (result.type === 'success') {
					createOpen = false;
					notify.success('Budget created');
				} else if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					notify.error(message ?? 'Could not create budget');
				}
			};
		}}
		class="space-y-4 p-4"
	>
		<div class="space-y-1">
			<Label>Category</Label>
			<PickerSheet items={expenseCategoryItems} bind:value={createCategoryId} name="categoryId" placeholder="Select category" title="Category" searchable />
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div class="space-y-1">
				<Label for="budget-c-period">Period</Label>
				<Input id="budget-c-period" type="month" name="periodMonth" required value={data.periodMonth} />
			</div>
			<div class="space-y-1">
				<Label for="budget-c-limit">Limit</Label>
				<MoneyInput id="budget-c-limit" name="limitCents" min={1} required class="text-2xl h-12" />
			</div>
		</div>
		<div class="flex justify-end gap-2">
			<Button type="button" variant="outline" onclick={() => (createOpen = false)}>Cancel</Button>
			<SubmitButton pending={createPending}>Create</SubmitButton>
		</div>
	</form>
{/snippet}

{#if isDesktop.current}
	<Dialog.Root bind:open={createOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>New budget</Dialog.Title></Dialog.Header>
			{@render createForm()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open={createOpen}>
		<Sheet.Content side="bottom" class="max-h-[90dvh] flex flex-col p-0">
			<Sheet.Header class="text-left p-4 pb-2"><Sheet.Title>New budget</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">{@render createForm()}</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}

<!-- Edit dialog/sheet -->
{#snippet editForm()}
	{#if editTarget}
		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				editPending = true;
				return async ({ result }) => {
					await goto(page.url.pathname + page.url.search, {
						invalidateAll: true,
						replaceState: true,
						keepFocus: true,
						noScroll: true
					});
					editPending = false;
					if (result.type === 'success') {
						editOpen = false;
						notify.success('Budget updated');
					} else if (result.type === 'failure') {
						const message = (result.data as { message?: string } | undefined)?.message;
						notify.error(message ?? 'Could not update budget');
					}
				};
			}}
			class="space-y-4 p-4"
		>
			<input type="hidden" name="id" value={editTarget.id} />
			<div class="space-y-1">
				<Label>Category</Label>
				<PickerSheet items={expenseCategoryItems} bind:value={editCategoryId} name="categoryId" placeholder="Select category" title="Category" searchable />
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="budget-e-period">Period</Label>
					<Input id="budget-e-period" type="month" name="periodMonth" required value={editTarget.periodMonth} />
				</div>
				<div class="space-y-1">
					<Label for="budget-e-limit">Limit</Label>
					<MoneyInput id="budget-e-limit" name="limitCents" min={1} required value={editTarget.limitCents} class="text-2xl h-12" />
				</div>
			</div>
			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={() => (editOpen = false)}>Cancel</Button>
				<SubmitButton pending={editPending}>Save</SubmitButton>
			</div>
		</form>
	{/if}
{/snippet}

{#if isDesktop.current}
	<Dialog.Root bind:open={editOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>Edit budget</Dialog.Title></Dialog.Header>
			{@render editForm()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open={editOpen}>
		<Sheet.Content side="bottom" class="max-h-[90dvh] flex flex-col p-0">
			<Sheet.Header class="text-left p-4 pb-2"><Sheet.Title>Edit budget</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">{@render editForm()}</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}
