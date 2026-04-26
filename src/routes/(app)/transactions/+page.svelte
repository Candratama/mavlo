<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import MoneyInput from '$lib/components/forms/money-input.svelte';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Table from '$lib/components/ui/table';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
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

	const expenseCategories = $derived(data.categories.filter((c) => c.kind === 'expense'));
	const incomeCategories = $derived(data.categories.filter((c) => c.kind === 'income'));

	const accountById = $derived(new Map(data.accounts.map((a) => [a.id, a])));
	const categoryById = $derived(new Map(data.categories.map((c) => [c.id, c])));

	const formatAmount = (cents: number, currency: string) => formatCentsAsCurrency(cents, currency);

	const formatDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

	const todayYmd = new Date().toISOString().slice(0, 10);

	const openEdit = (t: TxRow) => {
		editTarget = t;
		editKind = t.kind;
		editOpen = true;
	};
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
		<form method="GET" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
			<div class="space-y-1">
				<Label for="filter-from">From</Label>
				<Input id="filter-from" type="date" name="from" value={data.filter.from} />
			</div>
			<div class="space-y-1">
				<Label for="filter-to">To</Label>
				<Input id="filter-to" type="date" name="to" value={data.filter.to} />
			</div>
			<div class="space-y-1">
				<Label for="filter-account">Account</Label>
				<select
					id="filter-account"
					name="account"
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm h-9 md:h-8"
				>
					<option value="">All</option>
					{#each data.accounts as a}
						<option value={a.id} selected={data.filter.accountId === a.id}>{a.name}</option>
					{/each}
				</select>
			</div>
			<div class="space-y-1">
				<Label for="filter-category">Category</Label>
				<select
					id="filter-category"
					name="category"
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm h-9 md:h-8"
				>
					<option value="">All</option>
					{#each data.categories as c}
						<option value={c.id} selected={data.filter.categoryId === c.id}>
							{c.name} ({c.kind})
						</option>
					{/each}
				</select>
			</div>
			<div class="space-y-1">
				<Label for="filter-kind">Kind</Label>
				<select
					id="filter-kind"
					name="kind"
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm h-9 md:h-8"
				>
					<option value="">All</option>
					<option value="income" selected={data.filter.kind === 'income'}>Income</option>
					<option value="expense" selected={data.filter.kind === 'expense'}>Expense</option>
					<option value="transfer" selected={data.filter.kind === 'transfer'}>Transfer</option>
				</select>
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
					<select
						id="tx-c-kind"
						name="kind"
						required
						bind:value={createKind}
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						<option value="expense">Expense</option>
						<option value="income">Income</option>
						<option value="transfer">Transfer</option>
					</select>
				</div>
				<div class="space-y-1">
					<Label for="tx-c-amount">Amount</Label>
					<MoneyInput id="tx-c-amount" name="amountCents" min={1} required />
				</div>
			</div>
			<div class="space-y-1">
				<Label for="tx-c-account">{createKind === 'transfer' ? 'From account' : 'Account'}</Label>
				<select
					id="tx-c-account"
					name="accountId"
					required
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
				>
					{#each data.accounts as a}
						<option value={a.id}>{a.name} ({a.currency})</option>
					{/each}
				</select>
			</div>
			{#if createKind === 'transfer'}
				<div class="space-y-1">
					<Label for="tx-c-to">To account</Label>
					<select
						id="tx-c-to"
						name="transferToAccountId"
						required
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						{#each data.accounts as a}
							<option value={a.id}>{a.name} ({a.currency})</option>
						{/each}
					</select>
				</div>
			{:else}
				<div class="space-y-1">
					<Label for="tx-c-category">Category (optional)</Label>
					<select
						id="tx-c-category"
						name="categoryId"
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						<option value="">None</option>
						<optgroup label="Expense">
							{#each expenseCategories as c}
								<option value={c.id}>{c.name}</option>
							{/each}
						</optgroup>
						<optgroup label="Income">
							{#each incomeCategories as c}
								<option value={c.id}>{c.name}</option>
							{/each}
						</optgroup>
					</select>
				</div>
			{/if}
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="tx-c-date">Date</Label>
					<Input id="tx-c-date" type="date" name="occurredAt" required value={todayYmd} />
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
						<select
							id="tx-e-kind"
							name="kind"
							required
							bind:value={editKind}
							class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						>
							<option value="expense">Expense</option>
							<option value="income">Income</option>
							<option value="transfer">Transfer</option>
						</select>
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
					<select
						id="tx-e-account"
						name="accountId"
						required
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						{#each data.accounts as a}
							<option value={a.id} selected={a.id === editTarget.accountId}>
								{a.name} ({a.currency})
							</option>
						{/each}
					</select>
				</div>
				{#if editKind === 'transfer'}
					<div class="space-y-1">
						<Label for="tx-e-to">To account</Label>
						<select
							id="tx-e-to"
							name="transferToAccountId"
							required
							class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						>
							{#each data.accounts as a}
								<option value={a.id} selected={a.id === editTarget.transferToAccountId}>
									{a.name} ({a.currency})
								</option>
							{/each}
						</select>
					</div>
				{:else}
					<div class="space-y-1">
						<Label for="tx-e-category">Category (optional)</Label>
						<select
							id="tx-e-category"
							name="categoryId"
							class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						>
							<option value="" selected={!editTarget.categoryId}>None</option>
							<optgroup label="Expense">
								{#each expenseCategories as c}
									<option value={c.id} selected={c.id === editTarget.categoryId}>{c.name}</option>
								{/each}
							</optgroup>
							<optgroup label="Income">
								{#each incomeCategories as c}
									<option value={c.id} selected={c.id === editTarget.categoryId}>{c.name}</option>
								{/each}
							</optgroup>
						</select>
					</div>
				{/if}
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="tx-e-date">Date</Label>
						<Input
							id="tx-e-date"
							type="date"
							name="occurredAt"
							required
							value={formatDate(editTarget.occurredAt)}
						/>
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
