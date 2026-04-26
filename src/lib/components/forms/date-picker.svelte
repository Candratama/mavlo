<script lang="ts">
	import { CalendarDate, parseDate, getLocalTimeZone } from '@internationalized/date';
	import type { DateValue } from '@internationalized/date';
	import * as Popover from '$lib/components/ui/popover';
	import { Calendar } from '$lib/components/ui/calendar';
	import { Button } from '$lib/components/ui/button';
	import { Calendar as CalendarIcon } from 'lucide-svelte';
	import { cn } from '$lib/utils.js';

	type Props = {
		name: string;
		value?: string; // YYYY-MM-DD
		required?: boolean;
		id?: string;
		placeholder?: string;
		class?: string;
	};

	let {
		name,
		value = $bindable(''),
		required = false,
		id,
		placeholder = 'Pick a date',
		class: className = ''
	}: Props = $props();

	let open = $state(false);

	const dateValue = $derived(value ? safeParse(value) : undefined);

	function safeParse(s: string): CalendarDate | undefined {
		try {
			return parseDate(s);
		} catch {
			return undefined;
		}
	}

	function format(d: CalendarDate | undefined): string {
		if (!d) return placeholder;
		const dt = d.toDate(getLocalTimeZone());
		return dt.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
	}

	function pick(d: DateValue | undefined) {
		if (d) {
			const m = String(d.month).padStart(2, '0');
			const day = String(d.day).padStart(2, '0');
			value = `${d.year}-${m}-${day}`;
		} else {
			value = '';
		}
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
				class={cn(
					'w-full justify-start text-left font-normal',
					!value && 'text-muted-foreground',
					className
				)}
			>
				<CalendarIcon class="size-4 mr-2" />
				{format(dateValue)}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-auto p-0" align="start">
		<Calendar
			type="single"
			value={dateValue}
			onValueChange={pick}
		/>
	</Popover.Content>
</Popover.Root>

<input type="hidden" {name} {required} {value} />
