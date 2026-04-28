<script lang="ts">
	import { Chart, Pie, Svg, Arc } from 'layerchart';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';

	interface CategoryRow {
		categoryId: string;
		categoryName: string;
		amountCents: number;
	}

	let { data, currency = 'IDR' }: { data: CategoryRow[]; currency?: string } = $props();

	// Brand-aligned palette in 800 shade
	const PALETTE = [
		'#065f46', // emerald-800
		'#155e75', // cyan-800
		'#5b21b6', // violet-800
		'#9f1239', // rose-800
		'#92400e', // amber-800
		'#115e59', // teal-800
		'#9d174d', // pink-800
		'#075985' // sky-800
	];

	const formatCents = (cents: number) => formatCentsAsCurrency(cents, currency);

	const total = $derived(data.reduce((sum, r) => sum + r.amountCents, 0));
</script>

{#if data.length === 0}
	<div class="text-muted-foreground flex h-48 items-center justify-center text-sm sm:h-56 md:h-64">
		No expense data this month.
	</div>
{:else}
	<div class="h-48 sm:h-56 md:h-64">
		<Chart {data} x="amountCents" c="categoryName" cRange={PALETTE}>
			<Svg center>
				<Pie innerRadius={0.6} cornerRadius={2} padAngle={0.01} let:arcs>
					{#each arcs as arc, i (i)}
						{@const pct =
							total > 0 ? Math.round(((arc.data as CategoryRow).amountCents / total) * 100) : 0}
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
									class="pointer-events-none fill-white text-[11px] font-semibold"
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
				<div class="flex min-w-0 items-center gap-2">
					<span
						class="size-3 shrink-0 rounded-sm"
						style="background-color: {PALETTE[i % PALETTE.length]}"
					></span>
					<span class="truncate">{row.categoryName}</span>
				</div>
				<span class="text-muted-foreground shrink-0 tabular-nums"
					>{formatCents(row.amountCents)}</span
				>
			</div>
		{/each}
		<div class="mt-2 flex justify-between border-t pt-2 font-medium">
			<span>Total</span>
			<span class="tabular-nums">{formatCents(total)}</span>
		</div>
	</div>
{/if}
