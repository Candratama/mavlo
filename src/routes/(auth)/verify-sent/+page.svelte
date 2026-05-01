<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Check your email — Mavlo</title></svelte:head>

<h1 class="mavlo-headline text-3xl font-black tracking-tight">Verify email</h1>
<p class="text-muted-foreground mt-2 text-sm">A verification link has been sent.</p>

<p class="text-muted-foreground mt-6 text-sm">
	Click the link in your email to finish signing up. The link expires in 24 hours.
</p>
<p class="mt-4 text-sm">
	<a href={resolve('/sign-in')} class="text-muted-foreground hover:text-foreground underline"
		>Back to sign in</a
	>
</p>
