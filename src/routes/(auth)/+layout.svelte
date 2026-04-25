<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	let { children } = $props();
</script>

<div class="min-h-screen flex items-center justify-center bg-background p-4">
	<Card.Root class="w-full max-w-md">
		{@render children()}
	</Card.Root>
</div>
