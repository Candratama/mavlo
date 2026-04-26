import { invalidateAll } from '$app/navigation';

type Options = {
	threshold?: number;
};

const DEFAULT_THRESHOLD = 80;

export function setupPullToRefresh(target: HTMLElement, opts: Options = {}): () => void {
	if (typeof window === 'undefined') return () => undefined;
	if (!('ontouchstart' in window)) return () => undefined;

	const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
	let startY = 0;
	let pulling = false;
	let pullDistance = 0;
	let indicator: HTMLDivElement | null = null;

	const ensureIndicator = (): HTMLDivElement => {
		if (indicator) return indicator;
		const div = document.createElement('div');
		div.style.cssText =
			'position:fixed;top:0;left:50%;transform:translate(-50%,-100%);background:hsl(var(--primary));color:hsl(var(--primary-foreground));padding:0.5rem 1rem;border-radius:0 0 0.5rem 0.5rem;font-size:0.75rem;z-index:60;transition:transform 0.2s';
		div.textContent = 'Pull to refresh';
		document.body.appendChild(div);
		indicator = div;
		return div;
	};

	const onTouchStart = (e: TouchEvent) => {
		if (window.scrollY > 0) return;
		startY = e.touches[0].clientY;
		pulling = true;
		pullDistance = 0;
	};

	const onTouchMove = (e: TouchEvent) => {
		if (!pulling) return;
		pullDistance = e.touches[0].clientY - startY;
		if (pullDistance <= 0) return;
		const ind = ensureIndicator();
		const offset = Math.min(pullDistance, threshold * 1.5);
		ind.style.transform = `translate(-50%, ${offset - 40}px)`;
		ind.textContent = pullDistance >= threshold ? 'Release to refresh' : 'Pull to refresh';
	};

	const onTouchEnd = async () => {
		if (!pulling) return;
		pulling = false;
		const should = pullDistance >= threshold;
		if (indicator) {
			indicator.style.transform = 'translate(-50%, -100%)';
			setTimeout(() => {
				if (indicator) {
					indicator.remove();
					indicator = null;
				}
			}, 220);
		}
		pullDistance = 0;
		if (should) {
			await invalidateAll();
		}
	};

	target.addEventListener('touchstart', onTouchStart, { passive: true });
	target.addEventListener('touchmove', onTouchMove, { passive: true });
	target.addEventListener('touchend', onTouchEnd);

	return () => {
		target.removeEventListener('touchstart', onTouchStart);
		target.removeEventListener('touchmove', onTouchMove);
		target.removeEventListener('touchend', onTouchEnd);
		if (indicator) {
			indicator.remove();
			indicator = null;
		}
	};
}
