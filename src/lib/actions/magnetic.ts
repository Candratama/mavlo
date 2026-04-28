import { gsap } from 'gsap';

type Options = {
	strength?: number;
	tilt?: number;
};

export function magnetic(node: HTMLElement, opts: Options = {}) {
	const strength = opts.strength ?? 0.35;
	const tilt = opts.tilt ?? 0.1;

	const onMove = (e: MouseEvent) => {
		const rect = node.getBoundingClientRect();
		const cx = e.clientX - rect.left - rect.width / 2;
		const cy = e.clientY - rect.top - rect.height / 2;
		gsap.to(node, {
			x: cx * strength,
			y: cy * strength,
			rotationX: -cy * tilt,
			rotationY: cx * tilt,
			scale: 1.04,
			ease: 'power2.out',
			duration: 0.4
		});
	};

	const onLeave = () => {
		gsap.to(node, {
			x: 0,
			y: 0,
			rotationX: 0,
			rotationY: 0,
			scale: 1,
			ease: 'power3.out',
			duration: 0.5
		});
	};

	node.addEventListener('mousemove', onMove);
	node.addEventListener('mouseleave', onLeave);

	return {
		destroy() {
			node.removeEventListener('mousemove', onMove);
			node.removeEventListener('mouseleave', onLeave);
		}
	};
}
