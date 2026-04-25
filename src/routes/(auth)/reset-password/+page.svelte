<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<svelte:head><title>Reset password — Mavlo</title></svelte:head>

<h1 class="text-2xl font-semibold mb-6">Choose a new password</h1>

{#if !data.token}
	<p class="text-sm text-red-600">
		Reset token missing.
		<a href="/forgot-password" class="underline">Request a new link.</a>
	</p>
{:else}
	<form method="POST" use:enhance class="space-y-4">
		<input type="hidden" name="token" value={form?.token ?? data.token} />
		<label class="block">
			<span class="text-sm font-medium">New password</span>
			<input
				name="password"
				type="password"
				required
				minlength="8"
				autocomplete="new-password"
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
			Set new password
		</button>
	</form>
{/if}
