<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import { Calendar as CalendarIcon } from 'lucide-svelte';
	import { cn } from '$lib/utils.js';

	type Props = {
		name: string;
		value?: string; // YYYY-MM
		required?: boolean;
		id?: string;
		class?: string;
	};

	let {
		name,
		value = $bindable(''),
		required = false,
		id,
		class: className = ''
	}: Props = $props();

	let open = $state(false);

	const todayDate = new Date();
	const initialParts = (
		value || `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}`
	).split('-');
	let year = $state(Number(initialParts[0]));
	let month = $state(Number(initialParts[1]));

	$effect(() => {
		const m = String(month).padStart(2, '0');
		value = `${year}-${m}`;
	});

	const months = [
		'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
		'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
	];

	const display = $derived(
		`${months[month - 1] ?? '—'} ${year}`
	);

	function setMonth(m: number) {
		month = m;
		open = false;
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				{id}
				variant="outline"
				class={cn('w-full justify-start text-left font-normal', className)}
			>
				<CalendarIcon class="size-4 mr-2" />
				{display}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-64 p-3" align="start">
		<div class="flex items-center justify-between mb-3">
			<Button variant="ghost" size="sm" onclick={() => year--}>‹</Button>
			<span class="text-sm font-medium">{year}</span>
			<Button variant="ghost" size="sm" onclick={() => year++}>›</Button>
		</div>
		<div class="grid grid-cols-3 gap-1">
			{#each months as label, i}
				<Button
					variant={month === i + 1 ? 'default' : 'ghost'}
					size="sm"
					onclick={() => setMonth(i + 1)}
				>
					{label}
				</Button>
			{/each}
		</div>
	</Popover.Content>
</Popover.Root>

<input type="hidden" {name} {required} {value} />
