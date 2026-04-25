<script lang="ts">
	let { children } = $props();
</script>

<div class="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
	<div class="w-full max-w-md rounded-lg border bg-white dark:bg-zinc-900 p-8 shadow-sm">
		{@render children()}
	</div>
</div>
