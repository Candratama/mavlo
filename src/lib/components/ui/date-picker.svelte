<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import { Popover } from 'bits-ui';
	import { CalendarDays } from 'lucide-svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { parseDate, type DateValue, type CalendarDate } from '@internationalized/date';
	import { cn } from '$lib/utils.js';

	type Props = {
		value: string;
		name?: string;
		placeholder?: string;
		title?: string;
		disabled?: boolean;
		id?: string;
		class?: string;
		variant?: 'input' | 'pill';
		label?: string;
	};

	let {
		value = $bindable(),
		name,
		placeholder = 'Select date',
		title = 'Select date',
		disabled = false,
		id,
		class: className = '',
		variant = 'input',
		label
	}: Props = $props();

	let open = $state(false);

	const isDesktop = new MediaQuery('(min-width: 768px)');

	const dateValue = $derived.by<DateValue | undefined>(() => {
		if (!value) return undefined;
		try {
			return parseDate(value);
		} catch {
			return undefined;
		}
	});

	const displayLabel = $derived(label ?? value ?? placeholder);

	function onSelect(next: DateValue | undefined) {
		if (!next) {
			value = '';
		} else {
			const d = next as CalendarDate;
			const yyyy = String(d.year).padStart(4, '0');
			const mm = String(d.month).padStart(2, '0');
			const dd = String(d.day).padStart(2, '0');
			value = `${yyyy}-${mm}-${dd}`;
		}
		open = false;
	}

	const triggerClass = $derived.by(() => {
		if (variant === 'pill') {
			return cn(
				'border-input bg-background hover:bg-accent/30 inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm md:h-9 md:px-3 disabled:opacity-50',
				className
			);
		}
		return cn(
			'flex min-h-12 md:min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors disabled:opacity-50 hover:bg-accent/30',
			!value && 'text-muted-foreground',
			className
		);
	});
</script>

{#snippet body()}
	<Calendar
		type="single"
		value={dateValue}
		onValueChange={(v) => onSelect(v as DateValue | undefined)}
	/>
{/snippet}

{#if isDesktop.current}
	<Popover.Root bind:open>
		<Popover.Trigger>
			{#snippet child({ props })}
				<button {...props} type="button" {id} {disabled} class={triggerClass}>
					<span class="flex min-w-0 flex-1 items-center gap-2">
						<CalendarDays class="size-4 shrink-0 opacity-70" />
						<span class="truncate">{displayLabel}</span>
					</span>
				</button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content
			side="bottom"
			align="start"
			sideOffset={4}
			class="bg-popover text-popover-foreground z-50 rounded-md border p-0 shadow-md outline-none"
		>
			{@render body()}
		</Popover.Content>
	</Popover.Root>
{:else}
	<Sheet.Root bind:open>
		<Sheet.Trigger>
			{#snippet child({ props })}
				<button {...props} type="button" {id} {disabled} class={triggerClass}>
					<span class="flex min-w-0 flex-1 items-center gap-2">
						<CalendarDays class="size-4 shrink-0 opacity-70" />
						<span class="truncate">{displayLabel}</span>
					</span>
				</button>
			{/snippet}
		</Sheet.Trigger>
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(80dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left">
				<Sheet.Title>{title}</Sheet.Title>
			</Sheet.Header>
			<div class="flex flex-1 items-start justify-center overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
				{@render body()}
			</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}

{#if name}
	<input type="hidden" {name} {value} />
{/if}
