<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import MoneyInput from '$lib/components/forms/money-input.svelte';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import DatePicker from '$lib/components/forms/date-picker.svelte';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Table from '$lib/components/ui/table';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Select from '$lib/components/ui/select';
	import { Plus, MoreHorizontal, Pencil, Trash2, ArrowLeftRight } from 'lucide-svelte';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { notify } from '$lib/utils/toast.js';
	import EmptyState from '$lib/components/empty-state.svelte';

	let { data, form } = $props();

	type TxRow = (typeof data.transactions)[number];

	let createOpen = $state(false);
	let editOpen = $state(false);
	let editTarget = $state<TxRow | null>(null);
	let createKind = $state<'income' | 'expense' | 'transfer'>('expense');
	let editKind = $state<'income' | 'expense' | 'transfer'>('expense');
	let createPending = $state(false);
	let editPending = $state(false);

	const todayYmd = new Date().toISOString().slice(0, 10);

	// Select-bound values for create dialog
	let createAccountId = $state(data.accounts[0]?.id ?? '');
	let createTransferToAccountId = $state(data.accounts[0]?.id ?? '');
	let createCategoryId = $state('');
	let createOccurredAt = $state(todayYmd);

	// Select-bound values for edit dialog
	let editAccountId = $state('');
	let editTransferToAccountId = $state('');
	let editCategoryId = $state('');
	let editOccurredAt = $state('');

	// Filter bound values
	let filterAccountId = $state(data.filter.accountId ?? '');
	let filterCategoryId = $state(data.filter.categoryId ?? '');
	let filterKind = $state(data.filter.kind ?? '');
	let filterFrom = $state(data.filter.from ?? '');
	let filterTo = $state(data.filter.to ?? '');

	const expenseCategories = $derived(data.categories.filter((c) => c.kind === 'expense'));
	const incomeCategories = $derived(data.categories.filter((c) => c.kind === 'income'));

	const accountById = $derived(new Map(data.accounts.map((a) => [a.id, a])));
	const categoryById = $derived(new Map(data.categories.map((c) => [c.id, c])));

	const formatAmount = (cents: number, currency: string) => formatCentsAsCurrency(cents, currency);

	const formatDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

	const openEdit = (t: TxRow) => {
		editTarget = t;
		editKind = t.kind;
		editAccountId = t.accountId;
		editTransferToAccountId = t.transferToAccountId ?? '';
		editCategoryId = t.categoryId ?? '';
		editOccurredAt = formatDate(t.occurredAt);
		editOpen = true;
	};

	const kindLabel = (v: string) =>
		v === 'income' ? 'Income' : v === 'expense' ? 'Expense' : v === 'transfer' ? 'Transfer' : 'Select kind';

	const accountLabel = (id: string) => {
		const a = accountById.get(id);
		return a ? `${a.name} (${a.currency})` : 'Select account';
	};

	const categoryLabel = (id: string) => {
		if (!id) return 'None';
		const c = categoryById.get(id);
		return c ? c.name : 'Select category';
	};

	const filterAccountLabel = $derived(
		filterAccountId ? (accountById.get(filterAccountId)?.name ?? 'All') : 'All'
	);
	const filterCategoryLabel = $derived(
		filterCategoryId ? (categoryById.get(filterCategoryId)?.name ?? 'All') : 'All'
	);
	const filterKindLabel = $derived(
		filterKind === 'income' ? 'Income' : filterKind === 'expense' ? 'Expense' : filterKind === 'transfer' ? 'Transfer' : 'All'
	);
</script>

<svelte:head><title>Transactions — Mavlo</title></svelte:head>

<div class="flex items-center justify-between mb-6">
	<div>
		<h1 class="text-2xl font-semibold">Transactions</h1>
		<p class="text-sm text-muted-foreground mt-1">Track inflows and outflows.</p>
	</div>
	<Button onclick={() => { createKind = 'expense'; createOpen = true; }}>
		<Plus class="size-4 mr-1" /> New transaction
	</Button>
</div>

