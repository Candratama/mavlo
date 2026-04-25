<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	let { data } = $props();
</script>

<svelte:head><title>Dashboard — Mavlo</title></svelte:head>

<h1 class="text-2xl font-semibold">Dashboard</h1>
<p class="mt-1 text-sm text-muted-foreground">
	Welcome, {data.user.name}. Currency: {data.preferences.currency} · Locale: {data.preferences.locale}
</p>

<div class="mt-8 grid gap-4 md:grid-cols-3">
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-sm font-medium text-muted-foreground">Net worth</Card.Title>
		</Card.Header>
		<Card.Content>
			<p class="text-2xl font-semibold">—</p>
			<p class="text-xs text-muted-foreground mt-1">Coming in Phase 2</p>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title class="text-sm font-medium text-muted-foreground">This month</Card.Title>
		</Card.Header>
		<Card.Content>
			<p class="text-2xl font-semibold">—</p>
			<p class="text-xs text-muted-foreground mt-1">Coming in Phase 2</p>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title class="text-sm font-medium text-muted-foreground">Recent activity</Card.Title>
		</Card.Header>
		<Card.Content>
			<p class="text-2xl font-semibold">—</p>
			<p class="text-xs text-muted-foreground mt-1">Coming in Phase 2</p>
		</Card.Content>
	</Card.Root>
</div>
