<script lang="ts">
	import { enhance } from '$app/forms';
	import { Input } from '$lib/components/ui/input';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import { Label } from '$lib/components/ui/label';
	let { form } = $props();
	let pending = $state(false);
</script>

<svelte:head><title>Sign up — Mavlo</title></svelte:head>

<h1 class="mavlo-headline text-3xl font-black tracking-tight">Bikin akun</h1>
<p class="mt-2 text-sm text-muted-foreground">Mulai lacak duit lo. Gratis selamanya.</p>

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
		<p class="text-xs text-muted-foreground">Minimal 8 karakter.</p>
	</div>

	{#if form?.message}
		<p class="text-destructive text-sm">{form.message}</p>
	{/if}

	<SubmitButton {pending} class="lift w-full">Sign up</SubmitButton>
</form>

<p class="mt-6 text-center text-xs text-muted-foreground">
	Udah punya akun?
	<a href="/sign-in" class="text-foreground hover:underline">Masuk</a>
</p>
