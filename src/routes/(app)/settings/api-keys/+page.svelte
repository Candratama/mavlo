<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { notify } from '$lib/utils/toast.js';
	import { Copy, Trash2, KeyRound } from 'lucide-svelte';

	let { data, form } = $props();

	let newName = $state('');
	const createdKey = $derived(
		form?.action === 'create' && form?.success ? (form as { plaintext: string }).plaintext : null
	);

	function copyKey() {
		if (createdKey) {
			navigator.clipboard.writeText(createdKey);
			notify.success('Key copied');
		}
	}
</script>

<svelte:head><title>API Keys — Mavlo</title></svelte:head>

<div class="mb-6">
	<h1 class="flex items-center gap-2 text-xl font-semibold">
		<KeyRound class="size-5" /> API Keys
	</h1>
	<p class="text-muted-foreground mt-1 text-sm">
		Use these to access the Mavlo API. Send as <code>Authorization: Bearer &lt;key&gt;</code>.
	</p>
</div>

<form
	method="POST"
	action="?/create"
	class="mb-4 flex gap-2"
	use:enhance={() =>
		async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				newName = '';
				await invalidateAll();
			}
		}}
>
	<Input name="name" bind:value={newName} placeholder="Key name (e.g. Zapier)" required />
	<Button type="submit">Generate</Button>
</form>

{#if createdKey}
	<div class="bg-card mb-4 rounded-lg border p-4">
		<p class="text-sm font-medium">Copy your key now — it won't be shown again.</p>
		<div class="mt-2 flex items-center gap-2">
			<code class="bg-muted flex-1 overflow-x-auto rounded px-2 py-1 text-xs">{createdKey}</code>
			<Button variant="ghost" size="icon" onclick={copyKey} aria-label="Copy key">
				<Copy class="size-4" />
			</Button>
		</div>
	</div>
{/if}

<ul class="space-y-2">
	{#each data.keys as key (key.id)}
		<li class="bg-card flex items-center gap-3 rounded-lg border p-3">
			<div class="min-w-0 flex-1">
				<div class="truncate text-sm font-medium">
					{key.name}
					{#if key.revokedAt}
						<span class="text-destructive ml-1 text-xs">(revoked)</span>
					{/if}
				</div>
				<div class="text-muted-foreground truncate text-xs">
					{key.prefix}… · {key.lastUsedAt
						? 'last used ' + new Date(key.lastUsedAt).toLocaleDateString()
						: 'never used'}
				</div>
			</div>
			{#if !key.revokedAt}
				<form
					method="POST"
					action="?/revoke"
					use:enhance={() =>
						async ({ result }) => {
							if (result.type === 'success') {
								await invalidateAll();
								notify.success('Key revoked');
							} else if (result.type === 'failure') {
								notify.error('Could not revoke key');
							}
						}}
				>
					<input type="hidden" name="id" value={key.id} />
					<Button type="submit" variant="ghost" size="icon" aria-label="Revoke key">
						<Trash2 class="text-destructive size-4" />
					</Button>
				</form>
			{/if}
		</li>
	{:else}
		<li class="text-muted-foreground py-8 text-center text-sm">No API keys yet.</li>
	{/each}
</ul>
