<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	let { data, form } = $props();
	let pending = $state(false);
</script>

<svelte:head><title>Reset password — Mavlo</title></svelte:head>

<Card.Header>
	<Card.Title class="text-xl">Choose a new password</Card.Title>
	<Card.Description>Enter your new password below.</Card.Description>
</Card.Header>

<Card.Content>
	{#if !data.token}
		<p class="text-sm text-destructive">
			Reset token missing.
			<a href="/forgot-password" class="underline hover:opacity-80">Request a new link.</a>
		</p>
	{:else}
		<form method="POST" use:enhance={() => { pending = true; return async ({ update }) => { await update(); pending = false; }; }} class="space-y-4">
			<input type="hidden" name="token" value={form?.token ?? data.token} />
			<div class="space-y-1.5">
				<Label for="password">New password</Label>
				<Input
					id="password"
					name="password"
					type="password"
					required
					minlength={8}
					autocomplete="new-password"
				/>
			</div>

			{#if form?.message}
				<p class="text-sm text-destructive">{form.message}</p>
			{/if}

			<SubmitButton {pending} class="w-full">Set new password</SubmitButton>
		</form>
	{/if}
</Card.Content>
