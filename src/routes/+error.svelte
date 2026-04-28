<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft, Home, AlertTriangle } from 'lucide-svelte';

	const status = $derived(page.status);
	const message = $derived(page.error?.message ?? 'Something went wrong');

	const title = $derived.by(() => {
		if (status === 404) return 'Halaman gak ketemu';
		if (status === 401 || status === 403) return 'Akses ditolak';
		if (status >= 500) return 'Server error';
		return 'Ada yang error';
	});

	const description = $derived.by(() => {
		if (status === 404) return 'Maaf, halaman yang lo cari gak ada.';
		if (status === 401 || status === 403) return 'Lo harus masuk dulu buat liat halaman ini.';
		if (status >= 500) return 'Ada masalah di sisi server. Coba lagi sebentar.';
		return message;
	});

	function goBack() {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
		}
	}
</script>

<svelte:head><title>{title} — Mavlo</title></svelte:head>

<main class="min-h-screen flex items-center justify-center bg-background px-4 py-10">
	<div class="w-full max-w-md text-center">
		<div
			class="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-rose-500/15 via-background to-background p-6 sm:p-8"
		>
			<div
				class="size-12 rounded-full bg-expense/15 inline-flex items-center justify-center mb-4"
			>
				<AlertTriangle class="size-6 text-expense" />
			</div>
			<p class="text-xs uppercase tracking-wider text-muted-foreground">Error {status}</p>
			<h1 class="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
			<p class="mt-2 text-sm text-muted-foreground">{description}</p>

			{#if status !== 404 && message && message !== title}
				<p class="mt-3 text-xs text-muted-foreground/80 font-mono break-words">{message}</p>
			{/if}

			<div class="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
				<Button variant="outline" onclick={goBack}>
					<ArrowLeft class="size-4 mr-1.5" /> Balik
				</Button>
				<Button href="/dashboard">
					<Home class="size-4 mr-1.5" /> Dashboard
				</Button>
			</div>
		</div>
	</div>
</main>
