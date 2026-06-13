<script lang="ts">
	import { Chart, Svg, Axis, Bars } from 'layerchart';
	import { scaleBand } from 'd3-scale';

	interface Row {
		periodMonth: string;
		incomeCents: number;
		expenseCents: number;
	}

	interface FlatRow {
		periodMonth: string;
		kind: 'income' | 'expense';
		amountCents: number;
	}

	let { data }: { data: Row[] } = $props();

	const formatMonth = (period: string) => {
		const [y, m] = period.split('-');
		const date = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
		return date.toLocaleString('en', { month: 'short' });
	};

	const formatCompact = (cents: number) => {
		const v = cents / 100;
		if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
		if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
		if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K';
		return String(Math.round(v));
	};

	const activeData = $derived(data.filter((r) => r.incomeCents > 0 || r.expenseCents > 0));

	const flat = $derived<FlatRow[]>(
		activeData.flatMap((r) => [
			{ periodMonth: r.periodMonth, kind: 'income' as const, amountCents: r.incomeCents },
			{ periodMonth: r.periodMonth, kind: 'expense' as const, amountCents: r.expenseCents }
		])
	);

	const hasData = $derived(activeData.length > 0);
</script>

{#if !hasData}
	<div class="text-muted-foreground flex h-48 items-center justify-center text-sm sm:h-56 md:h-64">
		No transaction history yet.
	</div>
{:else}
	<div class="h-48 sm:h-56 md:h-64">
		<Chart
			data={flat}
			x="periodMonth"
			xScale={scaleBand().padding(0.2)}
			x1="kind"
			x1Scale={scaleBand().padding(0.1)}
			x1Domain={['income', 'expense']}
			y="amountCents"
			yDomain={[0, null]}
			c="kind"
			cDomain={['income', 'expense']}
			cRange={['#047857', '#9f1239']}
			padding={{ top: 8, right: 8, bottom: 24, left: 36 }}
		>
			<Svg>
				<Axis
					placement="left"
					format={formatCompact}
					rule={{ class: 'stroke-border' }}
					grid={{ class: 'stroke-border/50' }}
					tickLabelProps={{ class: 'fill-muted-foreground stroke-none text-[10px]' }}
					classes={{ tick: 'stroke-border' }}
				/>
				<Axis
					placement="bottom"
					format={formatMonth}
					rule={{ class: 'stroke-border' }}
					tickLabelProps={{ class: 'fill-muted-foreground stroke-none text-[10px]' }}
					classes={{ tick: 'stroke-border' }}
				/>
				<Bars radius={14} rounded="top" />
			</Svg>
		</Chart>
	</div>
{/if}
