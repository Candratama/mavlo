<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	let { children } = $props();
</script>

<div class="bg-background flex min-h-screen items-center justify-center p-4">
	<div class="w-full max-w-md">
		<div class="mb-8 flex items-center justify-center gap-2">
			<img src="/icon-192.png" alt="Mavlo" class="h-10 w-10 rounded-xl" />
			<span class="text-primary text-xl font-bold">Mavlo</span>
		</div>
		<Card.Root>
			{@render children()}
		</Card.Root>
	</div>
</div>
