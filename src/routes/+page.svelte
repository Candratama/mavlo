<script lang="ts">
	import CinematicFooter from '$lib/components/ui/cinematic-footer.svelte';
	import { ArrowRight } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { setMode } from 'mode-watcher';
	import { gsap } from 'gsap';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';

	onMount(() => {
		setMode('dark');
		gsap.registerPlugin(ScrollTrigger);

		const ctx = gsap.context(() => {
			gsap.utils.toArray<HTMLElement>('[data-anim="fade-up"]').forEach((el) => {
				gsap.fromTo(
					el,
					{ y: 40, opacity: 0 },
					{
						y: 0,
						opacity: 1,
						duration: 1,
						ease: 'power3.out',
						scrollTrigger: {
							trigger: el,
							start: 'top 85%',
							toggleActions: 'play none none reverse'
						}
					}
				);
			});

			gsap.utils.toArray<HTMLElement>('[data-stagger]').forEach((parent) => {
				const items = parent.querySelectorAll<HTMLElement>('[data-stagger-item]');
				gsap.fromTo(
					items,
					{ y: 30, opacity: 0 },
					{
						y: 0,
						opacity: 1,
						duration: 0.9,
						stagger: 0.12,
						ease: 'power3.out',
						scrollTrigger: {
							trigger: parent,
							start: 'top 80%',
							toggleActions: 'play none none reverse'
						}
					}
				);
			});

			const heroGiant = document.querySelector<HTMLElement>('[data-hero-giant]');
			if (heroGiant) {
				gsap.fromTo(
					heroGiant,
					{ y: '-5vh', scale: 0.95 },
					{
						y: '15vh',
						scale: 1.05,
						ease: 'none',
						scrollTrigger: {
							trigger: heroGiant.parentElement,
							start: 'top top',
							end: 'bottom top',
							scrub: 1
						}
					}
				);
			}
		});

		return () => ctx.revert();
	});

	let scrolled = $state(false);

	$effect(() => {
		if (typeof window === 'undefined') return;
		const onScroll = () => {
			scrolled = window.scrollY > 8;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	const features = [
		{
			icon: '/icons/wallet.png',
			title: 'Multi-account',
			body: 'Cash, bank, e-wallet, kartu kredit. Saldo lo nyatu di satu tempat.'
		},
		{
			icon: '/icons/dollar.png',
			title: 'Budget per kategori',
			body: 'Pasang limit bulanan. Bar progres + warning pas lo mau kebablasan.'
		},
		{
			icon: '/icons/chart.png',
			title: 'Visualisasi pengeluaran',
			body: 'Donut chart, daily flow, income vs expense 6 bulan terakhir.'
		},
		{
			icon: '/icons/mobile.png',
			title: 'PWA-first, offline-friendly',
			body: 'Install di home screen. Buka tanpa internet. Kerasa kayak app native.'
		}
	] as const;

	const marqueeWords = [
		'duit gue habis ke mana?',
		'lupa beli apa aja',
		'masa fitur dasar bayar?',
		'yaudah bikin sendiri',
		'gratis selamanya'
	];
</script>

<svelte:head>
	<title>Mavlo — Lacak Duit Lo Tanpa Bayar</title>
	<meta
		name="description"
		content="Catat transaksi, atur budget per kategori, dan tau ke mana duit lo pergi. Gratis selamanya, tanpa fitur premium."
	/>
</svelte:head>

<div
	class="dark text-foreground landing relative min-h-screen w-full overflow-x-hidden bg-[#020617]"
>
	<!-- Global ambient glows -->
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-x-0 top-0 z-0 h-[120vh]"
		style="background-image: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(16,185,129,0.28), transparent 70%), radial-gradient(ellipse 40% 35% at 80% 30%, rgba(6,182,212,0.18), transparent 60%);"
	></div>
	<div aria-hidden="true" class="mavlo-grid pointer-events-none absolute inset-0 z-0"></div>

	<!-- Top bar -->
	<header
		class="sticky top-0 z-30 transition-all duration-300 {scrolled
			? 'border-border/40 bg-background/40 border-b backdrop-blur-md'
			: 'border-b border-transparent bg-transparent'}"
	>
		<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
			<a href="/" class="flex items-center gap-2">
				<span class="relative inline-flex">
					<span
						aria-hidden="true"
						class="pointer-events-none absolute inset-0 -z-10 rounded-md bg-emerald-500/30 blur-md"
					></span>
					<img src="/icon-192.png" alt="Mavlo" class="size-7 rounded-md" />
				</span>
				<span class="text-primary text-lg font-bold">Mavlo</span>
			</a>
			<div class="flex items-center gap-2">
				<a
					href="/sign-in"
					class="mavlo-pill text-muted-foreground hover:text-foreground rounded-full px-4 py-2 text-xs font-bold tracking-wider uppercase transition-transform duration-300 ease-out hover:-translate-y-0.5"
				>
					Sign in
				</a>
				<a
					href="/sign-up"
					class="mavlo-pill text-foreground flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold tracking-wider uppercase transition-transform duration-300 ease-out hover:-translate-y-0.5"
				>
					Get started
					<ArrowRight class="size-3.5" />
				</a>
			</div>
		</div>
	</header>

	<!-- Hero -->
	<section class="relative isolate px-4 pt-20 pb-24 sm:px-6 sm:pt-32 sm:pb-32">
		<div class="pointer-events-none absolute inset-0 z-0">
			<div
				class="mavlo-aurora animate-mavlo-breathe absolute top-1/2 left-1/2 h-[60vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] blur-[80px]"
			></div>
		</div>

		<div
			data-hero-giant
			aria-hidden="true"
			class="mavlo-giant-text pointer-events-none absolute -bottom-[8vh] left-1/2 z-0 -translate-x-1/2 whitespace-nowrap select-none"
		>
			MAVLO
		</div>

		<div class="relative z-10 mx-auto max-w-3xl text-center">
			<div
				data-anim="fade-up"
				class="border-border/40 bg-background/30 text-muted-foreground mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[10px] font-bold tracking-[0.3em] uppercase backdrop-blur-md"
			>
				<img src="/icons/star.png" alt="" class="icon-3d-emerald size-4" />
				Personal · Free · Open
			</div>

			<h1
				data-anim="fade-up"
				class="mavlo-headline text-5xl font-black tracking-tighter sm:text-7xl"
			>
				Lacak duit lo<br />tanpa harus bayar.
			</h1>

			<p
				data-anim="fade-up"
				class="text-muted-foreground mx-auto mt-8 max-w-xl text-base leading-relaxed sm:text-lg"
			>
				Catat pengeluaran 5 detik. Atur budget per kategori. Tau persis
				<span class="text-foreground font-medium italic">"duit gue habis ke mana?"</span> — tanpa bayar
				sepeser pun.
			</p>

			<div data-anim="fade-up" class="mt-10 flex flex-wrap items-center justify-center gap-4">
				<a
					href="/sign-up"
					class="mavlo-pill group text-foreground flex items-center gap-3 rounded-full px-10 py-5 text-sm font-bold transition-transform duration-300 ease-out hover:-translate-y-1 md:text-base"
				>
					Mulai gratis
					<ArrowRight class="size-4 transition-transform duration-300 group-hover:translate-x-1" />
				</a>
				<a
					href="/sign-in"
					class="mavlo-pill text-muted-foreground hover:text-foreground rounded-full px-10 py-5 text-sm font-bold transition-transform duration-300 ease-out hover:-translate-y-1 md:text-base"
				>
					Udah punya akun
				</a>
			</div>
		</div>
	</section>

	<!-- Marquee divider -->
	<div
		aria-hidden="true"
		class="border-border/30 bg-background/40 relative z-10 -my-2 overflow-hidden border-y py-4 backdrop-blur-md"
	>
		<div
			class="animate-mavlo-scroll-marquee text-muted-foreground/60 flex w-max items-center text-xs font-medium tracking-[0.3em] sm:text-sm"
		>
			{#each [0, 1] as _ (_)}
				<div class="flex items-center gap-10 px-6">
					{#each marqueeWords as w, i (i + '-' + _)}
						<span class="whitespace-nowrap italic">"{w}"</span>
						<span class="text-primary/60">✦</span>
					{/each}
				</div>
			{/each}
		</div>
	</div>

	<!-- Story -->
	<section class="relative z-10 px-4 py-20 sm:px-6 sm:py-28">
		<div class="mx-auto max-w-3xl">
			<div data-anim="fade-up" class="mb-6 flex items-center gap-3">
				<span class="text-primary/80 text-[10px] font-black tracking-[0.3em]">01</span>
				<span class="from-primary/40 h-px flex-1 bg-gradient-to-r to-transparent"></span>
				<span class="text-muted-foreground text-[10px] font-bold tracking-[0.3em] uppercase">
					Cerita di balik Mavlo
				</span>
			</div>

			<div
				data-anim="fade-up"
				data-stagger
				class="mavlo-pill relative isolate overflow-hidden rounded-3xl p-8 sm:p-12"
			>
				<div
					aria-hidden="true"
					class="mavlo-aurora pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full opacity-60 blur-[80px]"
				></div>
				<div class="relative space-y-6 text-base leading-relaxed sm:text-lg">
					<p data-stagger-item>
						Gue sering bingung tiap akhir bulan. Saldo tinggal dikit, tapi lupa beli apa aja. Udah
						coba beberapa app pelacak keuangan yang populer — semuanya bagus, tapi <span
							class="text-foreground font-semibold underline decoration-rose-400/60 decoration-2 underline-offset-4"
							>mesti bayar</span
						>
						buat fitur dasar kayak budget per kategori atau export data.
					</p>
					<p data-stagger-item>
						Yaudah, gue bikin sendiri. Fokusnya simpel:
						<span
							class="text-foreground font-semibold underline decoration-emerald-400/60 decoration-2 underline-offset-4"
							>catat transaksi cepet</span
						>,
						<span
							class="text-foreground font-semibold underline decoration-cyan-400/60 decoration-2 underline-offset-4"
							>budget per kategori</span
						>, dan
						<span
							class="text-foreground font-semibold underline decoration-violet-400/60 decoration-2 underline-offset-4"
							>grafik pengeluaran</span
						>
						yang enak dibaca. Tanpa fitur premium, tanpa iklan.
					</p>
					<p data-stagger-item class="text-muted-foreground">
						Kalau Mavlo bantu lo juga, gue seneng banget. Pakai sebebas-bebasnya.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Features -->
	<section class="relative z-10 px-4 py-20 sm:px-6 sm:py-28">
		<div class="mx-auto max-w-3xl">
			<div data-anim="fade-up" class="mb-6 flex items-center gap-3">
				<span class="text-primary/80 text-[10px] font-black tracking-[0.3em]">02</span>
				<span class="from-primary/40 h-px flex-1 bg-gradient-to-r to-transparent"></span>
				<span class="text-muted-foreground text-[10px] font-bold tracking-[0.3em] uppercase">
					Yang lo dapet
				</span>
			</div>

			<h2
				data-anim="fade-up"
				class="mavlo-headline mb-10 text-4xl font-black tracking-tighter sm:text-5xl"
			>
				Empat hal kecil<br />yang bikin beda.
			</h2>

			<div data-stagger class="grid gap-4 sm:grid-cols-2">
				{#each features as f, i (f.title)}
					<div
						data-stagger-item
						class="feature-card group border-border/40 via-card/80 to-card/80 relative rounded-2xl border bg-gradient-to-br from-emerald-500/15 p-6 backdrop-blur-md transition-all duration-500 ease-out hover:-translate-y-3 hover:border-emerald-400/50 hover:shadow-2xl hover:shadow-emerald-500/20"
					>
						<img
							src={f.icon}
							alt=""
							class="icon-3d-emerald mb-4 size-20 transition-transform duration-500 ease-out group-hover:-translate-y-1 group-hover:scale-110"
						/>
						<div class="mb-1 flex items-baseline gap-2">
							<span class="text-muted-foreground/60 text-[10px] font-bold tracking-widest">
								0{i + 1}
							</span>
							<h3 class="text-lg font-bold tracking-tight">{f.title}</h3>
						</div>
						<p class="text-muted-foreground text-sm leading-relaxed">{f.body}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Privacy strip -->
	<section class="relative z-10 px-4 py-12 sm:px-6 sm:py-16">
		<div class="mx-auto max-w-3xl">
			<div data-anim="fade-up" class="mavlo-pill flex items-center gap-4 rounded-2xl p-5 sm:p-6">
				<img src="/icons/lock.png" alt="" class="icon-3d-emerald size-16 shrink-0" />
				<p class="text-muted-foreground text-sm leading-relaxed sm:text-base">
					Data lo cuma lo yang liat. Gak dijual, gak dipakai buat training AI, gak dishare ke
					siapapun.
					<span class="text-foreground font-medium">
						Tujuannya cuma satu: bantu lo paham keuangan sendiri.
					</span>
				</p>
			</div>
		</div>
	</section>

	<!-- Donation -->
	<section class="relative z-10 px-4 py-20 sm:px-6 sm:py-28">
		<div class="mx-auto max-w-3xl">
			<div data-anim="fade-up" class="mb-6 flex items-center gap-3">
				<span class="text-[10px] font-black tracking-[0.3em] text-rose-300/80">03</span>
				<span class="h-px flex-1 bg-gradient-to-r from-rose-400/40 to-transparent"></span>
				<span class="text-muted-foreground text-[10px] font-bold tracking-[0.3em] uppercase">
					Dukungan
				</span>
			</div>

			<div
				data-anim="fade-up"
				class="mavlo-pill relative isolate overflow-hidden rounded-3xl p-8 text-center sm:p-12"
			>
				<div
					aria-hidden="true"
					class="pointer-events-none absolute inset-0"
					style="background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(244,63,94,0.18), transparent 70%);"
				></div>

				<div class="relative">
					<img
						src="/icons/heart.png"
						alt=""
						class="icon-3d-rose animate-mavlo-heartbeat mx-auto mb-5 size-20"
					/>
					<h2 class="mavlo-headline text-3xl font-black tracking-tight sm:text-4xl">
						Suka Mavlo? Bisa kali beliin kopi.
					</h2>
					<p
						class="text-muted-foreground mx-auto mt-4 max-w-md text-sm leading-relaxed sm:text-base"
					>
						Mavlo gratis dan bakal tetep gratis. Tapi kalau bantu lo hemat ratusan ribu per bulan,
						traktiran kecil bantu gue bayar server dan tetep waras ngembangin fitur baru.
					</p>

					<div class="mt-8 flex flex-wrap items-center justify-center gap-3">
						<a
							href="https://trakteer.id/wahyu_candra_tama/tip"
							target="_blank"
							rel="noopener noreferrer"
							class="mavlo-pill group text-foreground inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-bold transition-transform duration-300 ease-out hover:-translate-y-0.5"
						>
							Traktir di Trakteer
							<ArrowRight
								class="size-4 transition-transform duration-300 group-hover:translate-x-1"
							/>
						</a>
					</div>

					<p class="text-muted-foreground mt-5 text-xs">
						Atau share Mavlo ke temen lo yang lagi pusing soal duit — itu juga ngebantu banget.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Cinematic footer with embedded CTA -->
	<CinematicFooter
		ctaTitle="Siap liat ke mana duit lo pergi?"
		ctaDescription="Tanpa kartu kredit. Tanpa langganan. Selamanya."
		primaryHref="/sign-up"
		primaryLabel="Buat akun gratis"
		secondaryHref="/sign-in"
		secondaryLabel="Udah punya akun"
	/>
</div>

<style>
	.landing :global(.mavlo-pill) {
		transform-style: preserve-3d;
	}

	/* Force GPU layer + isolation so border-radius stays consistent under
	   the magnetic 3D transform. Clip-path also forces immediate rounded
	   masking instead of relying on overflow:hidden which lags briefly when
	   the transform begins. */
	.feature-card {
		clip-path: inset(0 round 1rem);
		transform-style: preserve-3d;
		backface-visibility: hidden;
		will-change: transform;
	}
</style>
