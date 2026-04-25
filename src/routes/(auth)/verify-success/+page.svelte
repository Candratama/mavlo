<script lang="ts">
	import * as Card from '$lib/components/ui/card';
</script>

<svelte:head><title>Email verified — Mavlo</title></svelte:head>

<Card.Header>
	<Card.Title class="text-xl">You're in</Card.Title>
	<Card.Description>Your email has been verified.</Card.Description>
</Card.Header>

<Card.Content>
	<p class="text-sm text-muted-foreground">
		You're all set. Head to your dashboard to get started.
	</p>
	<p class="mt-4 text-sm">
		<a href="/dashboard" class="text-muted-foreground hover:text-foreground underline">Go to dashboard</a>
	</p>
</Card.Content>
