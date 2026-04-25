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

	let { data, form } = $props();

	type AccountRow = (typeof data.accounts)[number];

	let createOpen = $state(false);
	let editOpen = $state(false);
	let editTarget = $state<AccountRow | null>(null);

	const accountTypeOptions = [
		{ value: 'cash', label: 'Cash' },
		{ value: 'bank', label: 'Bank' },
		{ value: 'credit', label: 'Credit' },
		{ value: 'wallet', label: 'Wallet' },
		{ value: 'other', label: 'Other' }
	] as const;

	const formatBalance = (cents: number, currency: string) =>
		new Intl.NumberFormat('id-ID', { style: 'currency', currency, minimumFractionDigits: 0 }).format(
			cents / 100
		);

	const openEdit = (a: AccountRow) => {
		editTarget = a;
		editOpen = true;
	};
</script>

<svelte:head><title>Accounts — Mavlo</title></svelte:head>

<div class="flex items-center justify-between mb-6">
	<div>
		<h1 class="text-2xl font-semibold">Accounts</h1>
		<p class="text-sm text-muted-foreground mt-1">
			{data.includeArchived ? 'Showing archived accounts.' : 'Active accounts.'}
		</p>
	</div>
	<div class="flex items-center gap-2">
		<Button variant="outline" href={data.includeArchived ? '/accounts' : '/accounts?archived=1'}>
			{data.includeArchived ? 'Hide archived' : 'Show archived'}
		</Button>
		<Button onclick={() => (createOpen = true)}>
			<Plus class="size-4 mr-1" /> New account
		</Button>
	</div>
</div>

{#if form?.message}
	<p class="mb-4 text-sm text-destructive">{form.message}</p>
{/if}

<Card.Root>
	<Card.Content class="p-0">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Name</Table.Head>
					<Table.Head>Type</Table.Head>
					<Table.Head>Currency</Table.Head>
					<Table.Head class="text-right">Initial balance</Table.Head>
					<Table.Head class="w-12"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.accounts as account (account.id)}
					<Table.Row class={account.archived ? 'opacity-60' : ''}>
						<Table.Cell class="font-medium">{account.name}</Table.Cell>
						<Table.Cell class="capitalize">{account.type}</Table.Cell>
						<Table.Cell>{account.currency}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">
							{formatBalance(account.initialBalanceCents, account.currency)}
						</Table.Cell>
						<Table.Cell>
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button {...props} variant="ghost" size="icon" class="size-8">
											<MoreHorizontal class="size-4" />
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end">
									<DropdownMenu.Item onclick={() => openEdit(account)}>
										<Pencil class="size-4 mr-2" /> Edit
									</DropdownMenu.Item>
									<form method="POST" action="?/{account.archived ? 'unarchive' : 'archive'}" use:enhance>
										<input type="hidden" name="id" value={account.id} />
										<DropdownMenu.Item>
											{#snippet child({ props })}
												<button {...props} type="submit" class="w-full text-left">
													{#if account.archived}
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
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={5} class="text-center text-muted-foreground py-12">
							No accounts yet.
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

<!-- Create dialog -->
<Dialog.Root bind:open={createOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>New account</Dialog.Title>
			<Dialog.Description>Add a new financial account to track.</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/create"
			use:enhance={() => async ({ update, result }) => {
				await update();
				if (result.type === 'success') createOpen = false;
			}}
			class="space-y-4"
		>
			<div class="space-y-1">
				<Label for="create-name">Name</Label>
				<Input id="create-name" name="name" required maxlength={80} />
			</div>
			<div class="space-y-1">
				<Label for="create-type">Type</Label>
				<select
					id="create-type"
					name="type"
					required
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
				>
					{#each accountTypeOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="create-currency">Currency</Label>
					<Input id="create-currency" name="currency" required maxlength={8} value="IDR" />
				</div>
				<div class="space-y-1">
					<Label for="create-balance">Initial balance (cents)</Label>
					<Input id="create-balance" name="initialBalanceCents" type="number" value="0" />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (createOpen = false)}>Cancel</Button>
				<Button type="submit">Create</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit dialog -->
<Dialog.Root bind:open={editOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Edit account</Dialog.Title>
		</Dialog.Header>
		{#if editTarget}
			<form
				method="POST"
				action="?/update"
				use:enhance={() => async ({ update, result }) => {
					await update();
					if (result.type === 'success') editOpen = false;
				}}
				class="space-y-4"
			>
				<input type="hidden" name="id" value={editTarget.id} />
				<div class="space-y-1">
					<Label for="edit-name">Name</Label>
					<Input id="edit-name" name="name" required maxlength={80} value={editTarget.name} />
				</div>
				<div class="space-y-1">
					<Label for="edit-type">Type</Label>
					<select
						id="edit-type"
						name="type"
						required
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						{#each accountTypeOptions as opt}
							<option value={opt.value} selected={opt.value === editTarget.type}>{opt.label}</option>
						{/each}
					</select>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="edit-currency">Currency</Label>
						<Input id="edit-currency" name="currency" required maxlength={8} value={editTarget.currency} />
					</div>
					<div class="space-y-1">
						<Label for="edit-balance">Initial balance (cents)</Label>
						<Input
							id="edit-balance"
							name="initialBalanceCents"
							type="number"
							value={editTarget.initialBalanceCents}
						/>
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
