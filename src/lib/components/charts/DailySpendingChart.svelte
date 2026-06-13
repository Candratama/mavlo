<script lang="ts">
	import { Chart, Svg, Axis, Area } from 'layerchart';
	import { scaleTime } from 'd3-scale';
	import { curveMonotoneX } from 'd3-shape';

	interface Row {
		dateMs: number;
		amountCents: number;
	}

	let { data }: { data: Row[] } = $props();

	const todayUtcEnd = (() => {
		const now = new Date();
		return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999);
	})();
	const visibleData = $derived(data.filter((r) => r.dateMs <= todayUtcEnd));
	const total = $derived(visibleData.reduce((sum, r) => sum + r.amountCents, 0));

	const formatDay = (d: Date | number) => {
		const date = d instanceof Date ? d : new Date(d);
		return String(date.getUTCDate());
	};

	const formatCompact = (cents: number) => {
		const v = cents / 100;
		if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
		if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
		if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K';
		return String(Math.round(v));
	};
</script>

{#if total === 0}
	<div class="text-muted-foreground flex h-48 items-center justify-center text-sm sm:h-56 md:h-64">
		No expense data this month.
	</div>
{:else}
	<div class="h-48 sm:h-56 md:h-64">
		<Chart
			data={visibleData}
			x={(d: Row) => new Date(d.dateMs)}
			xScale={scaleTime()}
			y="amountCents"
			yDomain={[0, null]}
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
					format={formatDay}
					rule={{ class: 'stroke-border' }}
					tickLabelProps={{ class: 'fill-muted-foreground stroke-none text-[10px]' }}
					classes={{ tick: 'stroke-border' }}
				/>
				<Area
					curve={curveMonotoneX}
					line={{ class: 'stroke-emerald-500 stroke-2' }}
					class="fill-emerald-500/15"
				/>
			</Svg>
		</Chart>
	</div>
{/if}
