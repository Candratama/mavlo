<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
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
		CircleEllipsis,
		GripVertical,
		Scale
	} from 'lucide-svelte';
	import { dndzone } from 'svelte-dnd-action';
	import type { Component } from 'svelte';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { notify } from '$lib/utils/toast.js';
	import EmptyState from '$lib/components/empty-state.svelte';
	import { MediaQuery } from 'svelte/reactivity';

	let { data, form } = $props();

	const isDesktop = new MediaQuery('(min-width: 768px)');

	type AccountRow = (typeof data.accounts)[number];

	let createOpen = $state(false);
	let editOpen = $state(false);
	let editTarget = $state<AccountRow | null>(null);
	let createPending = $state(false);
	let editPending = $state(false);

	// Cast lucide icons (SvelteComponentTyped) to Component for PickerItem compatibility
	const typeItems: PickerItem[] = [
		{ value: 'cash', label: 'Cash', icon: Coins as unknown as Component },
		{ value: 'bank', label: 'Bank', icon: Landmark as unknown as Component },
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

	$effect(() => {
		if (editTarget) {
			const t = editTarget;
			const c = t.color ?? '';
			editType = t.type;
			editColor = c;
			editCustomColor = !!c && !PRESET_SWATCHES.includes(c);
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

	let adjustOpen = $state(false);
	let adjustTarget = $state<AccountRow | null>(null);
	let adjustTargetCents = $state<number | null>(null);
	let adjustNote = $state('');
	let adjustPending = $state(false);

	const openAdjust = (a: AccountRow) => {
		adjustTarget = a;
		adjustTargetCents = a.balanceCents;
		adjustNote = '';
		adjustOpen = true;
	};

	let visibleAccounts = $state<AccountRow[]>(data.accounts);
	$effect(() => {
		visibleAccounts = data.accounts;
	});

	async function persistOrder(ids: string[]) {
		const fd = new FormData();
		fd.set('ids', ids.join(','));
		const res = await fetch('?/reorder', { method: 'POST', body: fd });
		if (!res.ok) {
			notify.error('Could not save order');
		}
	}

	let dndDisabled = $state(true);
	function enableDrag() {
		dndDisabled = false;
	}
	function disableDrag() {
		dndDisabled = true;
	}
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
			<DropdownMenu.Item onclick={() => openAdjust(account)}>
				<Scale class="mr-2 size-4" /> Adjust
			</DropdownMenu.Item>
			<form
				method="POST"
				action="?/{account.archived ? 'unarchive' : 'archive'}"
				use:enhance={() =>
					async ({ result }) => {
						await invalidateAll();
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
						<div class="flex items-center gap-2">
							<div
								class="flex size-9 items-center justify-center rounded-lg border backdrop-blur"
								style="background-color: {color}26; border-color: {color}40; color: {color}"
							>
								{#if IconComp}
									<IconComp class="size-5" />
								{:else}
									<Wallet class="size-5" />
								{/if}
							</div>
							<div>
								<div class="text-muted-foreground text-xs tracking-wider uppercase">
									{account.type}
								</div>
								<div class="leading-tight font-semibold">{account.name}</div>
							</div>
						</div>
						{@render rowMenu(account)}
					</div>

					<div>
						<div class="text-muted-foreground text-xs tracking-wider uppercase">Balance</div>
						<div class="text-2xl font-semibold tracking-tight tabular-nums xl:text-3xl">
							{formatBalance(account.balanceCents, account.currency)}
						</div>
					</div>

					<div class="text-muted-foreground flex items-end justify-between text-xs">
						<span class="tracking-[0.3em]">•••• ••••</span>
						<span class="font-semibold tracking-wider" style="color: {color}">
							{account.currency}
						</span>
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
	<ul
		class="space-y-2 md:hidden"
		use:dndzone={{
			items: visibleAccounts,
			flipDurationMs: 150,
			dropTargetStyle: {},
			dragDisabled: dndDisabled
		}}
		onconsider={(e) => (visibleAccounts = e.detail.items)}
		onfinalize={(e) => {
			visibleAccounts = e.detail.items;
			persistOrder(visibleAccounts.map((a) => a.id));
			disableDrag();
		}}
	>
		{#each visibleAccounts as account (account.id)}
			{@const IconComp = iconForType(account.type)}
			<li
				class="bg-card flex items-center gap-3 rounded-lg border p-3 {account.archived
					? 'opacity-60'
					: ''}"
			>
				<button
					type="button"
					tabindex="-1"
					aria-label="Drag to reorder"
					onpointerdown={enableDrag}
					ontouchstart={enableDrag}
					class="shrink-0 cursor-grab touch-none active:cursor-grabbing"
				>
					<GripVertical class="text-muted-foreground size-4" />
				</button>
				<div class="flex min-w-0 flex-1 items-center gap-3">
					<div
						class="flex size-9 shrink-0 items-center justify-center rounded-md"
						style={account.color ? `background-color: ${account.color}20` : ''}
					>
						{#if IconComp}
							<IconComp class="size-4" style={account.color ? `color: ${account.color}` : ''} />
						{:else}
							<Wallet class="text-muted-foreground size-4" />
						{/if}
					</div>
					<div class="min-w-0 flex-1">
						<div class="truncate font-medium">{account.name}</div>
						<div class="text-muted-foreground mt-0.5 text-xs capitalize">
							{account.type} · {account.currency}
						</div>
						<div class="mt-1 text-base font-semibold tabular-nums">
							{formatBalance(account.balanceCents, account.currency)}
						</div>
					</div>
					{@render rowMenu(account)}
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
	<Button
		variant="ghost"
		size="sm"
		href={data.includeArchived ? '/accounts' : '/accounts?archived=1'}
	>
		{data.includeArchived ? 'Hide archived' : 'Show archived'}
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
			return async ({ result }) => {
				createPending = false;
				if (result.type === 'success') {
					await invalidateAll();
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
		<div class="grid grid-cols-2 gap-3">
			<div class="space-y-1">
				<Label for="create-currency">Currency</Label>
				<Input id="create-currency" name="currency" required maxlength={8} value="IDR" />
			</div>
			<div class="space-y-1">
				<Label for="create-balance">Initial balance</Label>
				<MoneyInput id="create-balance" name="initialBalanceCents" min={0} class="h-12 text-2xl" />
			</div>
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
	<form
		method="POST"
		action="?/update"
		use:enhance={({ formData }) => {
			formData.set('type', editType);
			formData.set('color', editColor);
			editPending = true;
			return async ({ result }) => {
				editPending = false;
				if (result.type === 'success') {
					await invalidateAll();
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
		<div class="space-y-1">
			<Label for="edit-name">Name</Label>
			<Input id="edit-name" name="name" required maxlength={80} value={account.name} />
		</div>
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
		<div class="grid grid-cols-2 gap-3">
			<div class="space-y-1">
				<Label for="edit-currency">Currency</Label>
				<Input id="edit-currency" name="currency" required maxlength={8} value={account.currency} />
			</div>
			<div class="space-y-1">
				<Label for="edit-balance">Initial balance</Label>
				<MoneyInput
					id="edit-balance"
					name="initialBalanceCents"
					min={0}
					value={account.initialBalanceCents}
					class="h-12 text-2xl"
				/>
			</div>
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

{#snippet adjustForm(target: AccountRow)}
	<form
		method="POST"
		action="?/adjust"
		use:enhance={() => {
			adjustPending = true;
			return async ({ result }) => {
				adjustPending = false;
				if (result.type === 'success') {
					await invalidateAll();
					adjustOpen = false;
					notify.success('Balance adjusted');
				} else if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					notify.error(message ?? 'Could not adjust');
				}
			};
		}}
		class="space-y-4 p-4"
	>
		<input type="hidden" name="id" value={target.id} />
		<div class="bg-muted rounded-lg p-3 text-sm">
			<div class="text-muted-foreground text-xs">Current balance</div>
			<div class="text-base font-semibold tabular-nums">
				{formatBalance(target.balanceCents, target.currency)}
			</div>
		</div>
		<div class="space-y-1">
			<Label for="adjust-target">New balance</Label>
			<MoneyInput
				id="adjust-target"
				name="targetCents"
				bind:value={adjustTargetCents}
				class="h-12 text-2xl"
				required
			/>
		</div>
		<div class="space-y-1">
			<Label for="adjust-note">Note (optional)</Label>
			<Input
				id="adjust-note"
				name="note"
				bind:value={adjustNote}
				maxlength={200}
				placeholder="Reason for adjustment"
			/>
		</div>
		<p class="text-muted-foreground text-xs">
			Creates a tracked transaction (income or expense) under "Balance Adjustment" category for the
			difference.
		</p>
		<div class="flex justify-end gap-2">
			<Button type="button" variant="outline" onclick={() => (adjustOpen = false)}>Cancel</Button>
			<SubmitButton pending={adjustPending}>Save</SubmitButton>
		</div>
	</form>
{/snippet}

{#if adjustTarget}
	{#if isDesktop.current}
		<Dialog.Root bind:open={adjustOpen}>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Adjust</Dialog.Title>
				</Dialog.Header>
				{@render adjustForm(adjustTarget)}
			</Dialog.Content>
		</Dialog.Root>
	{:else}
		<Sheet.Root bind:open={adjustOpen}>
			<Sheet.Content
				side="bottom"
				class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
			>
				<Sheet.Header class="p-4 pb-2 text-left">
					<Sheet.Title>Adjust</Sheet.Title>
				</Sheet.Header>
				<div class="flex-1 overflow-y-auto">{@render adjustForm(adjustTarget)}</div>
			</Sheet.Content>
		</Sheet.Root>
	{/if}
{/if}
