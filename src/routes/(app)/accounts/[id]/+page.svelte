<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import {
		ArrowLeft,
		ArrowLeftRight,
		ArrowDown,
		ArrowUp,
		Pencil,
		Trash2,
		MoreHorizontal,
		Tag,
		Wallet,
		Coins,
		Landmark,
		CreditCard,
		PiggyBank,
		CircleEllipsis,
		Lock
	} from 'lucide-svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { getIconByName } from '$lib/utils/category-icons.js';
	import { notify } from '$lib/utils/toast.js';
	import EmptyState from '$lib/components/empty-state.svelte';
	import AddTransactionSheet from '$lib/components/forms/add-transaction-sheet.svelte';

	let { data } = $props();

	type TxRow = (typeof data.transactions)[number];

	const accountId = $derived(page.params.id);
	const account = $derived(data.allAccounts.find((a) => a.id === accountId));

	const accountById = $derived(new Map(data.allAccounts.map((a) => [a.id, a])));
	const categoryById = $derived(new Map(data.allCategories.map((c) => [c.id, c])));

	const accountTransactions = $derived(
		data.transactions
			.filter((t) => t.accountId === accountId || t.transferToAccountId === accountId)
			.sort((a, b) => b.occurredAt - a.occurredAt)
	);

	const typeIcons = {
		cash: Coins,
		bank: Landmark,
		credit: CreditCard,
		wallet: Wallet,
		savings: PiggyBank,
		other: CircleEllipsis
	};

	const color = $derived(account?.color || '#3b82f6');

	const totalIncome = $derived(
		accountTransactions
			.filter((t) => t.kind === 'income' && t.accountId === accountId)
			.reduce((s, t) => s + t.amountCents, 0)
	);
	const totalExpense = $derived(
		accountTransactions
			.filter((t) => t.kind === 'expense' && t.accountId === accountId)
			.reduce((s, t) => s + t.amountCents, 0)
	);

	const currency = $derived(account?.currency ?? 'IDR');

	type DayGroup = { key: string; dateLabel: string; netCents: number; items: TxRow[] };

	const groupedByDay = $derived.by<DayGroup[]>(() => {
		const byDay = new SvelteMap<string, DayGroup>();
		for (const tx of accountTransactions) {
			const key = new Date(tx.occurredAt).toISOString().slice(0, 10);
			let g = byDay.get(key);
			if (!g) {
				const date = new Date(`${key}T00:00:00.000Z`);
				g = {
					key,
					dateLabel: date.toLocaleDateString('en-US', {
						weekday: 'long',
						month: 'long',
						day: 'numeric',
						year: 'numeric',
						timeZone: 'UTC'
					}),
					netCents: 0,
					items: []
				};
				byDay.set(key, g);
			}
			g.items.push(tx);
			if (tx.kind === 'income' && tx.accountId === accountId) g.netCents += tx.amountCents;
			else if (tx.kind === 'expense' && tx.accountId === accountId) g.netCents -= tx.amountCents;
		}
		return Array.from(byDay.values()).sort((a, b) => b.key.localeCompare(a.key));
	});

	let editOpen = $state(false);
	let editTarget = $state<TxRow | null>(null);

	const openEdit = (t: TxRow) => {
		editTarget = t;
		editOpen = true;
	};
</script>

<svelte:head>
	<title>{account?.name ?? 'Account'} — Mavlo</title>
</svelte:head>