{#if form?.message}
	<p class="mb-4 text-sm text-destructive">{form.message}</p>
{/if}

<Card.Root class="mb-6">
	<Card.Content class="p-4">
		<form method="GET" class="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
			<div class="space-y-1">
				<Label for="filter-from">From</Label>
				<DatePicker id="filter-from" name="from" bind:value={filterFrom} />
			</div>
			<div class="space-y-1">
				<Label for="filter-to">To</Label>
				<DatePicker id="filter-to" name="to" bind:value={filterTo} />
			</div>
			<div class="space-y-1">
				<Label for="filter-account">Account</Label>
				<Select.Root type="single" bind:value={filterAccountId} name="account">
					<Select.Trigger id="filter-account" class="w-full">
						{filterAccountLabel}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="" label="All">All</Select.Item>
						{#each data.accounts as a}
							<Select.Item value={a.id} label={a.name}>{a.name}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="space-y-1">
				<Label for="filter-category">Category</Label>
				<Select.Root type="single" bind:value={filterCategoryId} name="category">
					<Select.Trigger id="filter-category" class="w-full">
						{filterCategoryLabel}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="" label="All">All</Select.Item>
						{#each data.categories as c}
							<Select.Item value={c.id} label={c.name}>{c.name} ({c.kind})</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="space-y-1">
				<Label for="filter-kind">Kind</Label>
				<Select.Root type="single" bind:value={filterKind} name="kind">
					<Select.Trigger id="filter-kind" class="w-full">
						{filterKindLabel}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="" label="All">All</Select.Item>
						<Select.Item value="income" label="Income">Income</Select.Item>
						<Select.Item value="expense" label="Expense">Expense</Select.Item>
						<Select.Item value="transfer" label="Transfer">Transfer</Select.Item>
					</Select.Content>
				</Select.Root>
			</div>
			<Button type="submit" class="w-full md:w-auto">Apply</Button>
		</form>
	</Card.Content>
</Card.Root>

{#snippet rowMenu(tx: TxRow)}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="icon" class="size-11 md:size-8 shrink-0">
					<MoreHorizontal class="size-4" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Item onclick={() => openEdit(tx)}>
				<Pencil class="size-4 mr-2" /> Edit
			</DropdownMenu.Item>
			<form method="POST" action="?/delete" use:enhance={() => async ({ update, result }) => {
					await update();
					if (result.type === 'success') {
						notify.success('Transaction deleted');
					} else if (result.type === 'failure') {
						const message = (result.data as { message?: string } | undefined)?.message;
						notify.error(message ?? 'Could not delete transaction');
					}
				}}>
				<input type="hidden" name="id" value={tx.id} />
				<DropdownMenu.Item>
					{#snippet child({ props })}
						<button
							{...props}
							type="submit"
							class="w-full text-left text-destructive"
						>
							<Trash2 class="size-4 mr-2" /> Delete
						</button>
					{/snippet}
				</DropdownMenu.Item>
			</form>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/snippet}

<div class="hidden md:block">
	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Date</Table.Head>
						<Table.Head>Kind</Table.Head>
						<Table.Head>Account</Table.Head>
						<Table.Head>Category</Table.Head>
						<Table.Head>Note</Table.Head>
						<Table.Head class="text-right">Amount</Table.Head>
						<Table.Head class="w-12"></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.transactions as tx (tx.id)}
						{@const acc = accountById.get(tx.accountId)}
						{@const destAcc = tx.transferToAccountId ? accountById.get(tx.transferToAccountId) : null}
						{@const cat = tx.categoryId ? categoryById.get(tx.categoryId) : null}
						<Table.Row>
							<Table.Cell>{formatDate(tx.occurredAt)}</Table.Cell>
							<Table.Cell class="capitalize">
								{#if tx.kind === 'income'}
									<span class="text-emerald-600 dark:text-emerald-400">income</span>
								{:else if tx.kind === 'expense'}
									<span class="text-rose-600 dark:text-rose-400">expense</span>
								{:else}
									<span class="text-blue-600 dark:text-blue-400">transfer</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if tx.kind === 'transfer' && destAcc}
									<span class="text-xs">{acc?.name ?? '—'} → {destAcc.name}</span>
								{:else}
									{acc?.name ?? '—'}
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if tx.kind === 'transfer'}
									<span class="text-muted-foreground text-xs">—</span>
								{:else}
									{cat?.name ?? '—'}
								{/if}
							</Table.Cell>
							<Table.Cell class="max-w-xs truncate">{tx.note ?? ''}</Table.Cell>
							<Table.Cell class="text-right tabular-nums">
								{#if tx.kind === 'expense'}
									<span class="text-rose-600 dark:text-rose-400">−{formatAmount(tx.amountCents, acc?.currency ?? 'IDR')}</span>
								{:else if tx.kind === 'income'}
									<span class="text-emerald-600 dark:text-emerald-400">+{formatAmount(tx.amountCents, acc?.currency ?? 'IDR')}</span>
								{:else}
									<span class="text-blue-600 dark:text-blue-400">{formatAmount(tx.amountCents, acc?.currency ?? 'IDR')}</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{@render rowMenu(tx)}
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={7} class="p-0">
								<EmptyState icon={ArrowLeftRight} title="No transactions in this range" description="Try a different date range or add a new transaction.">
									<Button onclick={() => { createKind = 'expense'; createOpen = true; }}>Add transaction</Button>
								</EmptyState>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>

<ul class="md:hidden space-y-2">
	{#each data.transactions as tx (tx.id)}
		{@const acc = accountById.get(tx.accountId)}
		{@const destAcc = tx.transferToAccountId ? accountById.get(tx.transferToAccountId) : null}
		{@const cat = tx.categoryId ? categoryById.get(tx.categoryId) : null}
		<li class="rounded-lg border bg-card p-3 flex items-start gap-3">
			<div class="flex-1 min-w-0">
				<div class="flex items-baseline justify-between gap-2 mb-0.5">
					<span class="text-xs text-muted-foreground tabular-nums">{formatDate(tx.occurredAt)}</span>
					<span class="text-sm font-medium tabular-nums whitespace-nowrap {tx.kind === 'expense' ? 'text-rose-600 dark:text-rose-400' : tx.kind === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}">
						{tx.kind === 'expense' ? '−' : tx.kind === 'income' ? '+' : ''}{formatAmount(tx.amountCents, acc?.currency ?? 'IDR')}
					</span>
				</div>
				<div class="text-xs text-muted-foreground truncate">
					{#if tx.kind === 'transfer' && destAcc}
						{acc?.name ?? '—'} → {destAcc.name}
					{:else}
						{acc?.name ?? '—'}{cat ? ` · ${cat.name}` : ''}
					{/if}
				</div>
				{#if tx.note}
					<div class="text-xs mt-0.5 truncate">{tx.note}</div>
				{/if}
			</div>
			{@render rowMenu(tx)}
		</li>
	{:else}
		<li>
			<EmptyState icon={ArrowLeftRight} title="No transactions in this range" description="Try a different date range or add a new transaction.">
				<Button onclick={() => { createKind = 'expense'; createOpen = true; }}>Add transaction</Button>
			</EmptyState>
		</li>
	{/each}
</ul>

<!-- Create dialog -->
<Dialog.Root bind:open={createOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>New transaction</Dialog.Title>
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
						notify.success('Transaction added');
					} else if (result.type === 'failure') {
						const message = (result.data as { message?: string } | undefined)?.message;
						notify.error(message ?? 'Could not add transaction');
					}
				};
			}}
			class="space-y-4"
		>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="tx-c-kind">Kind</Label>
					<Select.Root type="single" bind:value={createKind} name="kind" required>
						<Select.Trigger id="tx-c-kind" class="w-full">
							{kindLabel(createKind)}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="expense" label="Expense">Expense</Select.Item>
							<Select.Item value="income" label="Income">Income</Select.Item>
							<Select.Item value="transfer" label="Transfer">Transfer</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-1">
					<Label for="tx-c-amount">Amount</Label>
					<MoneyInput id="tx-c-amount" name="amountCents" min={1} required />
				</div>
			</div>
			<div class="space-y-1">
				<Label for="tx-c-account">{createKind === 'transfer' ? 'From account' : 'Account'}</Label>
				<Select.Root type="single" bind:value={createAccountId} name="accountId" required>
					<Select.Trigger id="tx-c-account" class="w-full">
						{accountLabel(createAccountId)}
					</Select.Trigger>
					<Select.Content>
						{#each data.accounts as a}
							<Select.Item value={a.id} label={a.name}>{a.name} ({a.currency})</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			{#if createKind === 'transfer'}
				<div class="space-y-1">
					<Label for="tx-c-to">To account</Label>
					<Select.Root type="single" bind:value={createTransferToAccountId} name="transferToAccountId" required>
						<Select.Trigger id="tx-c-to" class="w-full">
							{accountLabel(createTransferToAccountId)}
						</Select.Trigger>
						<Select.Content>
							{#each data.accounts as a}
								<Select.Item value={a.id} label={a.name}>{a.name} ({a.currency})</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			{:else}
				<div class="space-y-1">
					<Label for="tx-c-category">Category (optional)</Label>
					<Select.Root type="single" bind:value={createCategoryId} name="categoryId">
						<Select.Trigger id="tx-c-category" class="w-full">
							{categoryLabel(createCategoryId)}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="" label="None">None</Select.Item>
							<Select.Group>
								<Select.GroupHeading>Expense</Select.GroupHeading>
								{#each expenseCategories as c}
									<Select.Item value={c.id} label={c.name}>{c.name}</Select.Item>
								{/each}
							</Select.Group>
							<Select.Group>
								<Select.GroupHeading>Income</Select.GroupHeading>
								{#each incomeCategories as c}
									<Select.Item value={c.id} label={c.name}>{c.name}</Select.Item>
								{/each}
							</Select.Group>
						</Select.Content>
					</Select.Root>
				</div>
			{/if}
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="tx-c-date">Date</Label>
					<DatePicker id="tx-c-date" name="occurredAt" required bind:value={createOccurredAt} />
				</div>
				<div class="space-y-1">
					<Label for="tx-c-note">Note</Label>
					<Input id="tx-c-note" name="note" maxlength={200} placeholder="optional" />
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
			<Dialog.Title>Edit transaction</Dialog.Title>
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
							notify.success('Transaction updated');
						} else if (result.type === 'failure') {
							const message = (result.data as { message?: string } | undefined)?.message;
							notify.error(message ?? 'Could not update transaction');
						}
					};
				}}
				class="space-y-4"
			>
				<input type="hidden" name="id" value={editTarget.id} />
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="tx-e-kind">Kind</Label>
						<Select.Root type="single" bind:value={editKind} name="kind" required>
							<Select.Trigger id="tx-e-kind" class="w-full">
								{kindLabel(editKind)}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="expense" label="Expense">Expense</Select.Item>
								<Select.Item value="income" label="Income">Income</Select.Item>
								<Select.Item value="transfer" label="Transfer">Transfer</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
					<div class="space-y-1">
						<Label for="tx-e-amount">Amount</Label>
						<MoneyInput
							id="tx-e-amount"
							name="amountCents"
							min={1}
							required
							value={editTarget.amountCents}
						/>
					</div>
				</div>
				<div class="space-y-1">
					<Label for="tx-e-account">{editKind === 'transfer' ? 'From account' : 'Account'}</Label>
					<Select.Root type="single" bind:value={editAccountId} name="accountId" required>
						<Select.Trigger id="tx-e-account" class="w-full">
							{accountLabel(editAccountId)}
						</Select.Trigger>
						<Select.Content>
							{#each data.accounts as a}
								<Select.Item value={a.id} label={a.name}>{a.name} ({a.currency})</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				{#if editKind === 'transfer'}
					<div class="space-y-1">
						<Label for="tx-e-to">To account</Label>
						<Select.Root type="single" bind:value={editTransferToAccountId} name="transferToAccountId" required>
							<Select.Trigger id="tx-e-to" class="w-full">
								{accountLabel(editTransferToAccountId)}
							</Select.Trigger>
							<Select.Content>
								{#each data.accounts as a}
									<Select.Item value={a.id} label={a.name}>{a.name} ({a.currency})</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				{:else}
					<div class="space-y-1">
						<Label for="tx-e-category">Category (optional)</Label>
						<Select.Root type="single" bind:value={editCategoryId} name="categoryId">
							<Select.Trigger id="tx-e-category" class="w-full">
								{categoryLabel(editCategoryId)}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="" label="None">None</Select.Item>
								<Select.Group>
									<Select.GroupHeading>Expense</Select.GroupHeading>
									{#each expenseCategories as c}
										<Select.Item value={c.id} label={c.name}>{c.name}</Select.Item>
									{/each}
								</Select.Group>
								<Select.Group>
									<Select.GroupHeading>Income</Select.GroupHeading>
									{#each incomeCategories as c}
										<Select.Item value={c.id} label={c.name}>{c.name}</Select.Item>
									{/each}
								</Select.Group>
							</Select.Content>
						</Select.Root>
					</div>
				{/if}
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="tx-e-date">Date</Label>
						<DatePicker id="tx-e-date" name="occurredAt" required bind:value={editOccurredAt} />
					</div>
					<div class="space-y-1">
						<Label for="tx-e-note">Note</Label>
						<Input id="tx-e-note" name="note" maxlength={200} value={editTarget.note ?? ''} />
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
