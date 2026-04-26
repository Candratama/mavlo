<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { X, Download } from 'lucide-svelte';

	type BeforeInstallPromptEvent = Event & {
		readonly platforms: string[];
		readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
		prompt(): Promise<void>;
	};

	let promptEvent = $state<BeforeInstallPromptEvent | null>(null);
	let visible = $state(false);

	$effect(() => {
		if (typeof window === 'undefined') return;
		const dismissed = localStorage.getItem('mavlo:install-dismissed');
		if (dismissed === '1') return;

		const onBeforeInstall = (event: Event) => {
			event.preventDefault();
			promptEvent = event as BeforeInstallPromptEvent;
			visible = true;
		};
		window.addEventListener('beforeinstallprompt', onBeforeInstall);
		return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
	});

	async function install() {
		if (!promptEvent) return;
		await promptEvent.prompt();
		const choice = await promptEvent.userChoice;
		if (choice.outcome === 'accepted') {
			visible = false;
			promptEvent = null;
		}
	}

	function dismiss() {
		visible = false;
		if (typeof window !== 'undefined') {
			localStorage.setItem('mavlo:install-dismissed', '1');
		}
	}
</script>

{#if visible}
	<div
		class="fixed inset-x-3 bottom-3 z-50 rounded-lg border bg-background shadow-lg p-3 flex items-center gap-3
			md:inset-x-auto md:right-6 md:max-w-sm
			pb-[max(0.75rem,env(safe-area-inset-bottom))]"
		role="dialog"
		aria-label="Install Mavlo"
	>
		<div class="flex-1 min-w-0">
			<p class="text-sm font-medium">Install Mavlo</p>
			<p class="text-xs text-muted-foreground mt-0.5">Add to home screen for one-tap access.</p>
		</div>
		<Button onclick={install} size="sm" class="gap-1.5">
			<Download class="size-4" />
			Install
		</Button>
		<Button
			onclick={dismiss}
			size="icon"
			variant="ghost"
			class="size-8 shrink-0"
			aria-label="Dismiss"
		>
			<X class="size-4" />
		</Button>
	</div>
{/if}
