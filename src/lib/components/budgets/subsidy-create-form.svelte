<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import MoneyInput from '$lib/components/forms/money-input.svelte';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import PickerSheet, { type PickerItem } from '$lib/components/ui/picker-sheet.svelte';
	import { Tag } from 'lucide-svelte';
	import { getIconByName } from '$lib/utils/category-icons.js';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { notify } from '$lib/utils/toast.js';

	type EligibleSource = {
		budgetId: string;
		categoryName: string;
		categoryIcon: string | null;
		sourceRemainingCents: number;
	};

	let {
		targetBudgetId,
		targetCategoryName,
		targetOverageCents,
		alreadyCoveredCents,
		eligibleSources,
		onClose
	}: {
		targetBudgetId: string;
		targetCategoryName: string;
		targetOverageCents: number;
		alreadyCoveredCents: number;
		eligibleSources: EligibleSource[];
		onClose: () => void;
	} = $props();

	let sourceId = $state('');
	let amountCents = $state(0);
	let pending = $state(false);

	const remainingGap = $derived(Math.max(0, targetOverageCents - alreadyCoveredCents));

	const selectedSource = $derived(eligibleSources.find((s) => s.budgetId === sourceId));
	const maxAmount = $derived(
		selectedSource
			? Math.min(remainingGap, selectedSource.sourceRemainingCents)
			: remainingGap
	);

	type Icon = PickerItem['icon'];
	const fallback = Tag as unknown as Icon;
	const sourceItems = $derived<PickerItem[]>(
		eligibleSources.map((s) => ({
			value: s.budgetId,
			label: `${s.categoryName} · sisa ${formatCentsAsCurrency(s.sourceRemainingCents, 'IDR')}`,
			icon: (getIconByName(s.categoryIcon) as unknown as Icon) ?? fallback
		}))
	);
</script>

<form
	method="POST"
	action="/budgets?/subsidize"
	use:enhance={() => {
		pending = true;
		return async ({ result }) => {
			pending = false;
			if (result.type === 'success') {
				await invalidateAll();
				onClose();
				notify.success('Subsidi dicatat');
			} else if (result.type === 'failure') {
				const message = (result.data as { message?: string } | undefined)?.message;
				notify.error(message ?? 'Subsidi gagal');
			}
		};
	}}
	class="space-y-4 p-4"
>
	<input type="hidden" name="toBudgetId" value={targetBudgetId} />
	<div class="rounded-lg bg-muted/40 p-3 text-sm">
		<div class="font-medium">{targetCategoryName}</div>
		<div class="text-muted-foreground mt-1 text-xs">
			Kekurangan: {formatCentsAsCurrency(targetOverageCents, 'IDR')}
		</div>
		<div class="text-muted-foreground text-xs">
			Sudah disubsidi: {formatCentsAsCurrency(alreadyCoveredCents, 'IDR')}
		</div>
		<div class="text-xs font-medium">
			Sisa yang bisa ditutup: {formatCentsAsCurrency(remainingGap, 'IDR')}
		</div>
	</div>

	<div class="space-y-1">
		<Label>Sumber</Label>
		{#if sourceItems.length === 0}
			<p class="text-muted-foreground text-sm">
				Tidak ada budget dengan sisa alokasi.
			</p>
		{:else}
			<PickerSheet
				items={sourceItems}
				bind:value={sourceId}
				name="fromBudgetId"
				placeholder="Pilih sumber"
				title="Sumber"
				searchable
			/>
		{/if}
	</div>

	<div class="space-y-1">
		<Label for="subsidy-amount">Jumlah</Label>
		<MoneyInput
			id="subsidy-amount"
			name="amountCents"
			min={1}
			bind:value={amountCents}
			required
			class="h-12 text-lg md:h-12 md:text-lg"
		/>
		{#if selectedSource}
			<p class="text-muted-foreground text-xs">
				Maks: {formatCentsAsCurrency(maxAmount, 'IDR')}
			</p>
		{/if}
	</div>

	<div class="space-y-1">
		<Label for="subsidy-note">Catatan (opsional)</Label>
		<Input id="subsidy-note" name="note" maxlength={200} />
	</div>

	<div class="flex gap-2 pt-2">
		<Button
			type="button"
			variant="outline"
			onclick={onClose}
			class="h-12 flex-1 rounded-full text-base font-semibold md:h-10 md:text-sm"
		>
			Cancel
		</Button>
		<SubmitButton
			pending={pending}
			disabled={!sourceId || amountCents <= 0 || amountCents > maxAmount}
			class="h-12 flex-1 rounded-full !bg-white text-base font-semibold !text-neutral-900 hover:!bg-white/90 md:h-10 md:text-sm"
		>
			Subsidi
		</SubmitButton>
	</div>
</form>
