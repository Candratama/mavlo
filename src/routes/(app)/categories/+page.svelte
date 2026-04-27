<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Table from '$lib/components/ui/table';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Plus, MoreHorizontal, Archive, ArchiveRestore, Pencil, Trash2, Tag } from 'lucide-svelte';
	import { notify } from '$lib/utils/toast.js';
	import EmptyState from '$lib/components/empty-state.svelte';
	import SegmentedControl from '$lib/components/ui/segmented-control.svelte';
	import { CATEGORY_ICONS, getIconByName } from '$lib/utils/category-icons.js';
	import { MediaQuery } from 'svelte/reactivity';

	let { data, form } = $props();

	const isDesktop = new MediaQuery('(min-width: 768px)');

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
	let createIcon = $state('');

	let editKind = $state<'income' | 'expense'>('expense');
	let editColor = $state('');
	let editCustomColor = $state(false);
	let editIcon = $state('');

	$effect(() => {
		if (editTarget) {
			const t = editTarget;
			const c = t.color ?? '';
			editKind = t.kind;
			editColor = c;
			editCustomColor = !!c && !PRESET_SWATCHES.includes(c);
			editIcon = t.icon ?? '';
		}
	});

	const openEdit = (c: CategoryRow) => {
		editTarget = c;
		editOpen = true;
	};

	let viewKind = $state<'expense' | 'income'>('expense');

	const viewKindOptions = [
		{ value: 'expense', label: 'Expense' },
		{ value: 'income', label: 'Income' }
	];

	const visibleCategories = $derived(data.categories.filter((c) => c.kind === viewKind));
</script>

<svelte:head><title>Categories — Mavlo</title></svelte:head>

<div class="flex items-center justify-between mb-6">
	<div>
		<h1 class="text-xl sm:text-2xl font-semibold tracking-tight">Categories</h1>
	</div>
	<Button onclick={() => (createOpen = true)}>
		<Plus class="size-4 mr-1" /> New category
	</Button>
</div>

