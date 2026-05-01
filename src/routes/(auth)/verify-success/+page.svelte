<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		const t = setTimeout(() => goto(resolve('/onboarding')), 1500);
		return () => clearTimeout(t);
	});
</script>

<svelte:head><title>Email verified — Mavlo</title></svelte:head>

<h1 class="mavlo-headline text-3xl font-black tracking-tight">You're in!</h1>
<p class="text-muted-foreground mt-2 text-sm">
	Your email is verified. Continuing to account setup…
</p>

<p class="mt-6 text-sm">
	<a href={resolve('/onboarding')} class="text-muted-foreground hover:text-foreground underline">
		Start setup now →
	</a>
</p>
