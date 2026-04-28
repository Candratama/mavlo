<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Input } from '$lib/components/ui/input';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import { Label } from '$lib/components/ui/label';
	let { data, form } = $props();
	let pending = $state(false);
</script>

<svelte:head><title>Reset password — Mavlo</title></svelte:head>

<h1 class="mavlo-headline text-3xl font-black tracking-tight">Password baru</h1>
<p class="text-muted-foreground mt-2 text-sm">Set password baru lo di bawah.</p>

{#if !data.token}
	<p class="text-destructive mt-6 text-sm">
		Token reset gak ada.
		<a href={resolve('/forgot-password')} class="underline hover:opacity-80">Minta link baru.</a>
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
		<input type="hidden" name="token" value={form?.token ?? data.token} />
		<div class="space-y-1.5">
			<Label for="password">Password baru</Label>
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
			<p class="text-destructive text-sm">{form.message}</p>
		{/if}

		<SubmitButton {pending} class="lift w-full">Set password baru</SubmitButton>
	</form>
{/if}
