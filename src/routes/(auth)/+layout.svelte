<script lang="ts">
	import { onMount } from 'svelte';
	import { setMode } from 'mode-watcher';
	import { Sparkles } from 'lucide-svelte';
	let { children } = $props();

	onMount(() => {
		setMode('dark');
	});
</script>

<div class="dark relative min-h-screen w-full overflow-hidden bg-[#020617] text-foreground">
	<!-- Top emerald radial glow -->
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-x-0 top-0 z-0 h-[60vh]"
		style="background: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(16,185,129,0.25), transparent 70%);"
	></div>
	<!-- Faint grid -->
	<div aria-hidden="true" class="mavlo-grid pointer-events-none absolute inset-0 z-0"></div>

	<!-- Logo strip -->
	<div class="relative z-10 flex flex-col items-center pt-10 pb-4">
		<a href="/" class="flex items-center gap-2">
			<img src="/icon-192.png" alt="Mavlo" class="size-8 rounded-xl" />
			<span class="text-xl font-bold text-foreground">Mavlo</span>
		</a>
		<div
			class="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground backdrop-blur-md"
		>
			<Sparkles class="size-2.5 text-emerald-400" />
			Personal · Free · Open
		</div>
	</div>

	<!-- Card slot -->
	<div class="relative z-10 flex justify-center px-4 py-6">
		<div class="mavlo-pill w-full max-w-md rounded-2xl p-8">
			{@render children()}
		</div>
	</div>

	<!-- Bottom credit -->
	<p class="relative z-10 pb-8 text-center text-[10px] text-muted-foreground">
		Crafted with ❤ by Mavlo
	</p>
</div>
