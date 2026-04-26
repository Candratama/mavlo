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

	let { data }: { data: Row[]; currency?: string } = $props();

	const formatMonth = (period: string) => {
		const [y, m] = period.split('-');
		const date = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
		return date.toLocaleString('en', { month: 'short' });
	};

	const flat = $derived<FlatRow[]>(
		data.flatMap((r) => [
			{ periodMonth: r.periodMonth, kind: 'income' as const, amountCents: r.incomeCents },
			{ periodMonth: r.periodMonth, kind: 'expense' as const, amountCents: r.expenseCents }
		])
	);

	const hasData = $derived(data.some((r) => r.incomeCents > 0 || r.expenseCents > 0));
</script>

{#if !hasData}
	<div
		class="flex h-48 sm:h-56 md:h-64 items-center justify-center text-sm text-muted-foreground"
	>
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
			cRange={['#10b981', '#f43f5e']}
			padding={{ top: 8, right: 16, bottom: 24, left: 64 }}
		>
			<Svg>
				<Axis placement="left" rule grid />
				<Axis placement="bottom" format={formatMonth} />
				<Bars radius={2} />
			</Svg>
		</Chart>
	</div>
{/if}
