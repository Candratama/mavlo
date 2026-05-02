<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import {
		Plus,
		MoreHorizontal,
		Archive,
		ArchiveRestore,
		Pencil,
		Trash2,
		Tag,
		GripVertical
	} from 'lucide-svelte';
	import { dndzone } from 'svelte-dnd-action';
	import { notify } from '$lib/utils/toast.js';
	import EmptyState from '$lib/components/empty-state.svelte';
	import SegmentedControl from '$lib/components/ui/segmented-control.svelte';
	import { CATEGORY_ICONS, getIconByName } from '$lib/utils/category-icons.js';
	import { MediaQuery } from 'svelte/reactivity';
	import { page } from '$app/state';

	let { data, form } = $props();

	const isDesktop = new MediaQuery('(min-width: 768px)');

	const includeArchived = $derived(page.url.searchParams.get('archived') === '1');
	const cats = $derived(includeArchived ? data.allCategories : data.categories);

	type CategoryRow = (typeof data.allCategories)[number];

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

	let visibleCategories = $state<CategoryRow[]>(cats.filter((c) => c.kind === viewKind));
	let expenseCategories = $state<CategoryRow[]>(cats.filter((c) => c.kind === 'expense'));
	let incomeCategories = $state<CategoryRow[]>(cats.filter((c) => c.kind === 'income'));

	$effect(() => {
		visibleCategories = cats.filter((c) => c.kind === viewKind);
		expenseCategories = cats.filter((c) => c.kind === 'expense');
		incomeCategories = cats.filter((c) => c.kind === 'income');
	});

	async function persistOrder(ids: string[]) {
		const fd = new FormData();
		fd.set('ids', ids.join(','));
		const res = await fetch('?/reorder', { method: 'POST', body: fd });
		if (!res.ok) {
			notify.error('Could not save order');
		}
	}

	let dndDisabled = $state(true);
	function enableDrag() {
		dndDisabled = false;
	}
	function disableDrag() {
		dndDisabled = true;
	}
</script>

<svelte:head><title>Categories — Mavlo</title></svelte:head>

<div class="mb-6 flex items-center justify-between">
	<div>
		<h1 class="mavlo-headline text-2xl font-bold tracking-tight sm:text-3xl">Categories</h1>
	</div>
	<Button class="lift" onclick={() => (createOpen = true)}>
		<Plus class="mr-1 size-4" /> New category
	</Button>
</div>

