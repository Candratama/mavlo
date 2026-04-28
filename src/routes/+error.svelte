<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft, Home, AlertTriangle } from 'lucide-svelte';

	const status = $derived(page.status);
	const message = $derived(page.error?.message ?? 'Something went wrong');

	const title = $derived.by(() => {
		if (status === 404) return 'Page not found';
		if (status === 401 || status === 403) return 'Access denied';
		if (status >= 500) return 'Server error';
		return 'Something broke';
	});

	const description = $derived.by(() => {
		if (status === 404) return "Sorry, we couldn't find what you were looking for.";
		if (status === 401 || status === 403) return 'You need to be signed in to view this page.';
		if (status >= 500) return 'Something went wrong on our end. Try again in a moment.';
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
					<ArrowLeft class="size-4 mr-1.5" /> Go back
				</Button>
				<Button href="/dashboard">
					<Home class="size-4 mr-1.5" /> Dashboard
				</Button>
			</div>
		</div>
	</div>
</main>
