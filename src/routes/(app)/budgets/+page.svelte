<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import MoneyInput from '$lib/components/forms/money-input.svelte';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Plus, MoreHorizontal, Pencil, Trash2, PiggyBank } from 'lucide-svelte';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { notify } from '$lib/utils/toast.js';
	import EmptyState from '$lib/components/empty-state.svelte';

	let { data, form } = $props();

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

	const pct = (spent: number, limit: number) =>
		limit === 0 ? 0 : Math.min(100, Math.round((spent / limit) * 100));
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
						<form method="POST" action="?/delete" use:enhance={() => async ({ update, result }) => {
								await update();
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
									<button {...props} type="submit" class="w-full text-left text-destructive">
										<Trash2 class="size-4 mr-2" /> Delete
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

<!-- Create dialog -->
<Dialog.Root bind:open={createOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>New budget</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				createPending = true;
				return async ({ update, result }) => {
					await update();
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
			class="space-y-4"
		>
			<div class="space-y-1">
				<Label for="budget-c-category">Category</Label>
				<select
					id="budget-c-category"
					name="categoryId"
					required
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
				>
					{#each data.expenseCategories as c}
						<option value={c.id}>{c.name}</option>
					{/each}
				</select>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="budget-c-period">Period (YYYY-MM)</Label>
					<Input id="budget-c-period" name="periodMonth" required value={data.periodMonth} />
				</div>
				<div class="space-y-1">
					<Label for="budget-c-limit">Limit</Label>
					<MoneyInput id="budget-c-limit" name="limitCents" min={1} required />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (createOpen = false)}>Cancel</Button>
				<SubmitButton pending={createPending}>Create</SubmitButton>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit dialog -->
<Dialog.Root bind:open={editOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Edit budget</Dialog.Title>
		</Dialog.Header>
		{#if editTarget}
			<form
				method="POST"
				action="?/update"
				use:enhance={() => {
					editPending = true;
					return async ({ update, result }) => {
						await update();
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
				class="space-y-4"
			>
				<input type="hidden" name="id" value={editTarget.id} />
				<div class="space-y-1">
					<Label for="budget-e-category">Category</Label>
					<select
						id="budget-e-category"
						name="categoryId"
						required
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						{#each data.expenseCategories as c}
							<option value={c.id} selected={c.id === editTarget.categoryId}>{c.name}</option>
						{/each}
					</select>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="budget-e-period">Period (YYYY-MM)</Label>
						<Input
							id="budget-e-period"
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
						/>
					</div>
				</div>
				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (editOpen = false)}>Cancel</Button>
					<SubmitButton pending={editPending}>Save</SubmitButton>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
