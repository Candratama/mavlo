<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	let { form } = $props();
	let pending = $state(false);
</script>

<svelte:head><title>Sign in — Mavlo</title></svelte:head>

<Card.Header>
	<Card.Title class="text-xl">Sign in to Mavlo</Card.Title>
	<Card.Description>Enter your credentials to access your account.</Card.Description>
</Card.Header>

<Card.Content>
	<form method="POST" use:enhance={() => { pending = true; return async ({ update }) => { await update(); pending = false; }; }} class="space-y-4">
		<div class="space-y-1.5">
			<Label for="email">Email</Label>
			<Input
				id="email"
				name="email"
				type="email"
				required
				autocomplete="email"
				value={form?.email ?? ''}
			/>
		</div>
		<div class="space-y-1.5">
			<Label for="password">Password</Label>
			<Input
				id="password"
				name="password"
				type="password"
				required
				autocomplete="current-password"
			/>
		</div>

		{#if form?.message}
			<p class="text-sm text-destructive">{form.message}</p>
		{/if}

		<SubmitButton {pending} class="w-full">Sign in</SubmitButton>
	</form>
</Card.Content>

<Card.Footer class="flex justify-between text-sm">
	<a href="/sign-up" class="text-muted-foreground hover:text-foreground underline">Create account</a>
	<a href="/forgot-password" class="text-muted-foreground hover:text-foreground underline">Forgot password?</a>
</Card.Footer>