{#if form?.message}
	<p class="text-destructive mb-4 text-sm">{form.message}</p>
{/if}

<div class="mb-4 md:hidden">
	<SegmentedControl options={viewKindOptions} bind:value={viewKind} ariaLabel="Category kind" />
</div>

{#snippet rowMenu(category: CategoryRow)}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="icon" class="size-11 shrink-0 md:size-8">
					<MoreHorizontal class="size-4" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Item onclick={() => openEdit(category)}>
				<Pencil class="mr-2 size-4" /> Edit
			</DropdownMenu.Item>
			<form
				method="POST"
				action="?/{category.archived ? 'unarchive' : 'archive'}"
				use:enhance={() =>
					async ({ result, update }) => {
						await update();
						if (result.type === 'success') {
							notify.success(category.archived ? 'Category restored' : 'Category archived');
						} else if (result.type === 'failure') {
							const message = (result.data as { message?: string } | undefined)?.message;
							notify.error(message ?? 'Could not save category');
						}
					}}
			>
				<input type="hidden" name="id" value={category.id} />
				<DropdownMenu.Item>
					{#snippet child({ props })}
						<button
							{...props}
							type="submit"
							class="hover:bg-accent/50 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
						>
							{#if category.archived}
								<ArchiveRestore class="size-4" /> Unarchive
							{:else}
								<Archive class="size-4" /> Archive
							{/if}
						</button>
					{/snippet}
				</DropdownMenu.Item>
			</form>
			<form
				method="POST"
				action="?/delete"
				use:enhance={() =>
					async ({ result, update }) => {
						await update();
						if (result.type === 'success') {
							notify.success('Category deleted');
						} else if (result.type === 'failure') {
							const message = (result.data as { message?: string } | undefined)?.message;
							notify.error(message ?? 'Could not delete category');
						}
					}}
				onsubmit={(e) => {
					if (
						!confirm(
							`Delete category "${category.name}"? This will also delete its budgets. Transactions keep their amount but lose the category.`
						)
					)
						e.preventDefault();
				}}
			>
				<input type="hidden" name="id" value={category.id} />
				<DropdownMenu.Item>
					{#snippet child({ props })}
						<button
							{...props}
							type="submit"
							class="text-destructive hover:bg-accent/50 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
						>
							<Trash2 class="size-4" /> Delete
						</button>
					{/snippet}
				</DropdownMenu.Item>
			</form>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/snippet}

{#snippet kindList(
	items: CategoryRow[],
	label: string,
	onConsider: (next: CategoryRow[]) => void,
	onFinalize: (next: CategoryRow[]) => void
)}
	<Card.Root>
		<Card.Header class="pb-2">
			<Card.Title class="text-base">{label}</Card.Title>
		</Card.Header>
		<Card.Content class="p-3">
			{#if items.length === 0}
				<EmptyState
					icon={Tag}
					title="No {label.toLowerCase()} categories"
					description="Add one to classify {label.toLowerCase()} transactions."
				>
					<Button onclick={() => (createOpen = true)}>Add category</Button>
				</EmptyState>
			{:else}
				<ul
					class="space-y-1.5"
					use:dndzone={{
						items,
						flipDurationMs: 150,
						dropTargetStyle: {},
						dragDisabled: dndDisabled
					}}
					onconsider={(e) => onConsider(e.detail.items as CategoryRow[])}
					onfinalize={(e) => {
						onFinalize(e.detail.items as CategoryRow[]);
						disableDrag();
					}}
				>
					{#each items as category (category.id)}
						{@const IconComp = getIconByName(category.icon)}
						<li
							class="hover:bg-accent/30 flex items-center gap-3 rounded-md p-2 {category.archived
								? 'opacity-60'
								: ''}"
						>
							<button
								type="button"
								tabindex="-1"
								aria-label="Drag to reorder"
								onpointerdown={enableDrag}
								ontouchstart={enableDrag}
								class="shrink-0 cursor-grab touch-none active:cursor-grabbing"
							>
								<GripVertical class="text-muted-foreground size-4" />
							</button>
							<div
								class="flex size-7 shrink-0 items-center justify-center rounded-md"
								style={category.color ? `background-color: ${category.color}20` : ''}
							>
								{#if IconComp}
									<IconComp
										class="size-4"
										style={category.color ? `color: ${category.color}` : ''}
									/>
								{:else}
									<Tag class="text-muted-foreground size-4" />
								{/if}
							</div>
							<span class="min-w-0 flex-1 truncate font-medium">{category.name}</span>
							{@render rowMenu(category)}
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>
{/snippet}

<div class="hidden gap-6 md:grid md:grid-cols-2">
	{@render kindList(
		expenseCategories,
		'Expense',
		(next) => (expenseCategories = next),
		(next) => {
			expenseCategories = next;
			persistOrder(next.map((c) => c.id));
		}
	)}
	{@render kindList(
		incomeCategories,
		'Income',
		(next) => (incomeCategories = next),
		(next) => {
			incomeCategories = next;
			persistOrder(next.map((c) => c.id));
		}
	)}
</div>

{#if visibleCategories.length > 0}
	<ul
		class="space-y-2 md:hidden"
		use:dndzone={{
			items: visibleCategories,
			flipDurationMs: 150,
			dropTargetStyle: {},
			dragDisabled: dndDisabled
		}}
		onconsider={(e) => (visibleCategories = e.detail.items)}
		onfinalize={(e) => {
			visibleCategories = e.detail.items;
			persistOrder(visibleCategories.map((c) => c.id));
			disableDrag();
		}}
	>
		{#each visibleCategories as category (category.id)}
			{@const IconComp = getIconByName(category.icon)}
			<li
				class="bg-card flex items-center gap-3 rounded-lg border p-3 {category.archived
					? 'opacity-60'
					: ''}"
			>
				<button
					type="button"
					tabindex="-1"
					aria-label="Drag to reorder"
					onpointerdown={enableDrag}
					ontouchstart={enableDrag}
					class="shrink-0 cursor-grab touch-none active:cursor-grabbing"
				>
					<GripVertical class="text-muted-foreground size-4" />
				</button>
				<div class="flex min-w-0 flex-1 items-center gap-3">
					<div
						class="flex size-9 shrink-0 items-center justify-center rounded-md"
						style={category.color ? `background-color: ${category.color}20` : ''}
					>
						{#if IconComp}
							<IconComp class="size-4" style={category.color ? `color: ${category.color}` : ''} />
						{:else}
							<Tag class="text-muted-foreground size-4" />
						{/if}
					</div>
					<div class="min-w-0 flex-1">
						<div class="truncate font-medium">{category.name}</div>
						<div class="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
							<span class="capitalize">{category.kind}</span>
						</div>
					</div>
					{@render rowMenu(category)}
				</div>
			</li>
		{/each}
	</ul>
{:else}
	<ul class="space-y-2 md:hidden">
		<li>
			<EmptyState
				icon={Tag}
				title="No categories yet"
				description="Add your first category to classify income and expenses."
			>
				<Button onclick={() => (createOpen = true)}>Add category</Button>
			</EmptyState>
		</li>
	</ul>
{/if}

<div class="mt-6 flex justify-center">
	<Button
		variant="ghost"
		size="sm"
		href={includeArchived ? '/categories' : '/categories?archived=1'}
	>
		{includeArchived ? 'Hide archived' : 'Show archived'}
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
			return async ({ result, update }) => {
				createPending = false;
				await update();
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
			<div class="flex items-center justify-between">
				<Label>Color</Label>
				<span
					class="size-5 rounded border"
					style="background-color: {createColor || 'transparent'}"
					aria-hidden="true"
				></span>
			</div>
			<div class="grid grid-cols-8 gap-2">
				{#each PRESET_SWATCHES as swatch (swatch)}
					<button
						type="button"
						onclick={() => {
							createColor = swatch;
							createCustomColor = false;
						}}
						aria-pressed={createColor === swatch}
						aria-label="Color {swatch}"
						style="background-color: {swatch}; touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
						class="size-10 cursor-pointer rounded-lg outline-none {createColor === swatch
							? 'ring-foreground ring-offset-background ring-2 ring-offset-2'
							: ''}"
					>
						<span class="sr-only">{swatch}</span>
					</button>
				{/each}
			</div>
			<button
				type="button"
				onclick={() => (createCustomColor = !createCustomColor)}
				class="text-muted-foreground text-xs underline"
			>
				{createCustomColor ? 'Hide custom' : '+ Custom hex'}
			</button>
			{#if createCustomColor}
				<div class="flex items-center gap-2">
					<Input bind:value={createColor} placeholder="#10b981" maxlength={7} />
					<span
						class="size-6 rounded border"
						style="background-color: {createColor || 'transparent'}"
					></span>
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
						class="text-muted-foreground flex size-9 items-center justify-center rounded-lg border transition-shadow {createIcon ===
						''
							? 'ring-foreground ring-2'
							: ''}"
						aria-label="No icon"
					>
						<span class="text-xs">—</span>
					</button>
					{#each CATEGORY_ICONS as ico (ico.name)}
						<button
							type="button"
							onclick={() => (createIcon = ico.name)}
							class="flex size-9 items-center justify-center rounded-lg border transition-shadow {createIcon ===
							ico.name
								? 'ring-foreground bg-accent/30 ring-2'
								: ''}"
							aria-label={ico.label}
							title={ico.label}
						>
							<ico.icon class="size-4" />
						</button>
					{/each}
				</div>
			</div>
			<input
				type="text"
				name="icon"
				bind:value={createIcon}
				class="sr-only"
				tabindex="-1"
				aria-hidden="true"
			/>
		</div>
		<div class="flex gap-2 pt-2">
			<Button
				type="button"
				variant="outline"
				onclick={() => (createOpen = false)}
				class="h-12 flex-1 rounded-full text-base font-semibold md:h-10 md:text-sm"
			>
				Cancel
			</Button>
			<SubmitButton
				pending={createPending}
				class="h-12 flex-1 rounded-full !bg-white text-base font-semibold !text-neutral-900 hover:!bg-white/90 md:h-10 md:text-sm"
			>
				Create
			</SubmitButton>
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
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left"><Sheet.Title>New category</Sheet.Title></Sheet.Header
			>
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
			return async ({ result, update }) => {
				editPending = false;
				await update();
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
			<div class="flex items-center justify-between">
				<Label>Color</Label>
				<span
					class="size-5 rounded border"
					style="background-color: {editColor || 'transparent'}"
					aria-hidden="true"
				></span>
			</div>
			<div class="grid grid-cols-8 gap-2">
				{#each PRESET_SWATCHES as swatch (swatch)}
					<button
						type="button"
						onclick={() => {
							editColor = swatch;
							editCustomColor = false;
						}}
						aria-pressed={editColor === swatch}
						aria-label="Color {swatch}"
						style="background-color: {swatch}; touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
						class="size-10 cursor-pointer rounded-lg outline-none {editColor === swatch
							? 'ring-foreground ring-offset-background ring-2 ring-offset-2'
							: ''}"
					>
						<span class="sr-only">{swatch}</span>
					</button>
				{/each}
			</div>
			<button
				type="button"
				onclick={() => (editCustomColor = !editCustomColor)}
				class="text-muted-foreground text-xs underline"
			>
				{editCustomColor ? 'Hide custom' : '+ Custom hex'}
			</button>
			{#if editCustomColor}
				<div class="flex items-center gap-2">
					<Input bind:value={editColor} placeholder="#10b981" maxlength={7} />
					<span class="size-6 rounded border" style="background-color: {editColor || 'transparent'}"
					></span>
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
						class="text-muted-foreground flex size-9 items-center justify-center rounded-lg border transition-shadow {editIcon ===
						''
							? 'ring-foreground ring-2'
							: ''}"
						aria-label="No icon"
					>
						<span class="text-xs">—</span>
					</button>
					{#each CATEGORY_ICONS as ico (ico.name)}
						<button
							type="button"
							onclick={() => (editIcon = ico.name)}
							class="flex size-9 items-center justify-center rounded-lg border transition-shadow {editIcon ===
							ico.name
								? 'ring-foreground bg-accent/30 ring-2'
								: ''}"
							aria-label={ico.label}
							title={ico.label}
						>
							<ico.icon class="size-4" />
						</button>
					{/each}
				</div>
			</div>
			<input
				type="text"
				name="icon"
				bind:value={editIcon}
				class="sr-only"
				tabindex="-1"
				aria-hidden="true"
			/>
		</div>
		<div class="flex gap-2 pt-2">
			<Button
				type="button"
				variant="outline"
				onclick={() => (editOpen = false)}
				class="h-12 flex-1 rounded-full text-base font-semibold md:h-10 md:text-sm"
			>
				Cancel
			</Button>
			<SubmitButton
				pending={editPending}
				class="h-12 flex-1 rounded-full !bg-white text-base font-semibold !text-neutral-900 hover:!bg-white/90 md:h-10 md:text-sm"
			>
				Save
			</SubmitButton>
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
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left"
				><Sheet.Title>Edit category</Sheet.Title></Sheet.Header
			>
			<div class="flex-1 overflow-y-auto">
				{#if editTarget}{@render editForm(editTarget)}{/if}
			</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}
