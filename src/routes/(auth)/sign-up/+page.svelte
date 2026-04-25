<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<svelte:head><title>Sign up — Mavlo</title></svelte:head>

<h1 class="text-2xl font-semibold mb-6">Create your Mavlo account</h1>

<form method="POST" use:enhance class="space-y-4">
	<label class="block">
		<span class="text-sm font-medium">Name</span>
		<input
			name="name"
			type="text"
			required
			maxlength="100"
			autocomplete="name"
			value={form?.name ?? ''}
			class="mt-1 w-full rounded border px-3 py-2 dark:bg-zinc-800"
		/>
	</label>
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
	<label class="block">
		<span class="text-sm font-medium">Password</span>
		<input
			name="password"
			type="password"
			required
			minlength="8"
			autocomplete="new-password"
			class="mt-1 w-full rounded border px-3 py-2 dark:bg-zinc-800"
		/>
		<span class="text-xs text-zinc-500">Minimum 8 characters.</span>
	</label>

	{#if form?.message}
		<p class="text-sm text-red-600">{form.message}</p>
	{/if}

	<button
		type="submit"
		class="w-full rounded bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white py-2 font-medium hover:opacity-90"
	>
		Sign up
	</button>
</form>

<p class="mt-6 text-sm text-center text-zinc-600 dark:text-zinc-400">
	Already have an account? <a href="/sign-in" class="underline">Sign in</a>
</p>
