<script lang="ts">
	import { enhance } from '$app/forms';
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
	import { Plus, MoreHorizontal, Pencil, Trash2, Target, Tag } from 'lucide-svelte';
	import { getIconByName } from '$lib/utils/category-icons.js';
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
	const totalSpent = $derived(
		data.budgets.reduce((s, b) => s + (data.spentByCategory[b.categoryId] ?? 0), 0)
	);

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

<div class="mb-6 flex items-center justify-between">
	<div>
		<h1 class="mavlo-headline text-2xl font-bold tracking-tight sm:text-3xl">Budgets</h1>
	</div>
	<Button class="lift" onclick={() => (createOpen = true)}>
		<Plus class="mr-1 size-4" /> New budget
	</Button>
</div>

<div
	class="mb-6 rounded-xl border bg-gradient-to-br {totalSpent > totalAllocated
		? 'from-rose-500/10'
		: 'from-primary/10'} via-card to-card p-4"
>
	<div class="mb-2 flex items-center justify-between">
		<span class="text-sm font-semibold">Total Budget</span>
		<span
			class="text-sm font-semibold tabular-nums {totalSpent > totalAllocated
				? 'text-expense'
				: 'text-muted-foreground'}"
		>
			{pct(totalSpent, totalAllocated)}%
		</span>
	</div>
	<div class="bg-muted mb-2 h-2 overflow-hidden rounded-full">
		<div
			class="h-full transition-all {totalSpent > totalAllocated ? 'bg-expense' : 'bg-primary'}"
			style="width: {pct(totalSpent, totalAllocated)}%"
		></div>
	</div>
	<div class="text-muted-foreground flex justify-between text-xs tabular-nums">
		<span>{formatCents(totalSpent)}</span>
		<span>{formatCents(totalAllocated)}</span>
	</div>
</div>

<!-- Mobile: period chip -->
<form method="GET" class="mb-4 flex items-center gap-2 md:hidden">
	<label
		class="border-input bg-background relative inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm"
	>
		{data.periodMonth}
		<input
			type="month"
			name="period"
			value={data.periodMonth}
			onchange={(e) => (e.currentTarget.form as HTMLFormElement).submit()}
			class="absolute inset-0 cursor-pointer opacity-0"
		/>
	</label>
	{#if data.monthStartDay && data.monthStartDay !== 1}
		<span class="text-muted-foreground truncate text-xs">
			(cycle starts day {data.monthStartDay})
		</span>
	{/if}
</form>

<!-- Desktop: existing form with month input -->
<Card.Root class="mb-6 hidden md:block">
	<Card.Content class="p-4">
		<form method="GET" class="flex items-end gap-3">
			<div class="max-w-xs flex-1 space-y-1">
				<Label for="filter-period">Period</Label>
				<Input id="filter-period" type="month" name="period" value={data.periodMonth} />
			</div>
			<Button type="submit">Apply</Button>
		</form>
	</Card.Content>
</Card.Root>

{#if form?.message}
	<p class="text-destructive mb-4 text-sm">{form.message}</p>
{/if}

<div class="grid gap-4 md:grid-cols-2">
	{#each data.budgets as budget (budget.id)}
		{@const cat = categoryById.get(budget.categoryId)}
		{@const spent = data.spentByCategory[budget.categoryId] ?? 0}
		{@const percentage = pct(spent, budget.limitCents)}
		{@const over = spent > budget.limitCents}
		{@const IconComp = getIconByName(cat?.icon) ?? Tag}
		{@const tint = cat?.color ?? '#8b5cf6'}
		<Card.Root>
			<Card.Header class="flex flex-row items-start justify-between gap-3">
				<div class="flex min-w-0 flex-1 items-center gap-3">
					<div
						class="flex size-10 shrink-0 items-center justify-center rounded-lg"
						style="background-color: {tint}20; color: {tint}"
					>
						<IconComp class="size-5" />
					</div>
					<div class="min-w-0">
						<Card.Title class="truncate">{cat?.name ?? 'Unknown'}</Card.Title>
						<Card.Description>{budget.periodMonth}</Card.Description>
					</div>
				</div>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="ghost" size="icon" class="size-11 shrink-0 md:size-8">
								<MoreHorizontal class="size-4" />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end">
						<DropdownMenu.Item onclick={() => openEdit(budget)}>
							<Pencil class="mr-2 size-4" /> Edit
						</DropdownMenu.Item>
						<form
							method="POST"
							action="?/delete"
							use:enhance={() =>
								async ({ result, update }) => {
									await update();
									if (result.type === 'success') {
										notify.success('Budget deleted');
									} else if (result.type === 'failure') {
										const message = (result.data as { message?: string } | undefined)?.message;
										notify.error(message ?? 'Could not delete budget');
									}
								}}
						>
							<input type="hidden" name="id" value={budget.id} />
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<button
										{...props}
										type="submit"
										class="text-destructive hover:bg-accent/50 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
									>
										<Trash2 class="size-4" /> Delete
									</button>
								{/snippet}
							</DropdownMenu.Item>
						</form>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</Card.Header>
			<Card.Content>
				<div class="mb-2 flex items-baseline justify-between text-sm tabular-nums">
					<span class={over ? 'text-expense font-medium' : ''}>
						{formatCents(spent)}
					</span>
					<span class="text-muted-foreground">of {formatCents(budget.limitCents)}</span>
				</div>
				<div class="bg-muted h-2 overflow-hidden rounded-full">
					<div
						class={over
							? 'h-full bg-rose-500'
							: percentage >= 80
								? 'h-full bg-amber-500'
								: 'h-full bg-emerald-500'}
						style="width: {percentage}%"
					></div>
				</div>
				<p class="text-muted-foreground mt-2 text-xs">
					{percentage}% used{#if over}
						· over by {formatCents(spent - budget.limitCents)}{/if}
				</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="md:col-span-2">
			<EmptyState
				icon={Target}
				title="No budgets for {data.periodMonth}"
				description="Set a monthly limit per expense category to track your spending."
			>
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
			return async ({ result, update }) => {
				createPending = false;
				await update();
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
			<PickerSheet
				items={expenseCategoryItems}
				bind:value={createCategoryId}
				name="categoryId"
				placeholder="Select category"
				title="Category"
				searchable
			/>
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div class="space-y-1">
				<Label for="budget-c-period">Period</Label>
				<Input
					id="budget-c-period"
					type="month"
					name="periodMonth"
					required
					value={data.periodMonth}
				/>
			</div>
			<div class="space-y-1">
				<Label for="budget-c-limit">Limit</Label>
				<MoneyInput id="budget-c-limit" name="limitCents" min={1} required class="h-12 text-2xl" />
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
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left"><Sheet.Title>New budget</Sheet.Title></Sheet.Header>
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
				return async ({ result, update }) => {
					editPending = false;
					await update();
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
				<PickerSheet
					items={expenseCategoryItems}
					bind:value={editCategoryId}
					name="categoryId"
					placeholder="Select category"
					title="Category"
					searchable
				/>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="budget-e-period">Period</Label>
					<Input
						id="budget-e-period"
						type="month"
						name="periodMonth"
						required
						value={editTarget.periodMonth}
					/>
				</div>
				<div class="space-y-1">
					<Label for="budget-e-limit">Limit</Label>
					<MoneyInput
						id="budget-e-limit"
						name="limitCents"
						min={1}
						required
						value={editTarget.limitCents}
						class="h-12 text-2xl"
					/>
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
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left"><Sheet.Title>Edit budget</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">{@render editForm()}</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}
