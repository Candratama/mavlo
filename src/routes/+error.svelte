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
		return 'Something went wrong';
	});

	const description = $derived.by(() => {
		if (status === 404) return "Sorry, the page you're looking for doesn't exist.";
		if (status === 401 || status === 403) return 'You need to sign in to view this page.';
		if (status >= 500) return 'There was an issue on our end. Please try again shortly.';
		return message;
	});

	function goBack() {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
		}
	}
</script>

<svelte:head><title>{title} — Mavlo</title></svelte:head>

<main class="bg-background flex min-h-screen items-center justify-center px-4 py-10">
	<div class="w-full max-w-md text-center">
		<div
			class="via-background to-background relative overflow-hidden rounded-2xl border bg-gradient-to-br from-rose-500/15 p-6 sm:p-8"
		>
			<div class="bg-expense/15 mb-4 inline-flex size-12 items-center justify-center rounded-full">
				<AlertTriangle class="text-expense size-6" />
			</div>
			<p class="text-muted-foreground text-xs tracking-wider uppercase">Error {status}</p>
			<h1 class="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
			<p class="text-muted-foreground mt-2 text-sm">{description}</p>

			{#if status !== 404 && message && message !== title}
				<p class="text-muted-foreground/80 mt-3 font-mono text-xs break-words">{message}</p>
			{/if}

			<div class="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
				<Button variant="outline" onclick={goBack}>
					<ArrowLeft class="mr-1.5 size-4" /> Back
				</Button>
				<Button href="/dashboard">
					<Home class="mr-1.5 size-4" /> Dashboard
				</Button>
			</div>
		</div>
	</div>
</main>
