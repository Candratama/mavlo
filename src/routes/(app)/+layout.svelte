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
	import { setupPwaCapture } from '$lib/stores/pwa-install.svelte.js';
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

	$effect(() => setupPwaCapture());

	$effect(() => {
		if (typeof window === 'undefined') return;
		const vv = window.visualViewport;
		if (!vv) return;
		const update = () => {
			const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
			document.documentElement.style.setProperty('--keyboard-h', `${offset}px`);
		};
		update();
		vv.addEventListener('resize', update);
		vv.addEventListener('scroll', update);
		return () => {
			vv.removeEventListener('resize', update);
			vv.removeEventListener('scroll', update);
		};
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		const onFocusIn = (e: FocusEvent) => {
			const target = e.target;
			if (!(target instanceof HTMLElement)) return;
			const tag = target.tagName;
			if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;
			setTimeout(() => {
				target.scrollIntoView({ block: 'center', behavior: 'smooth' });
			}, 300);
		};
		document.addEventListener('focusin', onFocusIn);
		return () => document.removeEventListener('focusin', onFocusIn);
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

<div class="bg-background flex min-h-screen">
	<aside
		class="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-60 flex-col border-r p-4 lg:flex"
	>
		<div class="mb-6 flex items-center gap-2">
			<img src="/icon-192.png" alt="Mavlo" class="h-7 w-7 rounded-md" />
			<h1 class="text-primary text-xl font-bold">Mavlo</h1>
		</div>
		<nav class="flex-1 space-y-1 text-sm">
			{#each sidebarNav as item}
				<a
					href={item.href}
					class="flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors {isActive(
						item.href
					)
						? 'bg-accent text-accent-foreground font-medium'
						: 'text-sidebar-foreground hover:bg-accent/50 hover:text-accent-foreground'}"
				>
					<item.icon class="h-4 w-4 shrink-0" />
					{item.label}
				</a>
			{/each}
		</nav>
	</aside>

	<main class="flex min-w-0 flex-1 flex-col">
		<header
			class="bg-background flex items-center justify-between gap-3 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]
				sm:px-6"
		>
			<div class="flex items-center gap-1.5 lg:hidden">
				<img src="/icon-192.png" alt="Mavlo" class="h-6 w-6 rounded-md" />
				<span class="text-primary text-base font-bold">Mavlo</span>
			</div>

			<span class="text-muted-foreground hidden text-sm lg:inline">Hi, {data.user.name}</span>

			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							class="bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border text-sm font-semibold transition-opacity hover:opacity-80"
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
							<a
								{...props}
								href="/settings"
								class="hover:bg-accent/50 flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
							>
								<Settings class="size-4" /> Settings
							</a>
						{/snippet}
					</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<form method="POST" action="/sign-out">
						<DropdownMenu.Item>
							{#snippet child({ props })}
								<button
									{...props}
									type="submit"
									class="text-destructive hover:bg-accent/50 flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
								>
									<LogOut class="size-4" /> Sign out
								</button>
							{/snippet}
						</DropdownMenu.Item>
					</form>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</header>

		<div
			class="flex-1 overflow-x-hidden px-3 pt-3 pb-[calc(var(--bottom-nav-h)+var(--fab-h)+1.5rem+env(safe-area-inset-bottom))] sm:px-4 sm:pt-4 md:px-6 md:pt-6 lg:pb-6"
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
		class="bg-background fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
	>
		<ul class="grid grid-cols-5">
			{#each primaryNav as item}
				<li>
					<a
						href={item.href}
						class="relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors {isActive(
							item.href
						)
							? 'text-primary after:bg-primary after:absolute after:top-0 after:left-1/2 after:h-0.5 after:w-8 after:-translate-x-1/2 after:rounded-b-full'
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
