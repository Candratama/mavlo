<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Table from '$lib/components/ui/table';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import {
		Plus,
		MoreHorizontal,
		Pencil,
		Trash2,
		ArrowLeftRight,
		Filter,
		X,
		Tag,
		ArrowDown,
		ArrowUp
	} from 'lucide-svelte';
	import { getIconByName } from '$lib/utils/category-icons.js';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { notify } from '$lib/utils/toast.js';
	import EmptyState from '$lib/components/empty-state.svelte';
	import SegmentedControl from '$lib/components/ui/segmented-control.svelte';
	import PickerSheet, {
		type PickerItem,
		type PickerGroup
	} from '$lib/components/ui/picker-sheet.svelte';
	import DatePicker from '$lib/components/ui/date-picker.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { SvelteURLSearchParams, SvelteMap } from 'svelte/reactivity';
	import AddTransactionSheet from '$lib/components/forms/add-transaction-sheet.svelte';
	import { openAddTransaction } from '$lib/stores/add-transaction.svelte.js';
	import { formatYmdInTimezone, ymdToZonedDayStartMs } from '$lib/utils/cycle.js';

	let { data } = $props();

	type TxRow = (typeof data.transactions)[number];

	// URL-driven filter (replaces server-side load filter).
	const filterFromUrl = $derived({
		from: page.url.searchParams.get('from') ?? '',
		to: page.url.searchParams.get('to') ?? '',
		accountId: page.url.searchParams.get('account') ?? '',
		categoryId: page.url.searchParams.get('category') ?? '',
		kind: page.url.searchParams.get('kind') ?? ''
	});

	const timezone = $derived(data.timezone ?? 'Asia/Jakarta');
	const ymdToMs = (s: string) => {
		const t = ymdToZonedDayStartMs(s, timezone);
		return Number.isNaN(t) ? null : t;
	};
	const dayMs = 24 * 60 * 60 * 1000;

	const filteredTransactions = $derived.by(() => {
		const f = filterFromUrl;
		const cycle = data.cycle;
		const fromMs = f.from ? ymdToMs(f.from) : cycle.startMs;
		const toMs = (f.to ? ymdToMs(f.to) : null) ?? cycle.endMs;
		const toMsInclusive = (toMs ?? cycle.endMs) + (f.to ? dayMs - 1 : 0);
		return data.transactions.filter((t) => {
			if (fromMs !== null && t.occurredAt < fromMs) return false;
			if (t.occurredAt > toMsInclusive) return false;
			if (f.accountId && t.accountId !== f.accountId) return false;
			if (f.categoryId && t.categoryId !== f.categoryId) return false;
			if (f.kind && t.kind !== f.kind) return false;
			return true;
		});
	});

	let editOpen = $state(false);
	let editTarget = $state<TxRow | null>(null);

	let filterOpen = $state(false);
	const fFromDerived = $derived(filterFromUrl.from);
	const fToDerived = $derived(filterFromUrl.to);
	const fAccountDerived = $derived(filterFromUrl.accountId);
	const fCategoryDerived = $derived(filterFromUrl.categoryId);
	const fKindDerived = $derived(filterFromUrl.kind);

	let fFrom = $state(filterFromUrl.from);
	let fTo = $state(filterFromUrl.to);
	let fAccount = $state(filterFromUrl.accountId);
	let fCategory = $state(filterFromUrl.categoryId);
	let fKind = $state(filterFromUrl.kind);

	$effect(() => {
		fFrom = fFromDerived;
		fTo = fToDerived;
		fAccount = fAccountDerived;
		fCategory = fCategoryDerived;
		fKind = fKindDerived;
	});

	const accountById = $derived(new Map(data.accounts.map((a) => [a.id, a])));
	const categoryById = $derived(new Map(data.categories.map((c) => [c.id, c])));

	const formatAmount = (cents: number, currency: string) => formatCentsAsCurrency(cents, currency);

	const formatDate = (ms: number) => formatYmdInTimezone(new Date(ms), timezone);

	const openEdit = (t: TxRow) => {
		editTarget = t;
		editOpen = true;
	};

	type Chip = { key: string; label: string; remove: () => void };
	const chips = $derived.by<Chip[]>(() => {
		const out: Chip[] = [];
		if (filterFromUrl.from)
			out.push({
				key: 'from',
				label: `From: ${filterFromUrl.from}`,
				remove: () => removeParam('from')
			});
		if (filterFromUrl.to)
			out.push({ key: 'to', label: `To: ${filterFromUrl.to}`, remove: () => removeParam('to') });
		if (filterFromUrl.accountId) {
			const a = accountById.get(filterFromUrl.accountId);
			out.push({
				key: 'account',
				label: a?.name ?? 'Account',
				remove: () => removeParam('account')
			});
		}
		if (filterFromUrl.categoryId) {
			const c = categoryById.get(filterFromUrl.categoryId);
			out.push({
				key: 'category',
				label: c?.name ?? 'Category',
				remove: () => removeParam('category')
			});
		}
		if (filterFromUrl.kind)
			out.push({ key: 'kind', label: filterFromUrl.kind, remove: () => removeParam('kind') });
		return out;
	});

	function removeParam(key: string) {
		const params = new SvelteURLSearchParams(window.location.search);
		params.delete(key);
		const qs = params.toString();
		goto(resolve(qs ? `/transactions?${qs}` : '/transactions'), { keepFocus: true });
	}

	function applyFilters() {
		const params = new SvelteURLSearchParams();
		if (fFrom) params.set('from', fFrom);
		if (fTo) params.set('to', fTo);
		if (fAccount) params.set('account', fAccount);
		if (fCategory) params.set('category', fCategory);
		if (fKind) params.set('kind', fKind);
		filterOpen = false;
		const qs = params.toString();
		goto(resolve(qs ? `/transactions?${qs}` : '/transactions'));
	}

	function resetFilters() {
		fFrom = fTo = fAccount = fCategory = fKind = '';
		filterOpen = false;
		goto(resolve('/transactions'));
	}

	const accountItems = $derived<PickerItem[]>([
		{ value: '', label: 'All accounts' },
		...data.accounts.map((a) => ({ value: a.id, label: a.name }))
	]);

	const categoryItems = $derived<PickerGroup[]>([
		{ label: 'All', items: [{ value: '', label: 'All categories' }] },
		{
			label: 'Expense',
			items: data.categories
				.filter((c) => c.kind === 'expense')
				.map((c) => ({ value: c.id, label: c.name }))
		},
		{
			label: 'Income',
			items: data.categories
				.filter((c) => c.kind === 'income')
				.map((c) => ({ value: c.id, label: c.name }))
		}
	]);

	const filterKindOptions = [
		{ value: '', label: 'All' },
		{ value: 'income', label: 'Income' },
		{ value: 'expense', label: 'Expense' },
		{ value: 'transfer', label: 'Transfer' }
	];

	const totalIncome = $derived(
		filteredTransactions.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amountCents, 0)
	);
	const totalExpense = $derived(
		filteredTransactions.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amountCents, 0)
	);
	const txCurrency = $derived(data.accounts[0]?.currency ?? 'IDR');

	type DayGroup = { key: string; dateLabel: string; netCents: number; items: TxRow[] };

	const groupedByDay = $derived.by<DayGroup[]>(() => {
		const byDay = new SvelteMap<string, DayGroup>();
		for (const tx of filteredTransactions) {
			const key = formatYmdInTimezone(new Date(tx.occurredAt), timezone);
			let g = byDay.get(key);
			if (!g) {
				const date = new Date(tx.occurredAt);
				g = {
					key,
					dateLabel: date.toLocaleDateString('en-US', {
						weekday: 'long',
						month: 'long',
						day: 'numeric',
						year: 'numeric',
						timeZone: timezone
					}),
					netCents: 0,
					items: []
				};
				byDay.set(key, g);
			}
			g.items.push(tx);
			if (tx.kind === 'income') g.netCents += tx.amountCents;
			else if (tx.kind === 'expense') g.netCents -= tx.amountCents;
		}
		return Array.from(byDay.values()).sort((a, b) => b.key.localeCompare(a.key));
	});
