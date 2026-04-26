<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner';
	import InstallPrompt from '$lib/components/pwa/install-prompt.svelte';

	let { children } = $props();
</script>

<ModeWatcher defaultMode="light" />

{@render children()}

<Toaster richColors position="top-center" closeButton />
<InstallPrompt />
