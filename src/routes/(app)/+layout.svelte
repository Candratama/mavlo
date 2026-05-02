<script lang="ts">
	import { page, navigating } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import { setMode } from 'mode-watcher';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import Fab from '$lib/components/ui/fab.svelte';
	import LimelightNav, { type LimelightNavItem } from '$lib/components/ui/limelight-nav.svelte';
	import AddTransactionSheet from '$lib/components/forms/add-transaction-sheet.svelte';
	import {
		getAddTransactionState,
		closeAddTransaction
	} from '$lib/stores/add-transaction.svelte.js';
	import { setupPwaCapture } from '$lib/stores/pwa-install.svelte.js';
	import { getLastUsed } from '$lib/utils/last-used.js';
	import { invalidateAll, preloadCode, preloadData } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		LayoutDashboard,
		ArrowLeftRight,
		Wallet,
		Tag,
		Target,
		Settings,
		LogOut,
		Home
	} from 'lucide-svelte';

	let { children, data } = $props();

	$effect(() => {
		const t = data.preferences?.theme;
		untrack(() => {
			if (t === 'light' || t === 'dark' || t === 'system') setMode(t);
		});
	});

	$effect(() => setupPwaCapture());

	// (B) Aggressive prefetch — preload main route code + data after dashboard mount.
	// Subsequent navigations between the 4 main pages feel instant.
	const MAIN_ROUTES = ['/dashboard', '/transactions', '/accounts', '/budgets'];
	onMount(() => {
		// Code first (small, synchronous JS)
		MAIN_ROUTES.forEach((r) => {
			void preloadCode(r);
		});
		// Data on idle so it doesn't fight initial render.
		const idle = (cb: () => void) => {
			const w = window as Window & { requestIdleCallback?: (cb: () => void) => void };
			if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(cb);
			else setTimeout(cb, 600);
		};
		idle(() => {
			MAIN_ROUTES.forEach((r) => {
				if (r === page.url.pathname) return;
				void preloadData(r);
			});
		});
	});

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
		{ href: '/budgets', label: 'Budgets', icon: Target },
		{ href: '/categories', label: 'Categories', icon: Tag }
	] as const;

	const sidebarNav = [
		{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
		{ href: '/accounts', label: 'Accounts', icon: Wallet },
		{ href: '/categories', label: 'Categories', icon: Tag },
		{ href: '/budgets', label: 'Budgets', icon: Target }
	] as const;

	const isActive = (href: string) =>
		page.url.pathname === href || page.url.pathname.startsWith(href + '/');

	const limelightItems = $derived<LimelightNavItem[]>(
		primaryNav.map((n) => ({
			id: n.href,
			icon: n.icon,
			label: n.label,
			href: n.href
		}))
	);
	const limelightActive = $derived(primaryNav.findIndex((n) => isActive(n.href)));

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
			<span class="relative inline-flex">
				<span
					aria-hidden="true"
					class="pointer-events-none absolute inset-0 -z-10 rounded-md bg-emerald-500/10 blur-md"
				></span>
				<img src="/icon-192.png" alt="Mavlo" class="h-7 w-7 rounded-md" />
			</span>
			<h1 class="text-primary text-xl font-bold">Mavlo</h1>
		</div>
		<nav class="flex-1 space-y-1 text-sm">
			{#each sidebarNav as item (item.href)}
				<a
					href={resolve(item.href)}
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

	<main class="relative flex min-w-0 flex-1 flex-col">
		<!-- Subtle emerald wash at top of content area only -->
		<div
			aria-hidden="true"
			class="pointer-events-none absolute inset-x-0 top-0 z-0 h-[40vh]"
			style="background: radial-gradient(ellipse 60% 35% at 50% 0%, rgba(16,185,129,0.12), transparent 70%);"
		></div>
		<div aria-hidden="true" class="mavlo-grid-app pointer-events-none absolute inset-0 z-0"></div>
		<header
			class="bg-background/80 relative z-10 flex items-center justify-between gap-3 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:px-6 lg:justify-end"
		>
			<div class="flex items-center gap-1.5 lg:hidden">
				<span class="relative inline-flex">
					<span
						aria-hidden="true"
						class="pointer-events-none absolute inset-0 -z-10 rounded-md bg-emerald-500/30 blur-md"
					></span>
					<img src="/icon-192.png" alt="Mavlo" class="h-6 w-6 rounded-md" />
				</span>
				<span class="text-primary text-base font-bold">Mavlo</span>
			</div>

			<div class="flex shrink-0 items-center gap-3">
				{#if data.user?.isDemo}
					<a
						href={resolve('/sign-up')}
						class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-amber-300 uppercase transition-colors hover:bg-amber-500/25"
					>
						<span class="size-1.5 animate-pulse rounded-full bg-amber-400"></span>
						Demo · Daftar
					</a>
				{/if}
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
						{#if data.user?.isDemo}
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<a
										{...props}
										href={resolve('/')}
										class="hover:bg-accent/50 flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
									>
										<Home class="size-4" /> Landing
									</a>
								{/snippet}
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
						{/if}
						<DropdownMenu.Item>
							{#snippet child({ props })}
								<a
									{...props}
									href={resolve('/settings')}
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
			</div>
		</header>

		<div
			class="relative z-10 flex-1 overflow-x-hidden px-3 pt-3 pb-[calc(var(--bottom-nav-h)+var(--fab-h)+1.5rem+env(safe-area-inset-bottom))] sm:px-4 sm:pt-4 md:px-6 md:pt-6 lg:pb-6"
		>
			{@render children()}
		</div>
	</main>

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

	<div
		class="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
	>
		<LimelightNav
			items={limelightItems}
			activeIndex={limelightActive}
			class="mavlo-pill mavlo-pill-solid"
			iconContainerClass="px-4 py-5"
		/>
		<Fab />
	</div>

	{#if navigating.to}
		<div
			class="nav-progress pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden"
		>
			<div class="nav-progress-bar h-full bg-emerald-400"></div>
		</div>
	{/if}
</div>

<style>
	.nav-progress-bar {
		animation: nav-progress 2.4s ease-in-out infinite;
		transform-origin: left center;
	}
	@keyframes nav-progress {
		0% {
			transform: translateX(-100%) scaleX(0.4);
		}
		50% {
			transform: translateX(0%) scaleX(0.6);
		}
		100% {
			transform: translateX(100%) scaleX(0.4);
		}
	}
</style>
