<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Table from '$lib/components/ui/table';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Plus, MoreHorizontal, Archive, ArchiveRestore, Pencil, Tag } from 'lucide-svelte';
	import { notify } from '$lib/utils/toast.js';
	import EmptyState from '$lib/components/empty-state.svelte';
	import SegmentedControl from '$lib/components/ui/segmented-control.svelte';

	let { data, form } = $props();

	type CategoryRow = (typeof data.categories)[number];

	let createOpen = $state(false);
	let editOpen = $state(false);
	let editTarget = $state<CategoryRow | null>(null);
	let createPending = $state(false);
	let editPending = $state(false);

	const kindSegmentOptions = [
		{ value: 'income', label: 'Income' },
		{ value: 'expense', label: 'Expense' }
	];

	const PRESET_SWATCHES = [
		'#10b981',
		'#3b82f6',
		'#f59e0b',
		'#f43f5e',
		'#8b5cf6',
		'#ec4899',
		'#14b8a6',
		'#f97316'
	];

	let createKind = $state<'income' | 'expense'>('expense');
	let createColor = $state('');
	let createCustomColor = $state(false);

	let editKind = $state<'income' | 'expense'>('expense');
	let editColor = $state('');
	let editCustomColor = $state(false);

	$effect(() => {
		if (editTarget) {
			editKind = editTarget.kind;
			editColor = editTarget.color ?? '';
			editCustomColor = !!editColor && !PRESET_SWATCHES.includes(editColor);
		}
	});

	const openEdit = (c: CategoryRow) => {
		editTarget = c;
		editOpen = true;
	};
</script>

<svelte:head><title>Categories — Mavlo</title></svelte:head>

<div class="flex items-center justify-between mb-6">
	<div>
		<h1 class="text-2xl font-semibold">Categories</h1>
		<p class="text-sm text-muted-foreground mt-1">
			{data.includeArchived ? 'Showing archived categories.' : 'Active categories.'}
		</p>
	</div>
	<div class="flex items-center gap-2">
		<Button variant="outline" href={data.includeArchived ? '/categories' : '/categories?archived=1'}>
			{data.includeArchived ? 'Hide archived' : 'Show archived'}
		</Button>
		<Button onclick={() => (createOpen = true)}>
			<Plus class="size-4 mr-1" /> New category
		</Button>
	</div>
</div>

