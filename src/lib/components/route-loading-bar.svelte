<script lang="ts">
	import { navigating } from '$app/state';
</script>

{#if navigating.to}
	<div class="fixed top-0 left-0 right-0 z-50 h-0.5 overflow-hidden bg-transparent">
		<div class="h-full w-1/2 bg-primary animate-loading-bar"></div>
	</div>
{/if}

<style>
	@keyframes loading-bar {
		0% {
			transform: translateX(-100%);
		}
		50% {
			transform: translateX(50%);
		}
		100% {
			transform: translateX(200%);
		}
	}
	.animate-loading-bar {
		animation: loading-bar 1.4s linear infinite;
	}
</style>
