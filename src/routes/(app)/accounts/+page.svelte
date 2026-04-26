<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import MoneyInput from '$lib/components/forms/money-input.svelte';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import ResponsiveDialog from '$lib/components/forms/responsive-dialog.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Plus, MoreHorizontal, Archive, ArchiveRestore, Pencil, Wallet } from 'lucide-svelte';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { notify } from '$lib/utils/toast.js';
	import EmptyState from '$lib/components/empty-state.svelte';

	let { data, form } = $props();

	type AccountRow = (typeof data.accounts)[number];

	let createOpen = $state(false);
	let editOpen = $state(false);
	let editTarget = $state<AccountRow | null>(null);
	let createPending = $state(false);
	let editPending = $state(false);

	const accountTypeOptions = [
		{ value: 'cash', label: 'Cash' },
		{ value: 'bank', label: 'Bank' },
		{ value: 'credit', label: 'Credit' },
		{ value: 'wallet', label: 'Wallet' },
		{ value: 'other', label: 'Other' }
	] as const;

	const formatBalance = (cents: number, currency: string) => formatCentsAsCurrency(cents, currency);

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

{#snippet rowMenu(account: AccountRow)}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="icon" class="size-11 md:size-8 shrink-0">
					<MoreHorizontal class="size-4" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Item onclick={() => openEdit(account)}>
				<Pencil class="size-4 mr-2" /> Edit
			</DropdownMenu.Item>
			<form method="POST" action="?/{account.archived ? 'unarchive' : 'archive'}" use:enhance={() => async ({ update, result }) => {
				await update();
				if (result.type === 'success') {
					notify.success(account.archived ? 'Account restored' : 'Account archived');
				} else if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					notify.error(message ?? 'Could not save account');
				}
			}}>
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
{/snippet}

<div class="hidden md:block">
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
								{@render rowMenu(account)}
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={5} class="p-0">
								<EmptyState icon={Wallet} title="No accounts yet" description="Add your first account to start tracking your finances.">
									<Button onclick={() => (createOpen = true)}>Add account</Button>
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
	{#each data.accounts as account (account.id)}
		<li class="rounded-lg border bg-card p-3 flex items-start gap-3 {account.archived ? 'opacity-60' : ''}">
			<div class="flex-1 min-w-0">
				<div class="font-medium truncate">{account.name}</div>
				<div class="text-xs text-muted-foreground capitalize mt-0.5">
					{account.type} · {account.currency}
				</div>
				<div class="text-sm tabular-nums mt-1">
					{formatBalance(account.initialBalanceCents, account.currency)}
				</div>
			</div>
			{@render rowMenu(account)}
		</li>
	{:else}
		<li>
			<EmptyState icon={Wallet} title="No accounts yet" description="Add your first account to start tracking your finances.">
				<Button onclick={() => (createOpen = true)}>Add account</Button>
			</EmptyState>
		</li>
	{/each}
</ul>

<!-- Create dialog -->
<ResponsiveDialog
	bind:open={createOpen}
	title="New account"
	description="Add a new financial account to track."
>
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
					notify.success('Account created');
				} else if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					notify.error(message ?? 'Could not create account');
				}
			};
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
				<Label for="create-balance">Initial balance</Label>
				<MoneyInput id="create-balance" name="initialBalanceCents" min={0} />
			</div>
		</div>
		<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-2 pt-2">
			<Button type="button" variant="outline" onclick={() => (createOpen = false)}>Cancel</Button>
			<SubmitButton pending={createPending}>Create</SubmitButton>
		</div>
	</form>
</ResponsiveDialog>

<!-- Edit dialog -->
<ResponsiveDialog bind:open={editOpen} title="Edit account">
	{#if editTarget}
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
						notify.success('Account updated');
					} else if (result.type === 'failure') {
						const message = (result.data as { message?: string } | undefined)?.message;
						notify.error(message ?? 'Could not save account');
					}
				};
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
					<Label for="edit-balance">Initial balance</Label>
					<MoneyInput
						id="edit-balance"
						name="initialBalanceCents"
						min={0}
						value={editTarget.initialBalanceCents}
					/>
				</div>
			</div>
			<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-2 pt-2">
				<Button type="button" variant="outline" onclick={() => (editOpen = false)}>Cancel</Button>
				<SubmitButton pending={editPending}>Save</SubmitButton>
			</div>
		</form>
	{/if}
</ResponsiveDialog>
