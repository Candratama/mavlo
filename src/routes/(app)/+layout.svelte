<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { setMode } from 'mode-watcher';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import {
		LayoutDashboard,
		ArrowLeftRight,
		Wallet,
		Tag,
		PiggyBank,
		Settings,
		Coins,
		LogOut,
		Menu,
		MoreHorizontal
	} from 'lucide-svelte';

	let { children, data } = $props();

	$effect(() => {
		const t = data.preferences?.theme;
		untrack(() => {
			if (t === 'light' || t === 'dark' || t === 'system') setMode(t);
		});
	});

	let mobileNavOpen = $state(false);

	const primaryNav = [
		{ href: '/dashboard', label: 'Home', icon: LayoutDashboard },
		{ href: '/transactions', label: 'Tx', icon: ArrowLeftRight },
		{ href: '/accounts', label: 'Accounts', icon: Wallet },
		{ href: '/budgets', label: 'Budgets', icon: PiggyBank }
	];

	const moreNav = [
		{ href: '/categories', label: 'Categories', icon: Tag },
		{ href: '/settings', label: 'Settings', icon: Settings }
	];

	let moreOpen = $state(false);

	const allNav = [
		{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
		{ href: '/accounts', label: 'Accounts', icon: Wallet },
		{ href: '/categories', label: 'Categories', icon: Tag },
		{ href: '/budgets', label: 'Budgets', icon: PiggyBank },
		{ href: '/settings', label: 'Settings', icon: Settings }
	];

	const isActive = (href: string) =>
		page.url.pathname === href || page.url.pathname.startsWith(href + '/');

	const isMoreActive = $derived(moreNav.some((item) => isActive(item.href)));
</script>

<svelte:head><title>Mavlo</title></svelte:head>

<div class="min-h-screen flex bg-background">
	<aside
		class="w-60 border-r bg-sidebar text-sidebar-foreground border-sidebar-border p-4 hidden md:flex flex-col"
	>
		<div class="flex items-center gap-2 mb-6">
			<Coins class="h-5 w-5 text-primary" />
			<h1 class="text-xl font-bold text-primary">Mavlo</h1>
		</div>
		<nav class="space-y-1 text-sm flex-1">
			{#each allNav as item}
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
			<div class="flex items-center gap-2 md:hidden">
				<Sheet.Root bind:open={mobileNavOpen}>
					<Sheet.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="ghost"
								size="icon"
								class="size-11"
								aria-label="Open navigation"
							>
								<Menu class="h-5 w-5" />
							</Button>
						{/snippet}
					</Sheet.Trigger>
					<Sheet.Content side="left" class="w-[min(20rem,85vw)] p-4">
						<Sheet.Header class="text-left mb-4">
							<Sheet.Title class="flex items-center gap-2">
								<Coins class="h-5 w-5 text-primary" />
								<span class="text-primary">Mavlo</span>
							</Sheet.Title>
						</Sheet.Header>
						<nav class="space-y-1 text-sm">
							{#each allNav as item}
								<a
									href={item.href}
									onclick={() => (mobileNavOpen = false)}
									class="flex items-center gap-2.5 px-3 py-3 rounded-md transition-colors {isActive(item.href)
										? 'bg-accent text-accent-foreground font-medium'
										: 'text-sidebar-foreground hover:bg-accent/50 hover:text-accent-foreground'}"
								>
									<item.icon class="h-4 w-4 shrink-0" />
									{item.label}
								</a>
							{/each}
						</nav>
					</Sheet.Content>
				</Sheet.Root>
				<div class="flex items-center gap-1.5">
					<Coins class="h-5 w-5 text-primary" />
					<span class="text-base font-bold text-primary">Mavlo</span>
				</div>
			</div>

			<span class="text-sm text-muted-foreground hidden md:inline">Hi, {data.user.name}</span>

			<form method="POST" action="/sign-out">
				<Button type="submit" variant="ghost" size="sm" class="gap-1.5 h-9 sm:h-8">
					<LogOut class="h-4 w-4" />
					<span class="hidden sm:inline">Sign out</span>
				</Button>
			</form>
		</header>

		<div
			class="p-3 sm:p-4 md:p-6 flex-1 overflow-x-hidden pb-[max(5rem,calc(env(safe-area-inset-bottom)+5rem))] md:pb-6"
		>
			{@render children()}
		</div>
	</main>

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
			<li>
				<Sheet.Root bind:open={moreOpen}>
					<Sheet.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								type="button"
								class="w-full flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium relative transition-colors {isMoreActive
									? 'text-primary after:absolute after:top-0 after:left-1/2 after:-translate-x-1/2 after:h-0.5 after:w-8 after:bg-primary after:rounded-b-full'
									: 'text-muted-foreground hover:text-foreground'}"
								aria-label="More navigation"
							>
								<MoreHorizontal class="h-5 w-5" />
								<span>More</span>
							</button>
						{/snippet}
					</Sheet.Trigger>
					<Sheet.Content side="bottom" class="pb-[max(1rem,env(safe-area-inset-bottom))]">
						<Sheet.Header class="text-left">
							<Sheet.Title>More</Sheet.Title>
						</Sheet.Header>
						<nav class="space-y-1 text-sm mt-3">
							{#each moreNav as item}
								<a
									href={item.href}
									onclick={() => (moreOpen = false)}
									class="flex items-center gap-2.5 px-3 py-3 rounded-md transition-colors {isActive(item.href)
										? 'bg-accent text-accent-foreground font-medium'
										: 'text-sidebar-foreground hover:bg-accent/50 hover:text-accent-foreground'}"
								>
									<item.icon class="h-4 w-4 shrink-0" />
									{item.label}
								</a>
							{/each}
						</nav>
					</Sheet.Content>
				</Sheet.Root>
			</li>
		</ul>
	</nav>
</div>
