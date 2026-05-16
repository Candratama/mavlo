<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-svelte';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { notify } from '$lib/utils/toast.js';

	type SubsidyEntry = {
		id: string;
		direction: 'in' | 'out';
		counterpartName: string;
		amountCents: number;
		note: string | null;
	};

	let {
		entries,
		onEdit
	}: {
		entries: SubsidyEntry[];
		onEdit: (id: string) => void;
	} = $props();

	let open = $state(false);
</script>

{#if entries.length > 0}
	<div class="relative z-10 mt-3 border-t pt-3 text-xs">
		<button
			type="button"
			class="text-muted-foreground hover:text-foreground flex w-full items-center justify-between"
			onclick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				open = !open;
			}}
		>
			<span>{entries.length} subsidi aktif</span>
			{#if open}<ChevronUp class="size-3" />{:else}<ChevronDown class="size-3" />{/if}
		</button>
		{#if open}
			<ul class="mt-2 space-y-1">
				{#each entries as e (e.id)}
					<li class="flex items-center justify-between gap-2">
						<span class="truncate">
							{e.direction === 'in' ? '↓' : '↑'} {formatCentsAsCurrency(e.amountCents, 'IDR')}
							{e.direction === 'in' ? 'dari' : 'ke'} {e.counterpartName}
						</span>
						<span class="flex shrink-0 items-center gap-1">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								class="size-7"
								onclick={(ev) => {
									ev.preventDefault();
									ev.stopPropagation();
									onEdit(e.id);
								}}
							>
								<Pencil class="size-3" />
							</Button>
							<form
								method="POST"
								action="/budgets?/deleteSubsidy"
								use:enhance={() =>
									async ({ result }) => {
										if (result.type === 'success') {
											await invalidateAll();
											notify.success('Subsidi dihapus');
										} else if (result.type === 'failure') {
											const message = (result.data as { message?: string } | undefined)?.message;
											notify.error(message ?? 'Hapus gagal');
										}
									}}
								onclick={(ev) => ev.stopPropagation()}
							>
								<input type="hidden" name="id" value={e.id} />
								<Button type="submit" variant="ghost" size="icon" class="size-7 text-destructive">
									<Trash2 class="size-3" />
								</Button>
							</form>
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}
