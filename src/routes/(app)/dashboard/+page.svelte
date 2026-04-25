<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Dashboard — Mavlo</title></svelte:head>

<h1 class="text-2xl font-semibold">Dashboard</h1>
<p class="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
	Welcome, {data.user.name}. Currency: {data.preferences.currency} · Locale: {data.preferences.locale}
</p>

<div class="mt-8 grid gap-4 md:grid-cols-3">
	<div class="rounded-lg border bg-white dark:bg-zinc-900 p-6">
		<h2 class="text-sm font-medium text-zinc-500">Net worth</h2>
		<p class="mt-2 text-2xl">—</p>
		<p class="text-xs text-zinc-400 mt-1">Coming in Phase 2</p>
	</div>
	<div class="rounded-lg border bg-white dark:bg-zinc-900 p-6">
		<h2 class="text-sm font-medium text-zinc-500">This month</h2>
		<p class="mt-2 text-2xl">—</p>
		<p class="text-xs text-zinc-400 mt-1">Coming in Phase 2</p>
	</div>
	<div class="rounded-lg border bg-white dark:bg-zinc-900 p-6">
		<h2 class="text-sm font-medium text-zinc-500">Recent activity</h2>
		<p class="mt-2 text-2xl">—</p>
		<p class="text-xs text-zinc-400 mt-1">Coming in Phase 2</p>
	</div>
</div>