{#if form?.message}
	<p class="mb-4 text-sm text-destructive">{form.message}</p>
{/if}

<div class="mb-4">
	<SegmentedControl options={viewKindOptions} bind:value={viewKind} ariaLabel="Category kind" />
</div>

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
			<form method="POST" action="?/{category.archived ? 'unarchive' : 'archive'}" use:enhance={() => async ({ result }) => {
				await goto(page.url.pathname + page.url.search, {
					invalidateAll: true,
					replaceState: true,
					keepFocus: true,
					noScroll: true
				});
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
						<button {...props} type="submit" class="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded-sm hover:bg-accent/50">
							{#if category.archived}
								<ArchiveRestore class="size-4" /> Unarchive
							{:else}
								<Archive class="size-4" /> Archive
							{/if}
						</button>
					{/snippet}
				</DropdownMenu.Item>
			</form>
			<form method="POST" action="?/delete" use:enhance={() => async ({ result }) => {
				await goto(page.url.pathname + page.url.search, {
					invalidateAll: true,
					replaceState: true,
					keepFocus: true,
					noScroll: true
				});
				if (result.type === 'success') {
					notify.success('Category deleted');
				} else if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					notify.error(message ?? 'Could not delete category');
				}
			}} onsubmit={(e) => {
				if (!confirm(`Delete category "${category.name}"? This will also delete its budgets. Transactions keep their amount but lose the category.`)) e.preventDefault();
			}}>
				<input type="hidden" name="id" value={category.id} />
				<DropdownMenu.Item>
					{#snippet child({ props })}
						<button {...props} type="submit" class="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left text-destructive rounded-sm hover:bg-accent/50">
							<Trash2 class="size-4" /> Delete
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
						<Table.Head class="w-10"></Table.Head>
						<Table.Head>Name</Table.Head>
						<Table.Head>Kind</Table.Head>
						<Table.Head>Color</Table.Head>
						<Table.Head class="text-right">Usage</Table.Head>
						<Table.Head class="w-12"></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each visibleCategories as category (category.id)}
						{@const IconComp = getIconByName(category.icon)}
						<Table.Row class={category.archived ? 'opacity-60' : ''}>
							<Table.Cell>
								<div class="size-7 rounded-md border flex items-center justify-center" style={category.color ? `background-color: ${category.color}20; border-color: ${category.color}` : ''}>
									{#if IconComp}
										<IconComp class="size-4" style={category.color ? `color: ${category.color}` : ''} />
									{:else}
										<Tag class="size-4 text-muted-foreground" />
									{/if}
								</div>
							</Table.Cell>
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
							<Table.Cell class="text-right tabular-nums text-muted-foreground">
								{data.countByCategory[category.id] ?? 0}
							</Table.Cell>
							<Table.Cell>
								{@render rowMenu(category)}
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={6} class="p-0">
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
	{#each visibleCategories as category (category.id)}
		{@const IconComp = getIconByName(category.icon)}
		<li class="rounded-lg border bg-card p-3 flex items-start gap-3 {category.archived ? 'opacity-60' : ''}">
			<div class="size-9 shrink-0 rounded-md border flex items-center justify-center" style={category.color ? `background-color: ${category.color}20; border-color: ${category.color}` : ''}>
				{#if IconComp}
					<IconComp class="size-4" style={category.color ? `color: ${category.color}` : ''} />
				{:else}
					<Tag class="size-4 text-muted-foreground" />
				{/if}
			</div>
			<div class="flex-1 min-w-0">
				<div class="font-medium truncate">{category.name}</div>
				<div class="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
					<span class="capitalize">{category.kind}</span>
				</div>
				<span class="text-xs text-muted-foreground tabular-nums">
					{data.countByCategory[category.id] ?? 0} txn
				</span>
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

<div class="mt-6 flex justify-center">
	<Button variant="ghost" size="sm" href={data.includeArchived ? '/categories' : '/categories?archived=1'}>
		{data.includeArchived ? 'Hide archived' : 'Show archived'}
	</Button>
</div>

{#snippet createForm()}
	<form
		method="POST"
		action="?/create"
		use:enhance={({ formData }) => {
			formData.set('kind', createKind);
			formData.set('color', createColor);
			formData.set('icon', createIcon);
			createPending = true;
			return async ({ result }) => {
				createPending = false;
				if (result.type === 'success') {
					createOpen = false;
					notify.success('Category created');
					window.location.reload();
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
			<div class="flex items-center justify-between">
				<Label>Color</Label>
				<span class="size-5 rounded border" style="background-color: {createColor || 'transparent'}" aria-hidden="true"></span>
			</div>
			<div class="grid grid-cols-8 gap-2">
				{#each PRESET_SWATCHES as swatch (swatch)}
					<button
						type="button"
						onclick={() => { createColor = swatch; createCustomColor = false; }}
						aria-pressed={createColor === swatch}
						aria-label="Color {swatch}"
						style="background-color: {swatch}; touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
						class="size-10 rounded-lg cursor-pointer outline-none {createColor === swatch ? 'ring-2 ring-offset-2 ring-foreground ring-offset-background' : ''}"
					>
						<span class="sr-only">{swatch}</span>
					</button>
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
		</div>
		<div class="space-y-2">
			<Label>Icon</Label>
			<div class="max-h-[17rem] overflow-y-auto rounded-lg border p-2">
				<div class="grid grid-cols-8 gap-2">
					<button
						type="button"
						onclick={() => (createIcon = '')}
						class="size-9 rounded-lg border flex items-center justify-center text-muted-foreground transition-shadow {createIcon === '' ? 'ring-2 ring-foreground' : ''}"
						aria-label="No icon"
					>
						<span class="text-xs">—</span>
					</button>
					{#each CATEGORY_ICONS as ico (ico.name)}
						<button
							type="button"
							onclick={() => (createIcon = ico.name)}
							class="size-9 rounded-lg border flex items-center justify-center transition-shadow {createIcon === ico.name ? 'ring-2 ring-foreground bg-accent/30' : ''}"
							aria-label={ico.label}
							title={ico.label}
						>
							<ico.icon class="size-4" />
						</button>
					{/each}
				</div>
			</div>
			<input type="text" name="icon" bind:value={createIcon} class="sr-only" tabindex="-1" aria-hidden="true" />
		</div>
		<div class="flex justify-end gap-2">
			<Button type="button" variant="outline" onclick={() => (createOpen = false)}>Cancel</Button>
			<SubmitButton pending={createPending}>Create</SubmitButton>
		</div>
	</form>
{/snippet}

{#if isDesktop.current}
	<Dialog.Root bind:open={createOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>New category</Dialog.Title></Dialog.Header>
			{@render createForm()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open={createOpen}>
		<Sheet.Content side="bottom" class="max-h-[90dvh] flex flex-col p-0">
			<Sheet.Header class="text-left p-4 pb-2"><Sheet.Title>New category</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">{@render createForm()}</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}

{#snippet editForm(target: CategoryRow)}
	<form
		method="POST"
		action="?/update"
		use:enhance={({ formData }) => {
			formData.set('kind', editKind);
			formData.set('color', editColor);
			formData.set('icon', editIcon);
			editPending = true;
			return async ({ result }) => {
				editPending = false;
				if (result.type === 'success') {
					editOpen = false;
					notify.success('Category updated');
					window.location.reload();
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
			<div class="flex items-center justify-between">
				<Label>Color</Label>
				<span class="size-5 rounded border" style="background-color: {editColor || 'transparent'}" aria-hidden="true"></span>
			</div>
			<div class="grid grid-cols-8 gap-2">
				{#each PRESET_SWATCHES as swatch (swatch)}
					<button
						type="button"
						onclick={() => { editColor = swatch; editCustomColor = false; }}
						aria-pressed={editColor === swatch}
						aria-label="Color {swatch}"
						style="background-color: {swatch}; touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
						class="size-10 rounded-lg cursor-pointer outline-none {editColor === swatch ? 'ring-2 ring-offset-2 ring-foreground ring-offset-background' : ''}"
					>
						<span class="sr-only">{swatch}</span>
					</button>
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
		</div>
		<div class="space-y-2">
			<Label>Icon</Label>
			<div class="max-h-[17rem] overflow-y-auto rounded-lg border p-2">
				<div class="grid grid-cols-8 gap-2">
					<button
						type="button"
						onclick={() => (editIcon = '')}
						class="size-9 rounded-lg border flex items-center justify-center text-muted-foreground transition-shadow {editIcon === '' ? 'ring-2 ring-foreground' : ''}"
						aria-label="No icon"
					>
						<span class="text-xs">—</span>
					</button>
					{#each CATEGORY_ICONS as ico (ico.name)}
						<button
							type="button"
							onclick={() => (editIcon = ico.name)}
							class="size-9 rounded-lg border flex items-center justify-center transition-shadow {editIcon === ico.name ? 'ring-2 ring-foreground bg-accent/30' : ''}"
							aria-label={ico.label}
							title={ico.label}
						>
							<ico.icon class="size-4" />
						</button>
					{/each}
				</div>
			</div>
			<input type="text" name="icon" bind:value={editIcon} class="sr-only" tabindex="-1" aria-hidden="true" />
		</div>
		<div class="flex justify-end gap-2">
			<Button type="button" variant="outline" onclick={() => (editOpen = false)}>Cancel</Button>
			<SubmitButton pending={editPending}>Save</SubmitButton>
		</div>
	</form>
{/snippet}

{#if isDesktop.current}
	<Dialog.Root bind:open={editOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>Edit category</Dialog.Title></Dialog.Header>
			{#if editTarget}{@render editForm(editTarget)}{/if}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open={editOpen}>
		<Sheet.Content side="bottom" class="max-h-[90dvh] flex flex-col p-0">
			<Sheet.Header class="text-left p-4 pb-2"><Sheet.Title>Edit category</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">
				{#if editTarget}{@render editForm(editTarget)}{/if}
			</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}
