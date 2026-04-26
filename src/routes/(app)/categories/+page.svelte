<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Table from '$lib/components/ui/table';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Plus, MoreHorizontal, Archive, ArchiveRestore, Pencil } from 'lucide-svelte';
	import { notify } from '$lib/utils/toast.js';

	let { data, form } = $props();

	type CategoryRow = (typeof data.categories)[number];

	let createOpen = $state(false);
	let editOpen = $state(false);
	let editTarget = $state<CategoryRow | null>(null);

	const kindOptions = [
		{ value: 'income', label: 'Income' },
		{ value: 'expense', label: 'Expense' }
	] as const;

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
							<Table.Cell colspan={4} class="text-center text-muted-foreground py-12">
								No categories yet.
								<Button variant="link" onclick={() => (createOpen = true)} class="px-1">
									Create the first one
								</Button>.
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
		<li class="text-center text-muted-foreground py-12">
			No categories yet.
			<Button variant="link" onclick={() => (createOpen = true)} class="px-1">
				Create the first one
			</Button>.
		</li>
	{/each}
</ul>

<Dialog.Root bind:open={createOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>New category</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/create"
			use:enhance={() => async ({ update, result }) => {
				await update();
				if (result.type === 'success') {
					createOpen = false;
					notify.success('Category created');
				} else if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					notify.error(message ?? 'Could not create category');
				}
			}}
			class="space-y-4"
		>
			<div class="space-y-1">
				<Label for="cat-c-name">Name</Label>
				<Input id="cat-c-name" name="name" required maxlength={60} />
			</div>
			<div class="space-y-1">
				<Label for="cat-c-kind">Kind</Label>
				<select
					id="cat-c-kind"
					name="kind"
					required
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
				>
					{#each kindOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="cat-c-color">Color (hex)</Label>
					<Input id="cat-c-color" name="color" placeholder="#10b981" />
				</div>
				<div class="space-y-1">
					<Label for="cat-c-icon">Icon</Label>
					<Input id="cat-c-icon" name="icon" placeholder="utensils" />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (createOpen = false)}>Cancel</Button>
				<Button type="submit">Create</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={editOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Edit category</Dialog.Title>
		</Dialog.Header>
		{#if editTarget}
			<form
				method="POST"
				action="?/update"
				use:enhance={() => async ({ update, result }) => {
					await update();
					if (result.type === 'success') {
						editOpen = false;
						notify.success('Category updated');
					} else if (result.type === 'failure') {
						const message = (result.data as { message?: string } | undefined)?.message;
						notify.error(message ?? 'Could not save category');
					}
				}}
				class="space-y-4"
			>
				<input type="hidden" name="id" value={editTarget.id} />
				<div class="space-y-1">
					<Label for="cat-e-name">Name</Label>
					<Input id="cat-e-name" name="name" required maxlength={60} value={editTarget.name} />
				</div>
				<div class="space-y-1">
					<Label for="cat-e-kind">Kind</Label>
					<select
						id="cat-e-kind"
						name="kind"
						required
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						{#each kindOptions as opt}
							<option value={opt.value} selected={opt.value === editTarget.kind}>{opt.label}</option>
						{/each}
					</select>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="cat-e-color">Color (hex)</Label>
						<Input id="cat-e-color" name="color" value={editTarget.color ?? ''} placeholder="#10b981" />
					</div>
					<div class="space-y-1">
						<Label for="cat-e-icon">Icon</Label>
						<Input id="cat-e-icon" name="icon" value={editTarget.icon ?? ''} placeholder="utensils" />
					</div>
				</div>
				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (editOpen = false)}>Cancel</Button>
					<Button type="submit">Save</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
