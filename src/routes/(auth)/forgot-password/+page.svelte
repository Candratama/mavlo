<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<svelte:head><title>Forgot password — Mavlo</title></svelte:head>

<h1 class="text-2xl font-semibold mb-6">Reset your password</h1>

{#if form?.sent}
	<p class="text-sm">If an account exists for that email, we've sent a reset link. Check your inbox.</p>
	<p class="mt-4 text-sm"><a href="/sign-in" class="underline">Back to sign in</a></p>
{:else}
	<form method="POST" use:enhance class="space-y-4">
		<label class="block">
			<span class="text-sm font-medium">Email</span>
			<input
				name="email"
				type="email"
				required
				autocomplete="email"
				value={form?.email ?? ''}
				class="mt-1 w-full rounded border px-3 py-2 dark:bg-zinc-800"
			/>
		</label>

		{#if form?.message}
			<p class="text-sm text-red-600">{form.message}</p>
		{/if}

		<button
			type="submit"
			class="w-full rounded bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white py-2 font-medium hover:opacity-90"
		>
			Send reset link
		</button>
	</form>
{/if}
