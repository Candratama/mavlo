<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';
	import { ArrowRight, ArrowUp, Heart } from 'lucide-svelte';

	type Props = {
		ctaTitle?: string;
		ctaDescription?: string;
		primaryHref?: string;
		primaryLabel?: string;
		secondaryHref?: string;
		secondaryLabel?: string;
		brand?: string;
		giantText?: string;
		madeBy?: string;
	};

	let {
		ctaTitle = 'Siap mulai lihat ke mana uangmu pergi?',
		ctaDescription = 'No credit card. Tidak akan pernah.',
		primaryHref = '/sign-up',
		primaryLabel = 'Buat akun gratis',
		secondaryHref = '/sign-in',
		secondaryLabel = 'Saya sudah punya akun',
		brand = 'Mavlo',
		giantText = 'MAVLO',
		madeBy = 'Mavlo'
	}: Props = $props();

	let wrapperEl: HTMLDivElement | undefined = $state();
	let giantEl: HTMLDivElement | undefined = $state();
	let headingEl: HTMLHeadingElement | undefined = $state();
	let linksEl: HTMLDivElement | undefined = $state();

	function magnetic(node: HTMLElement) {
		const onMove = (e: MouseEvent) => {
			const rect = node.getBoundingClientRect();
			const cx = e.clientX - rect.left - rect.width / 2;
			const cy = e.clientY - rect.top - rect.height / 2;
			gsap.to(node, {
				x: cx * 0.35,
				y: cy * 0.35,
				rotationX: -cy * 0.12,
				rotationY: cx * 0.12,
				scale: 1.05,
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
				ease: 'elastic.out(1, 0.3)',
				duration: 1.2
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

	onMount(() => {
		gsap.registerPlugin(ScrollTrigger);
		if (!wrapperEl) return;

		const ctx = gsap.context(() => {
			gsap.fromTo(
				giantEl as HTMLElement,
				{ y: '10vh', scale: 0.8, opacity: 0 },
				{
					y: '0vh',
					scale: 1,
					opacity: 1,
					ease: 'power1.out',
					scrollTrigger: {
						trigger: wrapperEl,
						start: 'top 80%',
						end: 'bottom bottom',
						scrub: 1
					}
				}
			);

			gsap.fromTo(
				[headingEl, linksEl],
				{ y: 50, opacity: 0 },
				{
					y: 0,
					opacity: 1,
					stagger: 0.15,
					ease: 'power3.out',
					scrollTrigger: {
						trigger: wrapperEl,
						start: 'top 40%',
						end: 'bottom bottom',
						scrub: 1
					}
				}
			);
		}, wrapperEl);

		return () => ctx.revert();
	});

	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	const marqueeItems = [
		'Personal Finance',
		'Free Forever',
		'No Ads',
		'PWA-First',
		'Open To Use'
	];
</script>

<div
	bind:this={wrapperEl}
	class="cinematic-footer-wrapper relative h-screen w-full"
	style="clip-path: polygon(0% 0, 100% 0%, 100% 100%, 0 100%);"
>
	<footer
		class="fixed bottom-0 left-0 flex h-screen w-full flex-col justify-between overflow-hidden bg-background text-foreground"
	>
		<!-- Aurora -->
		<div
			aria-hidden="true"
			class="footer-aurora pointer-events-none absolute top-1/2 left-1/2 z-0 h-[60vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 animate-footer-breathe rounded-[50%] blur-[80px]"
		></div>
		<!-- Grid -->
		<div aria-hidden="true" class="footer-bg-grid pointer-events-none absolute inset-0 z-0"></div>

		<!-- Giant background text -->
		<div
			bind:this={giantEl}
			aria-hidden="true"
			class="footer-giant-bg-text pointer-events-none absolute -bottom-[5vh] left-1/2 z-0 -translate-x-1/2 select-none whitespace-nowrap"
		>
			{giantText}
		</div>

		<!-- Diagonal marquee (top of footer) -->
		<div
			class="absolute top-12 left-0 z-10 w-full -rotate-2 scale-110 overflow-hidden border-y border-border/50 bg-background/60 py-4 shadow-2xl backdrop-blur-md"
		>
			<div
				class="text-muted-foreground animate-footer-scroll-marquee flex w-max text-xs font-bold tracking-[0.3em] uppercase md:text-sm"
			>
				{#each [0, 1] as _ (_)}
					<div class="flex items-center space-x-12 px-6">
						{#each marqueeItems as item, i (i + '-' + _)}
							<span>{item}</span>
							<span class={i % 2 === 0 ? 'text-primary/60' : 'text-secondary/60'}>✦</span>
						{/each}
					</div>
				{/each}
			</div>
		</div>

		<!-- Main center content -->
		<div
			class="relative z-10 mx-auto mt-20 flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6"
		>
			<h2
				bind:this={headingEl}
				class="footer-text-glow mb-4 text-center text-5xl font-black tracking-tighter md:text-7xl"
			>
				{ctaTitle}
			</h2>
			<p class="text-muted-foreground mb-10 text-center text-sm md:text-base">
				{ctaDescription}
			</p>

			<div bind:this={linksEl} class="flex w-full flex-col items-center gap-6">
				<div class="flex w-full flex-wrap justify-center gap-4">
					<a
						href={primaryHref}
						use:magnetic
						class="footer-glass-pill text-foreground group flex items-center gap-3 rounded-full px-10 py-5 text-sm font-bold md:text-base"
					>
						{primaryLabel}
						<ArrowRight class="size-4" />
					</a>
					<a
						href={secondaryHref}
						use:magnetic
						class="footer-glass-pill text-muted-foreground hover:text-foreground rounded-full px-10 py-5 text-sm font-bold md:text-base"
					>
						{secondaryLabel}
					</a>
				</div>
			</div>
		</div>

		<!-- Bottom bar -->
		<div
			class="relative z-20 flex w-full flex-col items-center justify-between gap-6 px-6 pb-8 md:flex-row md:px-12"
		>
			<div
				class="text-muted-foreground order-2 text-[10px] font-semibold tracking-widest uppercase md:order-1 md:text-xs"
			>
				© {new Date().getFullYear()} {brand}. All rights reserved.
			</div>

			<div
				class="footer-glass-pill order-1 flex cursor-default items-center gap-2 rounded-full border-border/50 px-6 py-3 md:order-2"
			>
				<span
					class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase md:text-xs"
					>Crafted with</span
				>
				<Heart class="animate-footer-heartbeat size-4 fill-rose-500 text-rose-500" />
				<span
					class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase md:text-xs"
					>by</span
				>
				<span class="text-foreground ml-1 text-xs font-black tracking-normal md:text-sm">
					{madeBy}
				</span>
			</div>

			<button
				type="button"
				onclick={scrollToTop}
				use:magnetic
				class="footer-glass-pill text-muted-foreground hover:text-foreground group order-3 flex size-12 items-center justify-center rounded-full"
				aria-label="Back to top"
			>
				<ArrowUp class="size-5 transition-transform duration-300 group-hover:-translate-y-1" />
			</button>
		</div>
	</footer>
</div>

<style>
	.cinematic-footer-wrapper {
		--pill-bg-1: color-mix(in oklch, var(--foreground) 3%, transparent);
		--pill-bg-2: color-mix(in oklch, var(--foreground) 1%, transparent);
		--pill-shadow: color-mix(in oklch, var(--background) 50%, transparent);
		--pill-highlight: color-mix(in oklch, var(--foreground) 10%, transparent);
		--pill-inset-shadow: color-mix(in oklch, var(--background) 80%, transparent);
		--pill-border: color-mix(in oklch, var(--foreground) 8%, transparent);
		--pill-bg-1-hover: color-mix(in oklch, var(--foreground) 8%, transparent);
		--pill-bg-2-hover: color-mix(in oklch, var(--foreground) 2%, transparent);
		--pill-border-hover: color-mix(in oklch, var(--foreground) 20%, transparent);
		--pill-shadow-hover: color-mix(in oklch, var(--background) 70%, transparent);
		--pill-highlight-hover: color-mix(in oklch, var(--foreground) 20%, transparent);
	}

	@keyframes footer-breathe {
		0% {
			transform: translate(-50%, -50%) scale(1);
			opacity: 0.6;
		}
		100% {
			transform: translate(-50%, -50%) scale(1.1);
			opacity: 1;
		}
	}

	@keyframes footer-scroll-marquee {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-50%);
		}
	}

	@keyframes footer-heartbeat {
		0%,
		100% {
			transform: scale(1);
		}
		15%,
		45% {
			transform: scale(1.25);
		}
		30% {
			transform: scale(1);
		}
	}

	:global(.animate-footer-breathe) {
		animation: footer-breathe 8s ease-in-out infinite alternate;
	}
	:global(.animate-footer-scroll-marquee) {
		animation: footer-scroll-marquee 40s linear infinite;
	}
	:global(.animate-footer-heartbeat) {
		animation: footer-heartbeat 1.6s cubic-bezier(0.25, 1, 0.5, 1) infinite;
	}

	:global(.footer-bg-grid) {
		background-size: 60px 60px;
		background-image:
			linear-gradient(
				to right,
				color-mix(in oklch, var(--foreground) 3%, transparent) 1px,
				transparent 1px
			),
			linear-gradient(
				to bottom,
				color-mix(in oklch, var(--foreground) 3%, transparent) 1px,
				transparent 1px
			);
		mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
		-webkit-mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
	}

	:global(.footer-aurora) {
		background: radial-gradient(
			circle at 50% 50%,
			color-mix(in oklch, var(--primary) 18%, transparent) 0%,
			color-mix(in oklch, #06b6d4 14%, transparent) 40%,
			transparent 70%
		);
	}

	:global(.footer-glass-pill) {
		background: linear-gradient(145deg, var(--pill-bg-1) 0%, var(--pill-bg-2) 100%);
		box-shadow:
			0 10px 30px -10px var(--pill-shadow),
			inset 0 1px 1px var(--pill-highlight),
			inset 0 -1px 2px var(--pill-inset-shadow);
		border: 1px solid var(--pill-border);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
	}

	:global(.footer-glass-pill:hover) {
		background: linear-gradient(145deg, var(--pill-bg-1-hover) 0%, var(--pill-bg-2-hover) 100%);
		border-color: var(--pill-border-hover);
		box-shadow:
			0 20px 40px -10px var(--pill-shadow-hover),
			inset 0 1px 1px var(--pill-highlight-hover);
		color: var(--foreground);
	}

	:global(.footer-giant-bg-text) {
		font-size: 26vw;
		line-height: 0.75;
		font-weight: 900;
		letter-spacing: -0.05em;
		color: transparent;
		-webkit-text-stroke: 1px color-mix(in oklch, var(--foreground) 5%, transparent);
		background: linear-gradient(
			180deg,
			color-mix(in oklch, var(--foreground) 10%, transparent) 0%,
			transparent 60%
		);
		-webkit-background-clip: text;
		background-clip: text;
	}

	:global(.footer-text-glow) {
		background: linear-gradient(
			180deg,
			var(--foreground) 0%,
			color-mix(in oklch, var(--foreground) 40%, transparent) 100%
		);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		filter: drop-shadow(0px 0px 20px color-mix(in oklch, var(--foreground) 15%, transparent));
	}
</style>
