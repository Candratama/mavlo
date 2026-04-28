<script lang="ts">
	import { enhance } from '$app/forms';
	import { Input } from '$lib/components/ui/input';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import { Label } from '$lib/components/ui/label';
	let { form } = $props();
	let pending = $state(false);
</script>

<svelte:head><title>Sign in — Mavlo</title></svelte:head>

<h1 class="mavlo-headline text-3xl font-black tracking-tight">Sign in</h1>
<p class="mt-2 text-sm text-muted-foreground">Welcome back to Mavlo.</p>

<form
	method="POST"
	use:enhance={() => {
		pending = true;
		return async ({ update }) => {
			await update();
			pending = false;
		};
	}}
	class="mt-6 space-y-4"
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
		<p class="text-destructive text-sm">{form.message}</p>
	{/if}

	<SubmitButton {pending} class="lift w-full">Sign in</SubmitButton>
</form>

<div class="mt-6 flex justify-between text-xs text-muted-foreground">
	<a href="/sign-up" class="hover:text-foreground underline">Create account</a>
	<a href="/forgot-password" class="hover:text-foreground underline">Forgot password?</a>
</div>
