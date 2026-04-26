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

<svelte:head><title>Sign up — Mavlo</title></svelte:head>

<Card.Header>
	<Card.Title class="text-xl">Create your Mavlo account</Card.Title>
	<Card.Description>Track your finances on Mavlo.</Card.Description>
</Card.Header>

<Card.Content>
	<form method="POST" use:enhance={() => { pending = true; return async ({ update }) => { await update(); pending = false; }; }} class="space-y-4">
		<div class="space-y-1.5">
			<Label for="name">Name</Label>
			<Input
				id="name"
				name="name"
				type="text"
				required
				maxlength={100}
				autocomplete="name"
				value={form?.name ?? ''}
			/>
		</div>
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
				minlength={8}
				autocomplete="new-password"
			/>
			<p class="text-xs text-muted-foreground">Minimum 8 characters.</p>
		</div>

		{#if form?.message}
			<p class="text-sm text-destructive">{form.message}</p>
		{/if}

		<SubmitButton {pending} class="w-full">Sign up</SubmitButton>
	</form>
</Card.Content>

<Card.Footer class="justify-center text-sm">
	<span class="text-muted-foreground">Already have an account?</span>
	<a href="/sign-in" class="ml-1 text-muted-foreground hover:text-foreground underline">Sign in</a>
</Card.Footer>
