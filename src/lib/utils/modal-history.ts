/**
 * When a modal/sheet/dialog opens, push a history entry. The browser back
 * button (or mobile gesture) then closes the modal instead of navigating
 * away from the page. When the modal closes programmatically, pop the
 * history entry we pushed so the back stack stays clean.
 *
 * Use inside a Svelte 5 $effect on the same reactive `open` state:
 *
 *   $effect(() => useModalBackClose(open, () => (open = false)));
 */
export function useModalBackClose(open: boolean, close: () => void): (() => void) | void {
	if (typeof window === 'undefined') return;
	if (!open) return;

	const STATE_KEY = '__mavloModal';
	history.pushState({ [STATE_KEY]: true }, '');
	let popped = false;

	const onPop = () => {
		popped = true;
		close();
	};
	window.addEventListener('popstate', onPop, { once: true });

	return () => {
		window.removeEventListener('popstate', onPop);
		if (popped) return;
		// Modal closed programmatically while our pushed entry is still on top.
		// Pop it so the back stack returns to where it was before the modal opened.
		const state = history.state as Record<string, unknown> | null;
		if (state && state[STATE_KEY]) {
			history.back();
		}
	};
}