</script>

<svelte:head><title>Transactions — Mavlo</title></svelte:head>

<div class="mb-6 flex items-center justify-between">
	<div>
		<h1 class="mavlo-headline text-2xl font-bold tracking-tight sm:text-3xl">Transactions</h1>
	</div>
	<Button
		class="lift hidden md:inline-flex"
		onclick={() => openAddTransaction({ defaultKind: 'expense' })}
	>
		<Plus class="mr-1 size-4" /> New transaction
	</Button>
</div>

<div class="mb-6 grid grid-cols-2 gap-3">
	<div class="via-card to-card rounded-xl border bg-gradient-to-br from-emerald-500/10 p-4">
		<div class="text-muted-foreground flex items-center gap-2 text-xs tracking-wider uppercase">
			<span class="bg-income/15 inline-flex size-6 items-center justify-center rounded-full">
				<ArrowDown class="text-income size-3.5" />
			</span>
			Income
		</div>
		<p class="mt-2 text-lg font-semibold tabular-nums sm:text-xl">
			{formatCentsAsCurrency(totalIncome, txCurrency)}
		</p>
	</div>
	<div class="via-card to-card rounded-xl border bg-gradient-to-br from-rose-500/10 p-4">
		<div class="text-muted-foreground flex items-center gap-2 text-xs tracking-wider uppercase">
			<span class="bg-expense/15 inline-flex size-6 items-center justify-center rounded-full">
				<ArrowUp class="text-expense size-3.5" />
			</span>
			Expense
		</div>
		<p class="mt-2 text-lg font-semibold tabular-nums sm:text-xl">
			{formatCentsAsCurrency(totalExpense, txCurrency)}
		</p>
	</div>
