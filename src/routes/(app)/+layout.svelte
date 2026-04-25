<script lang="ts">
	let { children, data } = $props();
</script>

<svelte:head><title>Mavlo</title></svelte:head>

<div class="min-h-screen flex bg-zinc-50 dark:bg-zinc-950">
	<aside class="w-60 border-r bg-white dark:bg-zinc-900 p-4 hidden md:block">
		<div class="font-semibold text-lg mb-6">Mavlo</div>
		<nav class="space-y-1 text-sm">
			<a href="/dashboard" class="block px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">Dashboard</a>
			<a href="/transactions" class="block px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">Transactions</a>
			<a href="/accounts" class="block px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">Accounts</a>
			<a href="/categories" class="block px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">Categories</a>
			<a href="/budgets" class="block px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">Budgets</a>
			<a href="/settings" class="block px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">Settings</a>
		</nav>
	</aside>

	<main class="flex-1 flex flex-col">
		<header class="border-b bg-white dark:bg-zinc-900 px-6 py-3 flex items-center justify-between">
			<span class="text-sm text-zinc-600 dark:text-zinc-400">Hi, {data.user.name}</span>
			<form method="POST" action="/sign-out">
				<button
					type="submit"
					class="text-sm underline text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
				>
					Sign out
				</button>
			</form>
		</header>
		<div class="p-6 flex-1">
			{@render children()}
		</div>
	</main>
</div>
