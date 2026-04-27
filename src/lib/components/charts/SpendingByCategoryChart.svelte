<script lang="ts">
	import { Chart, Pie, Svg, Arc } from 'layerchart';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';

	interface CategoryRow {
		categoryId: string;
		categoryName: string;
		amountCents: number;
	}

	let { data, currency = 'IDR' }: { data: CategoryRow[]; currency?: string } = $props();

	const PALETTE = [
		'#10b981',
		'#3b82f6',
		'#f59e0b',
		'#ef4444',
		'#8b5cf6',
		'#ec4899',
		'#14b8a6',
		'#f97316'
	];

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
		<Chart {data} x="amountCents" c="categoryName" cRange={PALETTE}>
			<Svg center>
				<Pie innerRadius={0.6} cornerRadius={2} padAngle={0.01} let:arcs>
					{#each arcs as arc, i (i)}
						{@const pct = total > 0 ? Math.round(((arc.data as CategoryRow).amountCents / total) * 100) : 0}
						<Arc
							startAngle={arc.startAngle}
							endAngle={arc.endAngle}
							padAngle={arc.padAngle}
							innerRadius={0.6}
							cornerRadius={2}
							fill={PALETTE[i % PALETTE.length]}
							let:centroid
						>
							{#if pct >= 5}
								<text
									x={centroid[0]}
									y={centroid[1]}
									text-anchor="middle"
									dominant-baseline="middle"
									class="fill-white text-[11px] font-semibold pointer-events-none"
								>
									{pct}%
								</text>
							{/if}
						</Arc>
					{/each}
				</Pie>
			</Svg>
		</Chart>
	</div>
	<div class="mt-4 space-y-1.5 text-sm">
		{#each data as row, i (row.categoryId)}
			<div class="flex items-center justify-between gap-3">
				<div class="flex items-center gap-2 min-w-0">
					<span class="size-3 rounded-sm shrink-0" style="background-color: {PALETTE[i % PALETTE.length]}"></span>
					<span class="truncate">{row.categoryName}</span>
				</div>
				<span class="tabular-nums text-muted-foreground shrink-0">{formatCents(row.amountCents)}</span>
			</div>
		{/each}
		<div class="mt-2 flex justify-between border-t pt-2 font-medium">
			<span>Total</span>
			<span class="tabular-nums">{formatCents(total)}</span>
		</div>
	</div>
{/if}
