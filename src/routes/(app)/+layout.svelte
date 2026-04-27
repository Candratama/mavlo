<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { setMode } from 'mode-watcher';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import Fab from '$lib/components/ui/fab.svelte';
	import AddTransactionSheet from '$lib/components/forms/add-transaction-sheet.svelte';
	import {
		getAddTransactionState,
		closeAddTransaction
	} from '$lib/stores/add-transaction.svelte.js';
	import { getLastUsed } from '$lib/utils/last-used.js';
	import { invalidateAll } from '$app/navigation';
	import {
		LayoutDashboard,
		ArrowLeftRight,
		Wallet,
		Tag,
		PiggyBank,
		Settings,
		LogOut
	} from 'lucide-svelte';

	let { children, data } = $props();

	$effect(() => {
		const t = data.preferences?.theme;
		untrack(() => {
			if (t === 'light' || t === 'dark' || t === 'system') setMode(t);
		});
	});

	const txState = getAddTransactionState();
	const defaultAccountId = $derived.by(() => {
		if (typeof window === 'undefined') return data.accounts?.[0]?.id;
		return getLastUsed().accountId ?? data.accounts?.[0]?.id;
	});

	const primaryNav = [
		{ href: '/dashboard', label: 'Home', icon: LayoutDashboard },
		{ href: '/transactions', label: 'Tx', icon: ArrowLeftRight },
		{ href: '/accounts', label: 'Accounts', icon: Wallet },
		{ href: '/budgets', label: 'Budgets', icon: PiggyBank },
		{ href: '/categories', label: 'Categories', icon: Tag }
	];

	const sidebarNav = [
		{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
		{ href: '/accounts', label: 'Accounts', icon: Wallet },
		{ href: '/categories', label: 'Categories', icon: Tag },
		{ href: '/budgets', label: 'Budgets', icon: PiggyBank }
	];

	const isActive = (href: string) =>
		page.url.pathname === href || page.url.pathname.startsWith(href + '/');

	const initials = $derived(
		(data.user.name ?? 'U')
			.split(' ')
			.slice(0, 2)
			.map((s: string) => s[0]?.toUpperCase() ?? '')
			.join('')
	);
</script>

<svelte:head><title>Mavlo</title></svelte:head>

<div class="min-h-screen flex bg-background">
	<aside
		class="w-60 border-r bg-sidebar text-sidebar-foreground border-sidebar-border p-4 hidden md:flex flex-col"
	>
		<div class="flex items-center gap-2 mb-6">
			<img src="/icon-192.png" alt="Mavlo" class="h-7 w-7 rounded-md" />
			<h1 class="text-xl font-bold text-primary">Mavlo</h1>
		</div>
		<nav class="space-y-1 text-sm flex-1">
			{#each sidebarNav as item}
				<a
					href={item.href}
					class="flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors {isActive(item.href)
						? 'bg-accent text-accent-foreground font-medium'
						: 'text-sidebar-foreground hover:bg-accent/50 hover:text-accent-foreground'}"
				>
					<item.icon class="h-4 w-4 shrink-0" />
					{item.label}
				</a>
			{/each}
		</nav>
	</aside>

	<main class="flex-1 flex flex-col min-w-0">
		<header
			class="border-b bg-background px-4 sm:px-6 py-3 flex items-center justify-between gap-3
				pt-[max(0.75rem,env(safe-area-inset-top))]"
		>
			<div class="flex items-center gap-1.5 md:hidden">
				<img src="/icon-192.png" alt="Mavlo" class="h-6 w-6 rounded-md" />
				<span class="text-base font-bold text-primary">Mavlo</span>
			</div>

			<span class="text-sm text-muted-foreground hidden md:inline">Hi, {data.user.name}</span>

			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							class="size-9 rounded-full overflow-hidden border bg-muted hover:opacity-80 transition-opacity flex items-center justify-center text-sm font-semibold shrink-0"
							aria-label="Account menu"
						>
							{#if data.user.image}
								<img src={data.user.image} alt={data.user.name} class="size-full object-cover" />
							{:else}
								{initials}
							{/if}
						</button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-44">
					<DropdownMenu.Item>
						{#snippet child({ props })}
							<a {...props} href="/settings" class="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent/50 cursor-pointer">
								<Settings class="size-4" /> Settings
							</a>
						{/snippet}
					</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<form method="POST" action="/sign-out">
						<DropdownMenu.Item>
							{#snippet child({ props })}
								<button {...props} type="submit" class="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-destructive rounded-sm hover:bg-accent/50 cursor-pointer">
									<LogOut class="size-4" /> Sign out
								</button>
							{/snippet}
						</DropdownMenu.Item>
					</form>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</header>

		<div
			class="p-3 sm:p-4 md:p-6 flex-1 overflow-x-hidden pb-[calc(var(--bottom-nav-h)+var(--fab-h)+env(safe-area-inset-bottom))] md:pb-6"
		>
			{@render children()}
		</div>
	</main>

	<Fab />

	<AddTransactionSheet
		bind:open={txState.open}
		mode="create"
		accounts={data.accounts ?? []}
		categories={data.categories ?? []}
		defaultKind={txState.defaultKind}
		{defaultAccountId}
		actionUrl="/transactions?/create"
		onClose={closeAddTransaction}
		onSuccess={() => invalidateAll()}
	/>

	<nav
		class="md:hidden fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)]"
	>
		<ul class="grid grid-cols-5">
			{#each primaryNav as item}
				<li>
					<a
						href={item.href}
						class="flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium relative transition-colors {isActive(item.href)
							? 'text-primary after:absolute after:top-0 after:left-1/2 after:-translate-x-1/2 after:h-0.5 after:w-8 after:bg-primary after:rounded-b-full'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						<item.icon class="h-5 w-5" />
						<span>{item.label}</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</div>