{#if form?.message}
	<p class="mb-4 text-sm text-destructive">{form.message}</p>
{/if}

{#snippet rowMenu(category: CategoryRow)}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="icon" class="size-11 md:size-8 shrink-0">
					<MoreHorizontal class="size-4" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Item onclick={() => openEdit(category)}>
				<Pencil class="size-4 mr-2" /> Edit
			</DropdownMenu.Item>
			<form method="POST" action="?/{category.archived ? 'unarchive' : 'archive'}" use:enhance={() => async ({ update, result }) => {
				await update();
				if (result.type === 'success') {
					notify.success(category.archived ? 'Category restored' : 'Category archived');
				} else if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					notify.error(message ?? 'Could not save category');
				}
			}}>
				<input type="hidden" name="id" value={category.id} />
				<DropdownMenu.Item>
					{#snippet child({ props })}
						<button {...props} type="submit" class="w-full text-left">
							{#if category.archived}
								<ArchiveRestore class="size-4 mr-2" /> Unarchive
							{:else}
								<Archive class="size-4 mr-2" /> Archive
							{/if}
						</button>
					{/snippet}
				</DropdownMenu.Item>
			</form>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/snippet}

<div class="hidden md:block">
	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Name</Table.Head>
						<Table.Head>Kind</Table.Head>
						<Table.Head>Color</Table.Head>
						<Table.Head class="w-12"></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.categories as category (category.id)}
						<Table.Row class={category.archived ? 'opacity-60' : ''}>
							<Table.Cell class="font-medium">{category.name}</Table.Cell>
							<Table.Cell class="capitalize">{category.kind}</Table.Cell>
							<Table.Cell>
								{#if category.color}
									<div class="flex items-center gap-2">
										<span
											class="inline-block size-4 rounded border"
											style="background: {category.color}"
										></span>
										<span class="font-mono text-xs">{category.color}</span>
									</div>
								{:else}
									<span class="text-muted-foreground text-xs">—</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{@render rowMenu(category)}
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={4} class="p-0">
								<EmptyState icon={Tag} title="No categories yet" description="Add your first category to classify income and expenses.">
									<Button onclick={() => (createOpen = true)}>Add category</Button>
								</EmptyState>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>

<ul class="md:hidden space-y-2">
	{#each data.categories as category (category.id)}
		<li class="rounded-lg border bg-card p-3 flex items-start gap-3 {category.archived ? 'opacity-60' : ''}">
			<div class="flex-1 min-w-0">
				<div class="font-medium truncate">{category.name}</div>
				<div class="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
					<span class="capitalize">{category.kind}</span>
					{#if category.color}
						<span class="flex items-center gap-1">
							<span class="inline-block size-3 rounded border" style="background: {category.color}"></span>
							<span class="font-mono">{category.color}</span>
						</span>
					{/if}
				</div>
			</div>
			{@render rowMenu(category)}
		</li>
	{:else}
		<li>
			<EmptyState icon={Tag} title="No categories yet" description="Add your first category to classify income and expenses.">
				<Button onclick={() => (createOpen = true)}>Add category</Button>
			</EmptyState>
		</li>
	{/each}
</ul>

{#snippet createForm()}
	<form
		method="POST"
		action="?/create"
		use:enhance={() => {
			createPending = true;
			return async ({ update, result }) => {
				await update();
				createPending = false;
				if (result.type === 'success') {
					createOpen = false;
					notify.success('Category created');
				} else if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					notify.error(message ?? 'Could not create category');
				}
			};
		}}
		class="space-y-4 p-4"
	>
		<div class="space-y-1">
			<Label for="cat-c-name">Name</Label>
			<Input id="cat-c-name" name="name" required maxlength={60} />
		</div>
		<div class="space-y-1">
			<Label>Kind</Label>
			<SegmentedControl options={kindSegmentOptions} bind:value={createKind} name="kind" />
		</div>
		<div class="space-y-2">
			<Label>Color</Label>
			<div class="grid grid-cols-8 gap-2">
				{#each PRESET_SWATCHES as swatch (swatch)}
					<button
						type="button"
						onclick={() => { createColor = swatch; createCustomColor = false; }}
						class="size-8 rounded-lg border transition-shadow {createColor === swatch ? 'ring-2 ring-foreground' : ''}"
						style="background-color: {swatch}"
						aria-label={swatch}
					></button>
				{/each}
			</div>
			<button
				type="button"
				onclick={() => (createCustomColor = !createCustomColor)}
				class="text-xs text-muted-foreground underline"
			>
				{createCustomColor ? 'Hide custom' : '+ Custom hex'}
			</button>
			{#if createCustomColor}
				<div class="flex items-center gap-2">
					<Input bind:value={createColor} placeholder="#10b981" maxlength={7} />
					<span class="size-6 rounded border" style="background-color: {createColor || 'transparent'}"></span>
				</div>
			{/if}
			<input type="hidden" name="color" value={createColor} />
		</div>
		<div class="space-y-1">
			<Label for="cat-c-icon">Icon</Label>
			<Input id="cat-c-icon" name="icon" placeholder="utensils" />
		</div>
		<div class="flex justify-end gap-2">
			<Button type="button" variant="outline" onclick={() => (createOpen = false)}>Cancel</Button>
			<SubmitButton pending={createPending}>Create</SubmitButton>
		</div>
	</form>
{/snippet}

<div class="md:hidden">
	<Sheet.Root bind:open={createOpen}>
		<Sheet.Content side="bottom" class="max-h-[90dvh] flex flex-col p-0">
			<Sheet.Header class="text-left p-4 pb-2"><Sheet.Title>New category</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">{@render createForm()}</div>
		</Sheet.Content>
	</Sheet.Root>
</div>
<div class="hidden md:block">
	<Dialog.Root bind:open={createOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>New category</Dialog.Title></Dialog.Header>
			{@render createForm()}
		</Dialog.Content>
	</Dialog.Root>
</div>

{#snippet editForm(target: CategoryRow)}
	<form
		method="POST"
		action="?/update"
		use:enhance={() => {
			editPending = true;
			return async ({ update, result }) => {
				await update();
				editPending = false;
				if (result.type === 'success') {
					editOpen = false;
					notify.success('Category updated');
				} else if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					notify.error(message ?? 'Could not save category');
				}
			};
		}}
		class="space-y-4 p-4"
	>
		<input type="hidden" name="id" value={target.id} />
		<div class="space-y-1">
			<Label for="cat-e-name">Name</Label>
			<Input id="cat-e-name" name="name" required maxlength={60} value={target.name} />
		</div>
		<div class="space-y-1">
			<Label>Kind</Label>
			<SegmentedControl options={kindSegmentOptions} bind:value={editKind} name="kind" />
		</div>
		<div class="space-y-2">
			<Label>Color</Label>
			<div class="grid grid-cols-8 gap-2">
				{#each PRESET_SWATCHES as swatch (swatch)}
					<button
						type="button"
						onclick={() => { editColor = swatch; editCustomColor = false; }}
						class="size-8 rounded-lg border transition-shadow {editColor === swatch ? 'ring-2 ring-foreground' : ''}"
						style="background-color: {swatch}"
						aria-label={swatch}
					></button>
				{/each}
			</div>
			<button
				type="button"
				onclick={() => (editCustomColor = !editCustomColor)}
				class="text-xs text-muted-foreground underline"
			>
				{editCustomColor ? 'Hide custom' : '+ Custom hex'}
			</button>
			{#if editCustomColor}
				<div class="flex items-center gap-2">
					<Input bind:value={editColor} placeholder="#10b981" maxlength={7} />
					<span class="size-6 rounded border" style="background-color: {editColor || 'transparent'}"></span>
				</div>
			{/if}
			<input type="hidden" name="color" value={editColor} />
		</div>
		<div class="space-y-1">
			<Label for="cat-e-icon">Icon</Label>
			<Input id="cat-e-icon" name="icon" value={target.icon ?? ''} placeholder="utensils" />
		</div>
		<div class="flex justify-end gap-2">
			<Button type="button" variant="outline" onclick={() => (editOpen = false)}>Cancel</Button>
			<SubmitButton pending={editPending}>Save</SubmitButton>
		</div>
	</form>
{/snippet}

<div class="md:hidden">
	<Sheet.Root bind:open={editOpen}>
		<Sheet.Content side="bottom" class="max-h-[90dvh] flex flex-col p-0">
			<Sheet.Header class="text-left p-4 pb-2"><Sheet.Title>Edit category</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">
				{#if editTarget}{@render editForm(editTarget)}{/if}
			</div>
		</Sheet.Content>
	</Sheet.Root>
</div>
<div class="hidden md:block">
	<Dialog.Root bind:open={editOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>Edit category</Dialog.Title></Dialog.Header>
			{#if editTarget}{@render editForm(editTarget)}{/if}
		</Dialog.Content>
	</Dialog.Root>
</div>
