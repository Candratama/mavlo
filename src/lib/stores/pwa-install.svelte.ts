type PromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type State = {
	event: PromptEvent | null;
	canInstall: boolean;
	installed: boolean;
};

const state = $state<State>({ event: null, canInstall: false, installed: false });

export function getPwaInstallState(): State {
	return state;
}

export function setupPwaCapture(): () => void {
	if (typeof window === 'undefined') return () => undefined;

	state.installed = isStandalone();

	const onPrompt = (e: Event) => {
		e.preventDefault();
		state.event = e as PromptEvent;
		state.canInstall = true;
	};
	const onInstalled = () => {
		state.event = null;
		state.canInstall = false;
		state.installed = true;
	};

	window.addEventListener('beforeinstallprompt', onPrompt);
	window.addEventListener('appinstalled', onInstalled);

	return () => {
		window.removeEventListener('beforeinstallprompt', onPrompt);
		window.removeEventListener('appinstalled', onInstalled);
	};
}

export async function triggerInstall(): Promise<'accepted' | 'dismissed' | null> {
	if (!state.event) return null;
	await state.event.prompt();
	const { outcome } = await state.event.userChoice;
	state.event = null;
	state.canInstall = false;
	return outcome;
}

export function isIOS(): boolean {
	if (typeof navigator === 'undefined') return false;
	const ua = navigator.userAgent;
	const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
	const isIPadOS = ua.includes('Mac') && 'ontouchend' in document;
	return isIOSDevice || isIPadOS;
}

export function isStandalone(): boolean {
	if (typeof window === 'undefined') return false;
	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		(navigator as unknown as { standalone?: boolean }).standalone === true
	);
}
