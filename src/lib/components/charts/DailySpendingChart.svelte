<script lang="ts">
	import { Chart, Svg, Axis, Area } from 'layerchart';
	import { scaleTime } from 'd3-scale';

	interface Row {
		dateMs: number;
		amountCents: number;
	}

	let { data }: { data: Row[]; currency?: string } = $props();

	const total = $derived(data.reduce((sum, r) => sum + r.amountCents, 0));

	const formatDay = (d: Date | number) => {
		const date = d instanceof Date ? d : new Date(d);
		return String(date.getUTCDate());
	};
</script>

{#if total === 0}
	<div
		class="flex h-64 items-center justify-center text-sm text-muted-foreground"
	>
		No expense data this month.
	</div>
{:else}
	<div class="h-64">
		<Chart
			{data}
			x={(d: Row) => new Date(d.dateMs)}
			xScale={scaleTime()}
			y="amountCents"
			yDomain={[0, null]}
			padding={{ top: 8, right: 16, bottom: 24, left: 56 }}
		>
			<Svg>
				<Axis placement="left" rule grid />
				<Axis placement="bottom" format={formatDay} />
				<Area
					line={{ class: 'stroke-emerald-500 stroke-2' }}
					class="fill-emerald-500/20"
				/>
			</Svg>
		</Chart>
	</div>
{/if}
