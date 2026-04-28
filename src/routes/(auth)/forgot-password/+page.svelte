<script lang="ts">
	import { enhance } from '$app/forms';
	import { Input } from '$lib/components/ui/input';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import { Label } from '$lib/components/ui/label';
	let { form } = $props();
	let pending = $state(false);
</script>

<svelte:head><title>Forgot password — Mavlo</title></svelte:head>

<h1 class="mavlo-headline text-3xl font-black tracking-tight">Reset password</h1>
<p class="mt-2 text-sm text-muted-foreground">Masukin email lo, kita kirim link reset-nya.</p>

{#if form?.sent}
	<p class="mt-6 text-sm">
		Kalau email lo terdaftar, link reset udah dikirim. Cek inbox.
	</p>
	<p class="mt-4 text-sm">
		<a href="/sign-in" class="text-muted-foreground hover:text-foreground underline">Balik ke masuk</a>
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

		{#if form?.message}
			<p class="text-destructive text-sm">{form.message}</p>
		{/if}

		<SubmitButton {pending} class="lift w-full">Kirim link reset</SubmitButton>
	</form>
{/if}
