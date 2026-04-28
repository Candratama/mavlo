<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Cek email lo — Mavlo</title></svelte:head>

<h1 class="mavlo-headline text-3xl font-black tracking-tight">Verifikasi email</h1>
<p class="text-muted-foreground mt-2 text-sm">Link verifikasi udah dikirim.</p>

<p class="text-muted-foreground mt-6 text-sm">
	Klik link di email lo buat selesain daftar. Link-nya expired 24 jam.
</p>
<p class="mt-4 text-sm">
	<a href={resolve('/sign-in')} class="text-muted-foreground hover:text-foreground underline"
		>Balik ke masuk</a
	>
</p>
