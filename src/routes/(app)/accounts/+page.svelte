<script lang="ts">
	import { enhance } from '$app/forms';
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
	import {
		Plus,
		MoreHorizontal,
		Archive,
		ArchiveRestore,
		Pencil,
		Wallet,
		Coins,
		Landmark,
		CreditCard,
		PiggyBank,
		CircleEllipsis,
		ArrowUp,
		ArrowDown,
		Lock
	} from 'lucide-svelte';
	import type { Component } from 'svelte';
	import { formatCentsAsCurrency, formatCentsCompact } from '$lib/utils/money.js';
	import { notify } from '$lib/utils/toast.js';
	import EmptyState from '$lib/components/empty-state.svelte';
	import { MediaQuery } from 'svelte/reactivity';

	let { data, form } = $props();

	const isDesktop = new MediaQuery('(min-width: 768px)');

	type AccountRow = (typeof data.accounts)[number];

	const includeArchived = $derived(page.url.searchParams.get('archived') === '1');

	let createOpen = $state(false);
	let editOpen = $state(false);
	let editTarget = $state<AccountRow | null>(null);
	let createPending = $state(false);
	let editPending = $state(false);

	// Cast lucide icons (SvelteComponentTyped) to Component for PickerItem compatibility
	const typeItems: PickerItem[] = [
		{ value: 'cash', label: 'Cash', icon: Coins as unknown as Component },
		{ value: 'bank', label: 'Bank', icon: Landmark as unknown as Component },
		{ value: 'savings', label: 'Savings', icon: PiggyBank as unknown as Component },
		{ value: 'credit', label: 'Credit', icon: CreditCard as unknown as Component },
		{ value: 'wallet', label: 'Wallet', icon: Wallet as unknown as Component },
		{ value: 'other', label: 'Other', icon: CircleEllipsis as unknown as Component }
	];

	const PRESET_SWATCHES = [
		'#10b981',
		'#3b82f6',
		'#f59e0b',
		'#f43f5e',
		'#8b5cf6',
		'#ec4899',
		'#14b8a6',
		'#f97316'
	];

	let createType = $state<string>('cash');
	let createColor = $state('');
	let createCustomColor = $state(false);

	let editType = $state<string>('cash');
	let editColor = $state('');
	let editCustomColor = $state(false);
	let editAdjustCents = $state<number | null>(null);

	$effect(() => {
		if (editTarget) {
			const t = editTarget;
			const c = t.color ?? '';
			editType = t.type;
			editColor = c;
			editCustomColor = !!c && !PRESET_SWATCHES.includes(c);
			editAdjustCents = t.balanceCents;
		}
	});

	const iconForType = (type: string) => typeItems.find((i) => i.value === type)?.icon ?? null;

	const formatBalance = (cents: number, currency: string) => formatCentsAsCurrency(cents, currency);

	const totalBalance = $derived(data.accounts.reduce((sum, a) => sum + a.balanceCents, 0));
	const defaultCurrency = $derived(data.accounts[0]?.currency ?? 'IDR');

	const openEdit = (a: AccountRow) => {
		editTarget = a;
		editOpen = true;
	};

	const visibleAccounts = $derived(includeArchived ? data.allAccounts : data.accounts);
</script>

<svelte:head><title>Accounts — Mavlo</title></svelte:head>

<div class="mb-6 flex items-center justify-between">
	<div>
		<h1 class="mavlo-headline text-2xl font-bold tracking-tight sm:text-3xl">Accounts</h1>
	</div>
	<Button class="lift" onclick={() => (createOpen = true)}>
		<Plus class="mr-1 size-4" /> New account
	</Button>
</div>

<div
	class="via-background to-background relative mb-6 overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-500/15 p-5 text-center sm:p-6"
