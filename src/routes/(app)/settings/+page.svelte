<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { notify } from '$lib/utils/toast.js';

	let { data, form } = $props();
	const prefs = $derived(data.preferences);
	let pending = $state(false);
</script>

<svelte:head><title>Settings — Mavlo</title></svelte:head>

<h1 class="text-2xl font-semibold mb-2">Settings</h1>
<p class="text-sm text-muted-foreground mb-6">Customize your Mavlo experience.</p>

<Card.Root class="max-w-2xl">
	<Card.Header>
		<Card.Title>Preferences</Card.Title>
		<Card.Description>Currency, locale, timezone, and display options.</Card.Description>
	</Card.Header>
	<Card.Content>
		<form method="POST" use:enhance={() => {
				pending = true;
				return async ({ update, result }) => {
					await update();
					pending = false;
					if (result.type === 'success') {
						notify.success('Preferences saved');
					} else if (result.type === 'failure') {
						const message = (result.data as { message?: string } | undefined)?.message;
						notify.error(message ?? 'Could not save preferences');
					}
				};
			}} class="space-y-4">
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="pref-currency">Default currency</Label>
					<Input id="pref-currency" name="currency" required maxlength={8} value={prefs.currency} />
				</div>
				<div class="space-y-1">
					<Label for="pref-locale">Locale</Label>
					<Input id="pref-locale" name="locale" required maxlength={20} value={prefs.locale} />
				</div>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="pref-timezone">Timezone</Label>
					<Input id="pref-timezone" name="timezone" required maxlength={60} value={prefs.timezone} />
				</div>
				<div class="space-y-1">
					<Label for="pref-theme">Theme</Label>
					<select
						id="pref-theme"
						name="theme"
						required
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						<option value="light" selected={prefs.theme === 'light'}>Light</option>
						<option value="dark" selected={prefs.theme === 'dark'}>Dark</option>
						<option value="system" selected={prefs.theme === 'system'}>System</option>
					</select>
				</div>
			</div>
			<div class="space-y-1">
				<Label for="pref-week">Week starts on (0=Sun, 1=Mon, ..., 6=Sat)</Label>
				<Input
					id="pref-week"
					type="number"
					name="weekStartsOn"
					min="0"
					max="6"
					required
					value={prefs.weekStartsOn}
				/>
			</div>

			<SubmitButton {pending}>Save</SubmitButton>
		</form>
	</Card.Content>
</Card.Root>

<Card.Root class="max-w-2xl mt-6">
	<Card.Header>
		<Card.Title>Avatar</Card.Title>
		<Card.Description>Upload a profile picture (PNG, JPEG, WebP, or GIF; max 2 MB).</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if data.user.image}
			<img
				src={data.user.image}
				alt="Current avatar"
				class="size-20 rounded-full object-cover border mb-4"
			/>
		{/if}
		<form
			method="POST"
			action="/settings/avatar"
			enctype="multipart/form-data"
			class="flex items-center gap-3"
		>
			<Input type="file" name="avatar" accept="image/png,image/jpeg,image/webp,image/gif" required />
			<Button type="submit">Upload</Button>
		</form>
	</Card.Content>
</Card.Root>