<div class="mb-6">
	<Button variant="ghost" size="sm" class="mb-3 -ml-2" href="/accounts">
		<ArrowLeft class="mr-1 size-4" /> Accounts
	</Button>

	{#if account}
		{@const IconComp = typeIcons[account.type as keyof typeof typeIcons] ?? Wallet}
		<div class="mavlo-pill relative overflow-hidden rounded-2xl p-5" style="min-height: 120px;">
			<div
				aria-hidden="true"
				class="pointer-events-none absolute inset-0 opacity-70"
				style="background: radial-gradient(ellipse 70% 60% at 0% 0%, {color}33, transparent 60%), radial-gradient(circle 50% at 100% 100%, {color}22, transparent 70%);"
			></div>
			<div
				aria-hidden="true"
				class="pointer-events-none absolute -right-10 -bottom-10 size-40 rounded-full opacity-20 blur-2xl"
				style="background: {color}"
			></div>

			<div class="relative z-10 flex items-start justify-between gap-4">
				<div class="flex items-center gap-3">
					<div
						class="flex size-12 items-center justify-center rounded-xl border backdrop-blur"
						style="background-color: {color}26; border-color: {color}40; color: {color}"
					>
						<IconComp class="size-6" />
					</div>
					<div>
						<div
							class="text-muted-foreground flex items-center gap-1 text-xs tracking-wider uppercase"
						>
							{account.type}
							{#if account.type === 'savings'}
								<Lock class="size-3" aria-label="Transfer-only" />
							{/if}
						</div>
						<div class="text-xl leading-tight font-semibold">{account.name}</div>
					</div>
				</div>
				<div class="flex flex-col items-end">
					<div class="text-2xl font-semibold tracking-tight tabular-nums">
						{formatCentsAsCurrency(account.balanceCents, currency)}
					</div>
					<span class="mt-1 text-xs font-semibold tracking-wider" style="color: {color}">
						{currency}
					</span>
				</div>
			</div>
		</div>
	{/if}
</div>

<div class="mb-6 grid grid-cols-2 gap-3">
	<div class="via-card to-card rounded-xl border bg-gradient-to-br from-emerald-500/10 p-4">
		<div class="text-muted-foreground flex items-center gap-2 text-xs tracking-wider uppercase">
			<span class="bg-income/15 inline-flex size-6 items-center justify-center rounded-full">
				<ArrowDown class="text-income size-3.5" />
			</span>
			Income
		</div>
		<p class="mt-2 text-lg font-semibold tabular-nums">
			{formatCentsAsCurrency(totalIncome, currency)}
		</p>
	</div>
	<div class="via-card to-card rounded-xl border bg-gradient-to-br from-rose-500/10 p-4">
		<div class="text-muted-foreground flex items-center gap-2 text-xs tracking-wider uppercase">
			<span class="bg-expense/15 inline-flex size-6 items-center justify-center rounded-full">
				<ArrowUp class="text-expense size-3.5" />
			</span>
			Expense
		</div>
		<p class="mt-2 text-lg font-semibold tabular-nums">
			{formatCentsAsCurrency(totalExpense, currency)}
		</p>
	</div>
</div>

<div class="space-y-5">
	{#each groupedByDay as group (group.key)}
		<section>
			<div class="mb-2 flex items-baseline justify-between gap-2 px-1">
				<span class="text-muted-foreground truncate text-xs">{group.dateLabel}</span>
				{#if group.netCents !== 0}
					<span
						class="text-xs font-semibold whitespace-nowrap tabular-nums {group.netCents >= 0
							? 'text-income'
							: 'text-expense'}"
					>
						{group.netCents >= 0 ? '+' : '−'}{formatCentsAsCurrency(
							Math.abs(group.netCents),
							currency
						)}
					</span>
				{/if}
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
					{@const isIncoming =
						tx.kind === 'income' ||
						(tx.kind === 'transfer' && tx.transferToAccountId === accountId)}
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
								{#if tx.kind === 'transfer'}
									{acc?.name ?? '—'} → {destAcc?.name ?? '—'}
								{:else}
									{acc?.name ?? '—'}
								{/if}
							</div>
						</div>
						<div class="flex shrink-0 items-center gap-1">
							<span
								class="text-sm font-semibold whitespace-nowrap tabular-nums {tx.kind === 'expense'
									? 'text-expense'
									: isIncoming
										? 'text-income'
										: 'text-transfer'}"
							>
								{tx.kind === 'expense' ? '−' : isIncoming ? '+' : ''}{formatCentsAsCurrency(
									tx.amountCents,
									acc?.currency ?? currency
								)}
							</span>
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											variant="ghost"
											size="icon"
											class="size-11 shrink-0 md:size-8"
										>
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
										action="/transactions?/delete"
										use:enhance={() =>
											async ({ result }) => {
												if (result.type === 'success') {
													await invalidateAll();
													notify.success('Transaction deleted');
												} else if (result.type === 'failure') {
													const message = (result.data as { message?: string } | undefined)
														?.message;
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
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<EmptyState
			icon={ArrowLeftRight}
			title="No transactions yet"
			description="Transactions for this account will appear here."
		/>
	{/each}
</div>

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
	actionUrl="/transactions?/update"
	onClose={() => (editOpen = false)}
/>
