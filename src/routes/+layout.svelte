<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import InstallPrompt from '$lib/components/pwa/install-prompt.svelte';

	let { children } = $props();
</script>

<ModeWatcher defaultMode="light" />

{@render children()}

<InstallPrompt />
