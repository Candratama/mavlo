<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import MoneyInput from './money-input.svelte';
	import SubmitButton from './submit-button.svelte';
	import SegmentedControl from '$lib/components/ui/segmented-control.svelte';
	import PickerSheet, { type PickerItem } from '$lib/components/ui/picker-sheet.svelte';
	import {
		CalendarDays,
		StickyNote,
		Trash2,
		Coins,
		Landmark,
		CreditCard,
		Wallet,
		CircleEllipsis,
		Tag
	} from 'lucide-svelte';
	import { setLastUsed } from '$lib/utils/last-used.js';
	import { notify } from '$lib/utils/toast.js';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { getIconByName } from '$lib/utils/category-icons.js';
	import { MediaQuery } from 'svelte/reactivity';

	type Account = {
		id: string;
		name: string;
		currency: string;
		balanceCents?: number;
		type?: string;
	};
	type Category = {
		id: string;
		name: string;
		kind: 'income' | 'expense';
		icon?: string | null;
	};
	type EditTarget = {
		id: string;
		kind: 'income' | 'expense' | 'transfer';
		amountCents: number;
		accountId: string;
		transferToAccountId: string | null;
		categoryId: string | null;
		occurredAt: number;
		note: string | null;
	};

	type Props = {
		open: boolean;
		mode: 'create' | 'edit';
		accounts: Account[];
		categories: Category[];
		defaultKind?: 'income' | 'expense' | 'transfer';
		defaultAccountId?: string;
		editTarget?: EditTarget | null;
		actionUrl: string;
		onClose: () => void;
		onSuccess?: () => void;
	};

	let {
		open = $bindable(),
		mode,
		accounts,
		categories,
		defaultKind = 'expense',
		defaultAccountId,
		editTarget = null,
		actionUrl,
		onClose,
		onSuccess
	}: Props = $props();

	const todayYmd = new Date().toISOString().slice(0, 10);

	function initialState() {
		if (mode === 'edit' && editTarget) {
			return {
				kind: editTarget.kind,
				accountId: editTarget.accountId,
				transferToAccountId: editTarget.transferToAccountId ?? '',
				categoryId: editTarget.categoryId ?? '',
				occurredAt: new Date(editTarget.occurredAt).toISOString().slice(0, 10),
				note: editTarget.note ?? ''
			};
		}
		return {
			kind: defaultKind,
			accountId: defaultAccountId ?? accounts[0]?.id ?? '',
			transferToAccountId: '',
			categoryId: '',
			occurredAt: todayYmd,
			note: ''
		};
	}

	let dateInput: HTMLInputElement | undefined = $state();
	let kind = $state<'income' | 'expense' | 'transfer'>(initialState().kind);
	let accountId = $state(initialState().accountId);
	let transferToAccountId = $state(initialState().transferToAccountId);
	let categoryId = $state(initialState().categoryId);
	let occurredAt = $state(initialState().occurredAt);
	let note = $state(initialState().note);
	let showNote = $state(initialState().note.length > 0);
	let pending = $state(false);

	$effect(() => {
		if (!open) return;
		const i = initialState();
		kind = i.kind;
		accountId = i.accountId;
		transferToAccountId = i.transferToAccountId;
		categoryId = i.categoryId;
		occurredAt = i.occurredAt;
		note = i.note;
		showNote = i.note.length > 0;
	});

	const kindOptions = [
		{ value: 'expense', label: 'Expense' },
		{ value: 'income', label: 'Income' },
		{ value: 'transfer', label: 'Transfer' }
	];

	type Icon = PickerItem['icon'];
	const accountTypeIcon: Record<string, Icon> = {
		cash: Coins as unknown as Icon,
		bank: Landmark as unknown as Icon,
		credit: CreditCard as unknown as Icon,
		wallet: Wallet as unknown as Icon,
		other: CircleEllipsis as unknown as Icon
	};
	const fallbackAccountIcon = Wallet as unknown as Icon;
	const fallbackCategoryIcon = Tag as unknown as Icon;

	const accountItems = $derived<PickerItem[]>(
		accounts.map((a) => ({
			value: a.id,
			label: a.name,
			description:
				a.balanceCents !== undefined
					? `${a.currency} · ${formatCentsAsCurrency(a.balanceCents, a.currency)}`
					: a.currency,
			icon: (a.type && accountTypeIcon[a.type]) || fallbackAccountIcon
		}))
	);

	const categoryItems = $derived<PickerItem[]>([
		{ value: '', label: 'None', icon: fallbackCategoryIcon },
		...categories
			.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense'))
			.map((c) => ({
				value: c.id,
				label: c.name,
				icon: (getIconByName(c.icon) as unknown as Icon) ?? fallbackCategoryIcon
			}))
	]);

	$effect(() => {
		const ids = new Set(categoryItems.map((i) => i.value));
		if (categoryId && !ids.has(categoryId)) categoryId = '';
	});

	const isToday = $derived(occurredAt === todayYmd);
	const dateLabel = $derived(
		isToday
			? 'Today'
			: new Date(occurredAt).toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				})
	);

	function onClosed() {
		open = false;
		onClose();
	}

	const isDesktop = new MediaQuery('(min-width: 768px)');
