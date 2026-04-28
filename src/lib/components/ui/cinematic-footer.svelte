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
		class="fixed bottom-0 left-0 flex h-screen w-full flex-col justify-between overflow-hidden bg-[#020617] text-foreground"
	>
		<!-- Top fade: blend seamlessly with landing's emerald top glow -->
		<div
			aria-hidden="true"
			class="pointer-events-none absolute inset-x-0 top-0 z-0 h-40"
			style="background: linear-gradient(to bottom, rgba(2,6,23,0) 0%, rgba(2,6,23,0.9) 60%, #020617 100%);"
		></div>
		<!-- Aurora -->
		<div
			aria-hidden="true"
			class="mavlo-aurora pointer-events-none absolute top-1/2 left-1/2 z-0 h-[60vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 animate-mavlo-breathe rounded-[50%] blur-[80px]"
		></div>
		<!-- Grid -->
		<div aria-hidden="true" class="mavlo-grid pointer-events-none absolute inset-0 z-0"></div>

		<!-- Giant background text -->
		<div
			bind:this={giantEl}
			aria-hidden="true"
			class="mavlo-giant-text pointer-events-none absolute -bottom-[5vh] left-1/2 z-0 -translate-x-1/2 select-none whitespace-nowrap"
		>
			{giantText}
		</div>

		<!-- Diagonal marquee (top of footer) -->
		<div
			class="absolute top-12 left-0 z-10 w-full -rotate-2 scale-110 overflow-hidden border-y border-border/40 bg-[#020617]/60 py-4 shadow-2xl backdrop-blur-md"
		>
			<div
				class="text-muted-foreground animate-mavlo-scroll-marquee flex w-max text-xs font-bold tracking-[0.3em] uppercase md:text-sm"
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
				class="mavlo-headline mb-4 text-center text-5xl font-black tracking-tighter md:text-7xl"
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
						class="mavlo-pill text-foreground group flex items-center gap-3 rounded-full px-10 py-5 text-sm font-bold transition-transform duration-300 ease-out hover:-translate-y-1 md:text-base"
					>
						{primaryLabel}
						<ArrowRight class="size-4 transition-transform duration-300 group-hover:translate-x-1" />
					</a>
					<a
						href={secondaryHref}
						class="mavlo-pill text-muted-foreground hover:text-foreground rounded-full px-10 py-5 text-sm font-bold transition-transform duration-300 ease-out hover:-translate-y-1 md:text-base"
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
				class="mavlo-pill order-1 flex cursor-default items-center gap-2 rounded-full border-border/50 px-6 py-3 md:order-2"
			>
				<span
					class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase md:text-xs"
					>Crafted with</span
				>
				<Heart class="animate-mavlo-heartbeat size-4 fill-rose-500 text-rose-500" />
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
				class="mavlo-pill text-muted-foreground hover:text-foreground group order-3 flex size-12 items-center justify-center rounded-full transition-transform duration-300 ease-out hover:-translate-y-1"
				aria-label="Back to top"
			>
				<ArrowUp class="size-5 transition-transform duration-300 group-hover:-translate-y-1" />
			</button>
		</div>
	</footer>
</div>
