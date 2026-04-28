<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Email terverifikasi — Mavlo</title></svelte:head>

<h1 class="mavlo-headline text-3xl font-black tracking-tight">Lo masuk!</h1>
<p class="text-muted-foreground mt-2 text-sm">Email lo udah terverifikasi.</p>

<p class="text-muted-foreground mt-6 text-sm">Semua siap. Cus ke dashboard buat mulai catat.</p>
<p class="mt-4 text-sm">
	<a href={resolve('/dashboard')} class="text-muted-foreground hover:text-foreground underline"
		>Buka dashboard</a
	>
</p>
