/**
 * When a modal/sheet/dialog opens, push a history entry. The browser back
 * button (or mobile gesture) then closes the modal instead of navigating
 * away from the page. When the modal closes programmatically, pop the
 * history entry we pushed so the back stack stays clean.
 *
 * Use inside a Svelte 5 $effect on the same reactive `open` state:
 *
 *   $effect(() => useModalBackClose(open, () => (open = false)));
 *
 * Nested modals (e.g. a picker opened inside an edit dialog) are tracked
 * via a shared stack so a single back press only closes the topmost one.
 */
const STATE_KEY = '__mavloModal';

const stack: Array<() => void> = [];
let listenerAttached = false;
let suppressNextPop = false;

function onGlobalPop() {
	if (suppressNextPop) {
		suppressNextPop = false;
		return;
	}
	const close = stack.pop();
	if (close) close();
}

export function useModalBackClose(open: boolean, close: () => void): (() => void) | void {
	if (typeof window === 'undefined') return;
	if (!open) return;

	history.pushState({ [STATE_KEY]: true }, '');

	const handler = () => close();
	stack.push(handler);

	if (!listenerAttached) {
		window.addEventListener('popstate', onGlobalPop);
		listenerAttached = true;
	}

	return () => {
		const idx = stack.lastIndexOf(handler);
		const wasOnStack = idx >= 0;
		if (wasOnStack) stack.splice(idx, 1);

		// If the modal is closing programmatically (still on stack when cleanup
		// runs) and our pushed entry is still on top, pop it so the back stack
		// stays clean. Suppress the resulting popstate so the global handler
		// doesn't pop another modal off the stack.
		if (!wasOnStack) return;
		const state = history.state as Record<string, unknown> | null;
		if (state && state[STATE_KEY]) {
			suppressNextPop = true;
			history.back();
		}
	};
}
