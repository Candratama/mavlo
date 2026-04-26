<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner';
	import RouteLoadingBar from '$lib/components/route-loading-bar.svelte';
	import InstallPrompt from '$lib/components/pwa/install-prompt.svelte';

	let { children } = $props();
</script>

<ModeWatcher defaultMode="light" />
<RouteLoadingBar />

{@render children()}

<Toaster richColors position="top-center" closeButton />
<InstallPrompt />
