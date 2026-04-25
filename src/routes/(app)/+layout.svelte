<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import {
		LayoutDashboard,
		ArrowLeftRight,
		Wallet,
		Tag,
		PiggyBank,
		Settings,
		Coins,
		LogOut
	} from 'lucide-svelte';

	let { children, data } = $props();

	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
		{ href: '/accounts', label: 'Accounts', icon: Wallet },
		{ href: '/categories', label: 'Categories', icon: Tag },
		{ href: '/budgets', label: 'Budgets', icon: PiggyBank },
		{ href: '/settings', label: 'Settings', icon: Settings }
	];
</script>

<svelte:head><title>Mavlo</title></svelte:head>

<div class="min-h-screen flex bg-background">
	<aside class="w-60 border-r bg-sidebar text-sidebar-foreground border-sidebar-border p-4 hidden md:flex flex-col">
		<div class="flex items-center gap-2 mb-6">
			<Coins class="h-5 w-5 text-primary" />
			<h1 class="text-xl font-bold text-primary">Mavlo</h1>
		</div>
		<nav class="space-y-1 text-sm flex-1">
			{#each navItems as item}
				{@const isActive = page.url.pathname === item.href || page.url.pathname.startsWith(item.href + '/')}
				<a
					href={item.href}
					class="flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors {isActive
						? 'bg-accent text-accent-foreground font-medium'
						: 'text-sidebar-foreground hover:bg-accent/50 hover:text-accent-foreground'}"
				>
					<item.icon class="h-4 w-4 shrink-0" />
					{item.label}
				</a>
			{/each}
		</nav>
	</aside>

	<main class="flex-1 flex flex-col">
		<header class="border-b bg-background px-6 py-3 flex items-center justify-between">
			<span class="text-sm text-muted-foreground">Hi, {data.user.name}</span>
			<form method="POST" action="/sign-out">
				<Button type="submit" variant="ghost" size="sm" class="gap-1.5">
					<LogOut class="h-4 w-4" />
					Sign out
				</Button>
			</form>
		</header>
		<div class="p-6 flex-1">
			{@render children()}
		</div>
	</main>
</div>