</div>

<!-- Mobile chip bar -->
<div class="mb-4 flex items-center gap-2 overflow-x-auto md:hidden">
	{#if chips.length === 0}
		<button
			type="button"
			onclick={() => (filterOpen = true)}
			class="border-input bg-background inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm"
		>
			<Filter class="size-4" />
			Filter
		</button>
	{:else}
		{#each chips as chip (chip.key)}
			<span
				class="bg-accent text-accent-foreground inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs"
			>
				{chip.label}
				<button type="button" onclick={chip.remove} aria-label="Remove filter">
					<X class="size-3" />
				</button>
			</span>
		{/each}
		<button
			type="button"
			onclick={() => (filterOpen = true)}
			class="border-input inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs"
		>
			<Filter class="size-3" />
			Edit
		</button>
	{/if}
</div>

<!-- Desktop filter form -->
<Card.Root class="mb-6 hidden md:block">
	<Card.Content class="p-4">
		<form method="GET" class="space-y-3">
			<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<div class="space-y-1">
					<Label for="filter-from">From</Label>
					<DatePicker
						id="filter-from"
						name="from"
						bind:value={fFrom}
						placeholder="From"
						title="From date"
					/>
				</div>
				<div class="space-y-1">
					<Label for="filter-to">To</Label>
					<DatePicker id="filter-to" name="to" bind:value={fTo} placeholder="To" title="To date" />
				</div>
				<div class="space-y-1">
					<Label>Account</Label>
					<PickerSheet
						items={accountItems}
						bind:value={fAccount}
						name="account"
						placeholder="All"
						title="Account"
					/>
				</div>
				<div class="space-y-1">
					<Label>Category</Label>
					<PickerSheet
						groups={categoryItems}
						bind:value={fCategory}
						name="category"
						placeholder="All"
						title="Category"
						searchable
					/>
				</div>
			</div>
			<div class="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
				<div class="flex-1 space-y-1">
					<Label>Kind</Label>
					<SegmentedControl options={filterKindOptions} bind:value={fKind} name="kind" />
				</div>
				<Button type="submit" class="sm:w-auto">Apply</Button>
			</div>
		</form>
	</Card.Content>
</Card.Root>

<!-- Mobile filter sheet -->
<Sheet.Root bind:open={filterOpen}>
	<Sheet.Content side="bottom" class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0">
		<Sheet.Header class="p-4 pb-2 text-left">
			<Sheet.Title>Filter transactions</Sheet.Title>
		</Sheet.Header>
		<div class="flex-1 space-y-4 overflow-y-auto p-4">
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="m-from">From</Label>
					<DatePicker id="m-from" bind:value={fFrom} placeholder="From" title="From date" />
				</div>
				<div class="space-y-1">
					<Label for="m-to">To</Label>
					<DatePicker id="m-to" bind:value={fTo} placeholder="To" title="To date" />
				</div>
			</div>
			<div class="space-y-1">
				<Label>Account</Label>
				<PickerSheet
					items={accountItems}
					bind:value={fAccount}
					placeholder="All accounts"
					title="Account"
					usePopover
				/>
			</div>
			<div class="space-y-1">
				<Label>Category</Label>
				<PickerSheet
					groups={categoryItems}
					bind:value={fCategory}
					placeholder="All categories"
					title="Category"
					searchable
					usePopover
				/>
			</div>
			<div class="space-y-1">
				<Label>Kind</Label>
				<SegmentedControl options={filterKindOptions} bind:value={fKind} />
			</div>
		</div>
		<div class="flex gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
			<Button class="flex-1" onclick={resetFilters}>Reset</Button>
			<Button class="flex-1" onclick={applyFilters}>Apply</Button>
		</div>
	</Sheet.Content>
</Sheet.Root>

{#snippet rowMenu(tx: TxRow)}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="icon" class="size-11 shrink-0 md:size-8">
					<MoreHorizontal class="size-4" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Item onclick={() => openEdit(tx)}>
				<Pencil class="mr-2 size-4" /> Edit
			</DropdownMenu.Item>
			<form
				method="POST"
				action="?/delete"
				use:enhance={() =>
					async ({ result }) => {
						if (result.type === 'success') {
							await invalidateAll();
							notify.success('Transaction deleted');
						} else if (result.type === 'failure') {
							const message = (result.data as { message?: string } | undefined)?.message;
							notify.error(message ?? 'Could not delete transaction');
						}
					}}
			>
				<input type="hidden" name="id" value={tx.id} />
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
{/snippet}

<div class="hidden md:block">
	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Date</Table.Head>
						<Table.Head>Category</Table.Head>
						<Table.Head>Note</Table.Head>
						<Table.Head>Kind</Table.Head>
						<Table.Head>Account</Table.Head>
						<Table.Head class="text-right">Amount</Table.Head>
						<Table.Head class="w-12"></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each filteredTransactions as tx (tx.id)}
						{@const acc = accountById.get(tx.accountId)}
						{@const destAcc = tx.transferToAccountId
							? accountById.get(tx.transferToAccountId)
							: null}
						{@const cat = tx.categoryId ? categoryById.get(tx.categoryId) : null}
						<Table.Row>
							<Table.Cell>{formatDate(tx.occurredAt)}</Table.Cell>
							<Table.Cell>
								{#if tx.kind === 'transfer'}
									<span class="text-muted-foreground text-xs">—</span>
								{:else}
									{cat?.name ?? '—'}
								{/if}
							</Table.Cell>
							<Table.Cell class="max-w-xs truncate">{tx.note ?? ''}</Table.Cell>
							<Table.Cell class="capitalize">
								{#if tx.kind === 'income'}
									<span class="text-income">income</span>
								{:else if tx.kind === 'expense'}
									<span class="text-expense">expense</span>
								{:else}
									<span class="text-transfer">transfer</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if tx.kind === 'transfer' && destAcc}
									<span class="text-xs">{acc?.name ?? '—'} → {destAcc.name}</span>
								{:else}
									{acc?.name ?? '—'}
								{/if}
							</Table.Cell>
							<Table.Cell class="text-right tabular-nums">
								{#if tx.kind === 'expense'}
									<span class="text-expense"
										>−{formatAmount(tx.amountCents, acc?.currency ?? 'IDR')}</span
									>
								{:else if tx.kind === 'income'}
									<span class="text-income"
										>+{formatAmount(tx.amountCents, acc?.currency ?? 'IDR')}</span
									>
								{:else}
									<span class="text-transfer"
										>{formatAmount(tx.amountCents, acc?.currency ?? 'IDR')}</span
									>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{@render rowMenu(tx)}
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={7} class="p-0">
								<EmptyState
									icon={ArrowLeftRight}
									title="No transactions in this range"
									description="Try a different date range or add a new transaction."
								>
									<Button onclick={() => openAddTransaction({ defaultKind: 'expense' })}
										>Add transaction</Button
									>
								</EmptyState>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>

<div class="space-y-5 md:hidden">
	{#each groupedByDay as group (group.key)}
		<section>
			<div class="mb-2 flex items-baseline justify-between gap-2 px-1">
				<span class="text-muted-foreground truncate text-xs">{group.dateLabel}</span>
				<span
					class="text-xs font-semibold whitespace-nowrap tabular-nums {group.netCents >= 0
						? 'text-income'
						: 'text-expense'}"
				>
					{group.netCents >= 0 ? '+' : '−'}{formatAmount(Math.abs(group.netCents), txCurrency)}
				</span>
			</div>
			<ul class="space-y-2">
				{#each group.items as tx (tx.id)}
					{@const acc = accountById.get(tx.accountId)}
					{@const destAcc = tx.transferToAccountId ? accountById.get(tx.transferToAccountId) : null}
					{@const cat = tx.categoryId ? categoryById.get(tx.categoryId) : null}
					{@const IconComp =
						tx.kind === 'transfer' ? ArrowLeftRight : (getIconByName(cat?.icon) ?? Tag)}
					{@const tint =
						cat?.color ??
						(tx.kind === 'income' ? '#10b981' : tx.kind === 'transfer' ? '#3b82f6' : '#94a3b8')}
					<li class="bg-card flex items-center gap-3 rounded-lg border p-3">
						<div
							class="flex size-10 shrink-0 items-center justify-center rounded-lg"
							style="background-color: {tint}20; color: {tint}"
						>
							<IconComp class="size-5" />
						</div>
						<div class="min-w-0 flex-1">
							<div class="truncate text-sm font-medium">
								{tx.note || cat?.name || acc?.name || 'Transaction'}
							</div>
							<div class="text-muted-foreground truncate text-xs">
								{acc?.name ?? '—'}{#if tx.kind === 'transfer' && destAcc}
									→ {destAcc.name}{/if}
							</div>
						</div>
						<div class="flex shrink-0 items-center gap-1">
							<span
								class="text-sm font-semibold whitespace-nowrap tabular-nums {tx.kind === 'expense'
									? 'text-expense'
									: tx.kind === 'income'
										? 'text-income'
										: 'text-transfer'}"
							>
								{tx.kind === 'expense' ? '−' : tx.kind === 'income' ? '+' : ''}{formatAmount(
									tx.amountCents,
									acc?.currency ?? 'IDR'
								)}
							</span>
							{@render rowMenu(tx)}
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<EmptyState
			icon={ArrowLeftRight}
			title="No transactions in this range"
			description="Try a different date range or add a new transaction."
		>
			<Button onclick={() => openAddTransaction({ defaultKind: 'expense' })}>Add transaction</Button
			>
		</EmptyState>
	{/each}
</div>

<!-- Edit sheet -->
<AddTransactionSheet
	bind:open={editOpen}
	mode="edit"
	accounts={data.accounts}
	categories={data.categories}
	editTarget={editTarget
		? {
				id: editTarget.id,
				kind: editTarget.kind,
				amountCents: editTarget.amountCents,
				accountId: editTarget.accountId,
				transferToAccountId: editTarget.transferToAccountId,
				categoryId: editTarget.categoryId,
				occurredAt: editTarget.occurredAt,
				note: editTarget.note
			}
		: null}
	actionUrl="?/update"
	onClose={() => (editOpen = false)}
/>
