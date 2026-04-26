<script lang="ts">
	import { Chart, Pie, Svg } from 'layerchart';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';

	interface CategoryRow {
		categoryId: string;
		categoryName: string;
		amountCents: number;
	}

	let { data, currency = 'IDR' }: { data: CategoryRow[]; currency?: string } = $props();

	const formatCents = (cents: number) => formatCentsAsCurrency(cents, currency);

	const total = $derived(data.reduce((sum, r) => sum + r.amountCents, 0));
</script>

{#if data.length === 0}
	<div
		class="flex h-48 sm:h-56 md:h-64 items-center justify-center text-sm text-muted-foreground"
	>
		No expense data this month.
	</div>
{:else}
	<div class="h-48 sm:h-56 md:h-64">
		<Chart
			{data}
			x="amountCents"
			c="categoryName"
			cRange={[
				'#10b981',
				'#3b82f6',
				'#f59e0b',
				'#ef4444',
				'#8b5cf6',
				'#ec4899',
				'#14b8a6',
				'#f97316'
			]}
		>
			<Svg center>
				<Pie innerRadius={0.6} cornerRadius={2} padAngle={0.01} />
			</Svg>
		</Chart>
	</div>
	<div class="mt-4 space-y-1 text-sm">
		{#each data.slice(0, 5) as row (row.categoryId)}
			<div class="flex justify-between">
				<span>{row.categoryName}</span>
				<span class="tabular-nums text-muted-foreground"
					>{formatCents(row.amountCents)}</span
				>
			</div>
		{/each}
		{#if data.length > 5}
			<div class="pt-2 text-xs text-muted-foreground">+{data.length - 5} more</div>
		{/if}
		<div class="mt-2 flex justify-between border-t pt-2 font-medium">
			<span>Total</span>
			<span class="tabular-nums">{formatCents(total)}</span>
		</div>
	</div>
{/if}
