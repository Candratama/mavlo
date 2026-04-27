<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	let { children } = $props();
</script>

<div class="min-h-screen flex items-center justify-center bg-background p-4">
	<div class="w-full max-w-md">
		<div class="flex items-center gap-2 mb-8 justify-center">
			<img src="/icon-192.png" alt="Mavlo" class="h-10 w-10 rounded-xl" />
			<span class="text-xl font-bold text-primary">Mavlo</span>
		</div>
		<Card.Root>
			{@render children()}
		</Card.Root>
	</div>
</div>