</script>

{#snippet body()}
	<form
		method="POST"
		action={actionUrl}
		use:enhance={() => {
			pending = true;
			return async ({ result }) => {
				pending = false;
				if (result.type === 'success') {
					setLastUsed({ accountId, kind });
					await invalidateAll();
					await onSuccess?.();
					notify.success(mode === 'create' ? 'Transaction added' : 'Transaction updated');
					onClosed();
				} else if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					notify.error(message ?? 'Could not save transaction');
				}
			};
		}}
		class="space-y-4 px-4 pb-4"
	>
		{#if mode === 'edit' && editTarget}
			<input type="hidden" name="id" value={editTarget.id} />
		{/if}

		<SegmentedControl options={kindOptions} bind:value={kind} ariaLabel="Transaction kind" />
		<input type="hidden" name="kind" value={kind} />

		<div class="space-y-1">
			<div class="text-muted-foreground text-xs">
				{accounts.find((a) => a.id === accountId)?.currency ?? 'IDR'}
			</div>
			<MoneyInput
				name="amountCents"
				value={editTarget?.amountCents ?? null}
				min={1}
				required
				placeholder="0"
				class="h-14 text-3xl font-semibold md:h-12 md:text-2xl"
			/>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={() => dateInput?.showPicker?.()}
				class="border-input bg-background hover:bg-accent/30 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm"
			>
				<CalendarDays class="size-4" />
				{dateLabel}
			</button>
			<input
				bind:this={dateInput}
				type="date"
				name="occurredAt"
				bind:value={occurredAt}
				class="sr-only"
				tabindex="-1"
				aria-hidden="true"
			/>
			{#if !showNote}
				<button
					type="button"
					onclick={() => (showNote = true)}
					class="border-input text-muted-foreground hover:bg-accent/30 inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed px-3 text-sm"
				>
					<StickyNote class="size-4" />
					Add note
				</button>
			{/if}
		</div>

		{#if showNote}
			<div class="space-y-1">
				<Label for="tx-note">Note</Label>
				<div class="flex items-center gap-2">
					<Input
						id="tx-note"
						name="note"
						bind:value={note}
						maxlength={200}
						placeholder="Optional"
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onclick={() => {
							note = '';
							showNote = false;
						}}
						aria-label="Remove note"
					>
						<Trash2 class="size-4" />
					</Button>
				</div>
			</div>
		{/if}

		<div class="space-y-2">
			<Label>{kind === 'transfer' ? 'From account' : 'Account'}</Label>
			<PickerSheet
				items={accountItems}
				bind:value={accountId}
				name="accountId"
				placeholder="Choose account"
				title="Select account"
			/>
		</div>

		{#if kind === 'transfer'}
			<div class="space-y-2">
				<Label>To account</Label>
				<PickerSheet
					items={accountItems.filter((i) => i.value !== accountId)}
					bind:value={transferToAccountId}
					name="transferToAccountId"
					placeholder="Choose destination"
					title="Select destination"
				/>
			</div>
		{:else}
			<div class="space-y-2">
				<Label>Category</Label>
				<PickerSheet
					items={categoryItems}
					bind:value={categoryId}
					name="categoryId"
					placeholder="None"
					title="Select category"
					searchable
				/>
			</div>
		{/if}

		<div
			class="bg-background sticky bottom-0 -mx-4 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
		>
			<SubmitButton {pending} class="w-full">
				{mode === 'create' ? 'Save' : 'Update'}
			</SubmitButton>
		</div>
		<div class="hidden justify-end gap-2 pt-2 md:flex">
			<Button type="button" variant="outline" onclick={onClosed}>Cancel</Button>
			<SubmitButton {pending}>{mode === 'create' ? 'Save' : 'Update'}</SubmitButton>
		</div>
	</form>
{/snippet}

{#if isDesktop.current}
	<Dialog.Root bind:open>
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title>{mode === 'create' ? 'New transaction' : 'Edit transaction'}</Dialog.Title>
			</Dialog.Header>
			{@render body()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open>
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left">
				<Sheet.Title>{mode === 'create' ? 'New transaction' : 'Edit transaction'}</Sheet.Title>
			</Sheet.Header>
			<div class="flex-1 overflow-y-auto">
				{@render body()}
			</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}
