<script lang="ts">
	import * as Card from '$lib/components/ui/card';
</script>

<svelte:head><title>Check your email — Mavlo</title></svelte:head>

<Card.Header>
	<Card.Title class="text-xl">Verify your email</Card.Title>
	<Card.Description>We sent you a verification link.</Card.Description>
</Card.Header>

<Card.Content>
	<p class="text-muted-foreground text-sm">
		Click the link in your email to finish signing up. The link expires in 24 hours.
	</p>
	<p class="mt-4 text-sm">
		<a href="/sign-in" class="text-muted-foreground hover:text-foreground underline"
			>Back to sign in</a
		>
	</p>
</Card.Content>