>
	<p class="text-muted-foreground text-xs tracking-wider uppercase">
		Total Balance <span class="text-foreground/70">({defaultCurrency})</span>
	</p>
	<p class="mt-1 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
		{formatBalance(totalBalance, defaultCurrency)}
	</p>
	<p class="text-muted-foreground mt-2 text-[10px]">
		Across {data.accounts.length}
		{data.accounts.length === 1 ? 'account' : 'accounts'}
	</p>
</div>

{#if form?.message}
	<p class="text-destructive mb-4 text-sm">{form.message}</p>
{/if}

{#snippet rowMenu(account: AccountRow)}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="icon" class="size-11 shrink-0 md:size-8">
					<MoreHorizontal class="size-4" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Item onclick={() => openEdit(account)}>
				<Pencil class="mr-2 size-4" /> Edit
			</DropdownMenu.Item>
			<form
				method="POST"
				action="?/{account.archived ? 'unarchive' : 'archive'}"
				use:enhance={() =>
					async ({ result, update }) => {
						await update();
						if (result.type === 'success') {
							notify.success(account.archived ? 'Account restored' : 'Account archived');
						} else if (result.type === 'failure') {
							const message = (result.data as { message?: string } | undefined)?.message;
							notify.error(message ?? 'Could not save account');
						}
					}}
			>
				<input type="hidden" name="id" value={account.id} />
				<DropdownMenu.Item>
					{#snippet child({ props })}
						<button
							{...props}
							type="submit"
							class="hover:bg-accent/50 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
						>
							{#if account.archived}
								<ArchiveRestore class="size-4" /> Unarchive
							{:else}
								<Archive class="size-4" /> Archive
							{/if}
						</button>
					{/snippet}
				</DropdownMenu.Item>
			</form>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/snippet}

{#if visibleAccounts.length > 0}
	<div class="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
		{#each visibleAccounts as account (account.id)}
			{@const IconComp = iconForType(account.type)}
			{@const color = account.color || '#3b82f6'}
			<div
				class="mavlo-pill text-foreground group relative aspect-[1.586/1] overflow-hidden rounded-2xl p-5 transition-transform hover:-translate-y-0.5 {account.archived
					? 'opacity-60'
					: ''}"
			>
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

				<div class="relative flex h-full flex-col justify-between">
					<div class="flex items-start justify-between">
						<div class="flex items-center gap-3">
							<div
								class="flex size-12 items-center justify-center rounded-xl border backdrop-blur"
								style="background-color: {color}26; border-color: {color}40; color: {color}"
							>
								{#if IconComp}
									<IconComp class="size-6" />
								{:else}
									<Wallet class="size-6" />
								{/if}
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
								<div class="text-lg leading-tight font-semibold">{account.name}</div>
							</div>
						</div>
						{@render rowMenu(account)}
					</div>

					<div class="flex items-end justify-between gap-2">
						<div class="text-muted-foreground flex items-center gap-3 text-xs tabular-nums">
							<span class="text-income/70 flex items-center gap-1">
								<ArrowDown class="size-3" />
								{formatCentsCompact(account.periodIncomeCents, account.currency)}
							</span>
							<span class="text-expense/70 flex items-center gap-1">
								<ArrowUp class="size-3" />
								{formatCentsCompact(account.periodExpenseCents, account.currency)}
							</span>
						</div>
						<div class="flex flex-col items-end">
							<div class="text-2xl font-semibold tracking-tight tabular-nums xl:text-3xl">
								{formatBalance(account.balanceCents, account.currency)}
							</div>
							<span class="mt-1 text-xs font-semibold tracking-wider" style="color: {color}">
								{account.currency}
							</span>
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
{:else}
	<div class="hidden md:block">
		<Card.Root>
			<Card.Content>
				<EmptyState
					icon={Wallet}
					title="No accounts yet"
					description="Add your first account to start tracking your finances."
				>
					<Button onclick={() => (createOpen = true)}>Add account</Button>
				</EmptyState>
			</Card.Content>
		</Card.Root>
	</div>
{/if}

{#if visibleAccounts.length > 0}
	<ul class="space-y-2 md:hidden">
		{#each visibleAccounts as account (account.id)}
			{@const IconComp = iconForType(account.type)}
			{@const color = account.color || '#3b82f6'}
			<li
				class="mavlo-pill text-foreground relative flex items-stretch gap-2 overflow-hidden rounded-2xl p-4 {account.archived
					? 'opacity-60'
					: ''}"
			>
				<div
					aria-hidden="true"
					class="pointer-events-none absolute inset-0 opacity-70"
					style="background: radial-gradient(ellipse 70% 60% at 0% 0%, {color}33, transparent 60%), radial-gradient(circle 50% at 100% 100%, {color}22, transparent 70%);"
				></div>
				<div
					aria-hidden="true"
					class="pointer-events-none absolute -right-10 -bottom-10 size-32 rounded-full opacity-20 blur-2xl"
					style="background: {color}"
				></div>

				<div class="relative flex min-w-0 flex-1 flex-col gap-3">
					<div class="flex items-start justify-between gap-2">
						<div class="flex min-w-0 items-center gap-3">
							<div
								class="flex size-11 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
								style="background-color: {color}26; border-color: {color}40; color: {color}"
							>
								{#if IconComp}
									<IconComp class="size-5" />
								{:else}
									<Wallet class="size-5" />
								{/if}
							</div>
							<div class="min-w-0">
								<div
									class="text-muted-foreground flex items-center gap-1 text-[10px] tracking-wider uppercase"
								>
									{account.type}
									{#if account.type === 'savings'}
										<Lock class="size-2.5" aria-label="Transfer-only" />
									{/if}
								</div>
								<div class="truncate text-base leading-tight font-semibold">{account.name}</div>
							</div>
						</div>
						{@render rowMenu(account)}
					</div>

					<div class="flex items-end justify-between gap-2">
						<div class="flex items-center gap-2 text-[11px] tabular-nums">
							<span class="text-income/70 flex items-center gap-1">
								<ArrowDown class="size-2.5" />
								{formatCentsCompact(account.periodIncomeCents, account.currency)}
							</span>
							<span class="text-expense/70 flex items-center gap-1">
								<ArrowUp class="size-2.5" />
								{formatCentsCompact(account.periodExpenseCents, account.currency)}
							</span>
						</div>
						<div class="flex flex-col items-end">
							<div class="text-lg font-semibold tracking-tight tabular-nums">
								{formatBalance(account.balanceCents, account.currency)}
							</div>
							<span class="mt-0.5 text-[10px] font-semibold tracking-wider" style="color: {color}">
								{account.currency}
							</span>
						</div>
					</div>
				</div>
			</li>
		{/each}
	</ul>
{:else}
	<ul class="space-y-2 md:hidden">
		<li>
			<EmptyState
				icon={Wallet}
				title="No accounts yet"
				description="Add your first account to start tracking your finances."
			>
				<Button onclick={() => (createOpen = true)}>Add account</Button>
			</EmptyState>
		</li>
	</ul>
{/if}

<div class="mt-6 flex justify-center">
	<Button variant="ghost" size="sm" href={includeArchived ? '/accounts' : '/accounts?archived=1'}>
		{includeArchived ? 'Hide archived' : 'Show archived'}
	</Button>
</div>

<!-- Create form snippet -->
{#snippet createForm()}
	<form
		method="POST"
		action="?/create"
		use:enhance={({ formData }) => {
			formData.set('type', createType);
			formData.set('color', createColor);
			createPending = true;
			return async ({ result, update }) => {
				createPending = false;
				await update();
				if (result.type === 'success') {
					createOpen = false;
					notify.success('Account created');
				} else if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					notify.error(message ?? 'Could not create account');
				}
			};
		}}
		class="space-y-4 p-4"
	>
		<div class="space-y-1">
			<Label for="create-name">Name</Label>
			<Input id="create-name" name="name" required maxlength={80} />
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div class="space-y-1">
				<Label>Type</Label>
				<PickerSheet
					items={typeItems}
					bind:value={createType}
					name="type"
					placeholder="Select type"
					title="Account type"
				/>
			</div>
			<div class="space-y-1">
				<Label for="create-currency">Currency</Label>
				<Input id="create-currency" name="currency" required maxlength={8} value="IDR" />
			</div>
		</div>
		<div class="space-y-1">
			<Label for="create-balance">Initial balance</Label>
			<MoneyInput id="create-balance" name="initialBalanceCents" min={0} class="h-12 text-2xl" />
		</div>
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<Label>Color</Label>
				<span
					class="size-5 rounded border"
					style="background-color: {createColor || 'transparent'}"
					aria-hidden="true"
				></span>
			</div>
			<div class="grid grid-cols-8 gap-2">
				{#each PRESET_SWATCHES as swatch (swatch)}
					<button
						type="button"
						onclick={() => {
							createColor = swatch;
							createCustomColor = false;
						}}
						aria-pressed={createColor === swatch}
						aria-label="Color {swatch}"
						style="background-color: {swatch}; touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
						class="size-10 cursor-pointer rounded-lg outline-none {createColor === swatch
							? 'ring-foreground ring-offset-background ring-2 ring-offset-2'
							: ''}"
					>
						<span class="sr-only">{swatch}</span>
					</button>
				{/each}
			</div>
			<button
				type="button"
				onclick={() => (createCustomColor = !createCustomColor)}
				class="text-muted-foreground text-xs underline"
			>
				{createCustomColor ? 'Hide custom' : '+ Custom hex'}
			</button>
			{#if createCustomColor}
				<div class="flex items-center gap-2">
					<Input bind:value={createColor} placeholder="#10b981" maxlength={7} />
					<span
						class="size-6 rounded border"
						style="background-color: {createColor || 'transparent'}"
					></span>
				</div>
			{/if}
			<input
				type="text"
				name="color"
				bind:value={createColor}
				class="sr-only"
				tabindex="-1"
				aria-hidden="true"
			/>
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
			<Dialog.Header>
				<Dialog.Title>New account</Dialog.Title>
				<Dialog.Description>Add a new financial account to track.</Dialog.Description>
			</Dialog.Header>
			{@render createForm()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open={createOpen}>
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left">
				<Sheet.Title>New account</Sheet.Title>
				<Sheet.Description>Add a new financial account to track.</Sheet.Description>
			</Sheet.Header>
			<div class="flex-1 overflow-y-auto">{@render createForm()}</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}

<!-- Edit form snippet (receives account to avoid null narrowing issues) -->
{#snippet editForm(account: AccountRow)}
	{@const currentBalance = account.balanceCents}
	<form
		method="POST"
		action="?/update"
		use:enhance={({ formData }) => {
			formData.set('type', editType);
			formData.set('color', editColor);
			editPending = true;
			const targetCents = editAdjustCents;
			return async ({ result, update }) => {
				editPending = false;
				await update();
				if (result.type === 'success') {
					if (targetCents !== null && targetCents !== currentBalance) {
						const adjFd = new FormData();
						adjFd.set('id', account.id);
						adjFd.set('targetCents', String(targetCents));
						try {
							const res = await fetch('?/adjust', { method: 'POST', body: adjFd });
							if (!res.ok) throw new Error('adjust failed');
						} catch {
							notify.error('Account updated tapi adjust gagal');
							editOpen = false;
							return;
						}
					}
					editOpen = false;
					notify.success('Account updated');
				} else if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					notify.error(message ?? 'Could not save account');
				}
			};
		}}
		class="space-y-4 p-4"
	>
		<input type="hidden" name="id" value={account.id} />
		<input type="hidden" name="initialBalanceCents" value={account.initialBalanceCents} />
		<div class="space-y-1">
			<Label for="edit-name">Name</Label>
			<Input id="edit-name" name="name" required maxlength={80} value={account.name} />
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div class="space-y-1">
				<Label>Type</Label>
				<PickerSheet
					items={typeItems}
					bind:value={editType}
					name="type"
					placeholder="Select type"
					title="Account type"
				/>
			</div>
			<div class="space-y-1">
				<Label for="edit-currency">Currency</Label>
				<Input id="edit-currency" name="currency" required maxlength={8} value={account.currency} />
			</div>
		</div>
		<div class="space-y-1">
			<Label for="edit-current-balance">Current balance</Label>
			<div
				id="edit-current-balance"
				class="border-input bg-muted/40 text-muted-foreground flex h-11 items-center rounded-lg border px-3 text-base font-semibold tabular-nums md:h-8 md:text-sm"
			>
				{formatBalance(currentBalance, account.currency)}
			</div>
		</div>
		<div class="space-y-1">
			<Label for="edit-balance">Adjust balance to</Label>
			<MoneyInput
				id="edit-balance"
				name="_targetBalanceDisplay"
				bind:value={editAdjustCents}
				min={0}
				class="h-12 text-2xl"
			/>
			{#if editAdjustCents !== null && editAdjustCents !== currentBalance}
				<p class="text-muted-foreground text-xs">
					{editAdjustCents > currentBalance
						? `+${formatBalance(editAdjustCents - currentBalance, account.currency)}`
						: `-${formatBalance(currentBalance - editAdjustCents, account.currency)}`} adjustment will
					be recorded as a transaction
				</p>
			{/if}
		</div>
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<Label>Color</Label>
				<span
					class="size-5 rounded border"
					style="background-color: {editColor || 'transparent'}"
					aria-hidden="true"
				></span>
			</div>
			<div class="grid grid-cols-8 gap-2">
				{#each PRESET_SWATCHES as swatch (swatch)}
					<button
						type="button"
						onclick={() => {
							editColor = swatch;
							editCustomColor = false;
						}}
						aria-pressed={editColor === swatch}
						aria-label="Color {swatch}"
						style="background-color: {swatch}; touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
						class="size-10 cursor-pointer rounded-lg outline-none {editColor === swatch
							? 'ring-foreground ring-offset-background ring-2 ring-offset-2'
							: ''}"
					>
						<span class="sr-only">{swatch}</span>
					</button>
				{/each}
			</div>
			<button
				type="button"
				onclick={() => (editCustomColor = !editCustomColor)}
				class="text-muted-foreground text-xs underline"
			>
				{editCustomColor ? 'Hide custom' : '+ Custom hex'}
			</button>
			{#if editCustomColor}
				<div class="flex items-center gap-2">
					<Input bind:value={editColor} placeholder="#10b981" maxlength={7} />
					<span class="size-6 rounded border" style="background-color: {editColor || 'transparent'}"
					></span>
				</div>
			{/if}
			<input
				type="text"
				name="color"
				bind:value={editColor}
				class="sr-only"
				tabindex="-1"
				aria-hidden="true"
			/>
		</div>
		<div class="flex justify-end gap-2">
			<Button type="button" variant="outline" onclick={() => (editOpen = false)}>Cancel</Button>
			<SubmitButton pending={editPending}>Save</SubmitButton>
		</div>
	</form>
{/snippet}

{#if editTarget}
	{#if isDesktop.current}
		<Dialog.Root bind:open={editOpen}>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Edit account</Dialog.Title>
				</Dialog.Header>
				{@render editForm(editTarget)}
			</Dialog.Content>
		</Dialog.Root>
	{:else}
		<Sheet.Root bind:open={editOpen}>
			<Sheet.Content
				side="bottom"
				class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
			>
				<Sheet.Header class="p-4 pb-2 text-left">
					<Sheet.Title>Edit account</Sheet.Title>
					<Sheet.Description>Update your account details.</Sheet.Description>
				</Sheet.Header>
				<div class="flex-1 overflow-y-auto">{@render editForm(editTarget)}</div>
			</Sheet.Content>
		</Sheet.Root>
	{/if}
{/if}
