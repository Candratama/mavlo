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

<svelte:head><title>Forgot password — Mavlo</title></svelte:head>

<Card.Header>
	<Card.Title class="text-xl">Reset your password</Card.Title>
	<Card.Description>Enter your email to receive a reset link.</Card.Description>
</Card.Header>

<Card.Content>
	{#if form?.sent}
		<p class="text-sm">
			If an account exists for that email, we've sent a reset link. Check your inbox.
		</p>
		<p class="mt-4 text-sm">
			<a href="/sign-in" class="text-muted-foreground hover:text-foreground underline"
				>Back to sign in</a
			>
		</p>
	{:else}
		<form
			method="POST"
			use:enhance={() => {
				pending = true;
				return async ({ update }) => {
					await update();
					pending = false;
				};
			}}
			class="space-y-4"
		>
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

			{#if form?.message}
				<p class="text-destructive text-sm">{form.message}</p>
			{/if}

			<SubmitButton {pending} class="w-full">Send reset link</SubmitButton>
		</form>
	{/if}
</Card.Content>
