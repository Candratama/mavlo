<script lang="ts">
	import { onMount } from 'svelte';
	import { setMode } from 'mode-watcher';
	import { resolve } from '$app/paths';
	import { Sparkles } from 'lucide-svelte';
	let { children } = $props();

	onMount(() => {
		setMode('dark');
	});
</script>

<div
	class="dark text-foreground relative flex min-h-screen w-full flex-col overflow-hidden bg-[#020617]"
>
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-x-0 top-0 z-0 h-[60vh]"
		style="background: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(16,185,129,0.25), transparent 70%);"
	></div>
	<div aria-hidden="true" class="mavlo-grid pointer-events-none absolute inset-0 z-0"></div>

	<div class="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
		<div class="flex flex-col items-center">
			<a href={resolve('/')} class="flex items-center gap-2">
				<span class="relative inline-flex">
					<span
						aria-hidden="true"
						class="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-emerald-500/30 blur-md"
					></span>
					<img src="/icon-192.png" alt="Mavlo" class="size-8 rounded-xl" />
				</span>
				<span class="text-foreground text-xl font-bold">Mavlo</span>
			</a>
			<div
				class="border-border/40 bg-background/20 text-muted-foreground mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold tracking-[0.3em] uppercase backdrop-blur-md"
			>
				<Sparkles class="size-2.5 text-emerald-400" />
				Account Setup
			</div>
		</div>

		<div class="mavlo-pill w-full max-w-lg rounded-2xl p-6 sm:p-8">
			{@render children()}
		</div>
	</div>

	<p class="text-muted-foreground relative z-10 pb-6 text-center text-[10px]">
		Crafted with ❤ by Mavlo
	</p>
</div>
