<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import MoneyInput from '$lib/components/forms/money-input.svelte';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { notify } from '$lib/utils/toast.js';

	let {
		subsidyId,
		fromName,
		toName,
		currentAmountCents,
		sourceRemainingExclSelfCents,
		currentNote,
		onClose
	}: {
		subsidyId: string;
		fromName: string;
		toName: string;
		currentAmountCents: number;
		sourceRemainingExclSelfCents: number;
		currentNote: string | null;
		onClose: () => void;
	} = $props();

	let amountCents = $state(currentAmountCents);
	let pending = $state(false);

	const maxAmount = $derived(sourceRemainingExclSelfCents);
</script>

<form
	method="POST"
	action="/budgets?/updateSubsidy"
	use:enhance={() => {
		pending = true;
		return async ({ result }) => {
			pending = false;
			if (result.type === 'success') {
				await invalidateAll();
				onClose();
				notify.success('Subsidy updated');
			} else if (result.type === 'failure') {
				const message = (result.data as { message?: string } | undefined)?.message;
				notify.error(message ?? 'Update failed');
			}
		};
	}}
	class="space-y-4 p-4"
>
	<input type="hidden" name="id" value={subsidyId} />
	<div class="rounded-lg bg-muted/40 p-3 text-sm">
		<div class="font-medium">{fromName} → {toName}</div>
		<div class="text-muted-foreground mt-1 text-xs">
			From/to cannot be changed.
		</div>
	</div>

	<div class="space-y-1">
		<div class="flex items-center justify-between">
			<Label for="subsidy-edit-amount">Amount</Label>
			{#if maxAmount > 0}
				<button
					type="button"
					class="text-primary hover:underline text-xs font-medium"
					onclick={() => (amountCents = maxAmount)}
				>
					Use all ({formatCentsAsCurrency(maxAmount, 'IDR')})
				</button>
			{/if}
		</div>
		<MoneyInput
			id="subsidy-edit-amount"
			name="amountCents"
			min={1}
			bind:value={amountCents}
			required
			class="h-12 text-lg md:h-12 md:text-lg"
		/>
		<p class="text-muted-foreground text-xs">
			Max: {formatCentsAsCurrency(maxAmount, 'IDR')}
		</p>
	</div>

	<div class="space-y-1">
		<Label for="subsidy-edit-note">Note</Label>
		<Input id="subsidy-edit-note" name="note" maxlength={200} value={currentNote ?? ''} />
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
			disabled={amountCents <= 0 || amountCents > maxAmount}
			class="h-12 flex-1 rounded-full !bg-white text-base font-semibold !text-neutral-900 hover:!bg-white/90 md:h-10 md:text-sm"
		>
			Save
		</SubmitButton>
	</div>
</form>
