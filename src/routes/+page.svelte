<script lang="ts">
	import CinematicFooter from '$lib/components/ui/cinematic-footer.svelte';
	import {
		ArrowRight,
		Wallet,
		PiggyBank,
		BarChart3,
		Smartphone,
		Heart,
		Lock,
		Sparkles
	} from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { setMode } from 'mode-watcher';
	import { magnetic } from '$lib/actions/magnetic.js';
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
			icon: Wallet,
			title: 'Multi-account',
			body: 'Cash, bank, e-wallet, kartu kredit. Semua saldo di satu tempat.',
			accent: 'emerald'
		},
		{
			icon: PiggyBank,
			title: 'Budget per kategori',
			body: 'Pasang limit bulanan. Bar progres + warning kalau over.',
			accent: 'violet'
		},
		{
			icon: BarChart3,
			title: 'Visualisasi pengeluaran',
			body: 'Donut chart, daily flow, income vs expense 6 bulan.',
			accent: 'cyan'
		},
		{
			icon: Smartphone,
			title: 'PWA-first, offline-friendly',
			body: 'Install di home screen. Pakai kayak app native, gratis.',
			accent: 'rose'
		}
	] as const;

	const accentBg = {
		emerald: 'bg-gradient-to-br from-emerald-500/15 via-card/80 to-card/80',
		violet: 'bg-gradient-to-br from-violet-500/15 via-card/80 to-card/80',
		cyan: 'bg-gradient-to-br from-cyan-500/15 via-card/80 to-card/80',
		rose: 'bg-gradient-to-br from-rose-500/15 via-card/80 to-card/80'
	} as const;

	const accentBorder = {
		emerald: 'hover:border-emerald-400/50',
		violet: 'hover:border-violet-400/50',
		cyan: 'hover:border-cyan-400/50',
		rose: 'hover:border-rose-400/50'
	} as const;

	const accentIcon = {
		emerald: 'text-emerald-300',
		violet: 'text-violet-300',
		cyan: 'text-cyan-300',
		rose: 'text-rose-300'
	} as const;

	const accentIconBg = {
		emerald: 'bg-emerald-500/15 border-emerald-400/30',
		violet: 'bg-violet-500/15 border-violet-400/30',
		cyan: 'bg-cyan-500/15 border-cyan-400/30',
		rose: 'bg-rose-500/15 border-rose-400/30'
	} as const;

	const marqueeWords = [
		'uangku habis ke mana?',
		'gak inget beli apa aja',
		'harus bayar buat fitur dasar',
		'akhirnya bikin sendiri',
		'gratis selamanya'
	];
</script>

<svelte:head>
	<title>Mavlo — Lacak Uangmu Tanpa Bayar</title>
	<meta
		name="description"
		content="App pribadi pelacak keuangan. Gratis. Buatan sendiri karena gak mau bayar app sejenis."
	/>
</svelte:head>

<div class="dark relative min-h-screen w-full overflow-x-hidden bg-[#020617] text-foreground landing">
	<!-- Global ambient glows -->
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-x-0 top-0 z-0 h-[120vh]"
		style="background-image: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(16,185,129,0.28), transparent 70%), radial-gradient(ellipse 40% 35% at 80% 30%, rgba(6,182,212,0.18), transparent 60%);"
	></div>
	<div aria-hidden="true" class="footer-bg-grid pointer-events-none absolute inset-0 z-0"></div>

	<!-- Top bar -->
	<header
		class="sticky top-0 z-30 transition-all duration-300 {scrolled
			? 'border-b border-border/40 bg-background/40 backdrop-blur-md'
			: 'border-b border-transparent bg-transparent'}"
	>
		<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
			<a href="/" class="flex items-center gap-2">
				<img src="/icon-192.png" alt="Mavlo" class="size-7 rounded-md" />
				<span class="text-lg font-bold text-primary">Mavlo</span>
			</a>
			<div class="flex items-center gap-2">
				<a
					href="/sign-in"
					use:magnetic={{ strength: 0.2, tilt: 0.05 }}
					class="footer-glass-pill rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
				>
					Sign in
				</a>
				<a
					href="/sign-up"
					use:magnetic={{ strength: 0.25, tilt: 0.06 }}
					class="footer-glass-pill flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground"
				>
					Get started
					<ArrowRight class="size-3.5" />
				</a>
			</div>
		</div>
	</header>

	<!-- Hero -->
	<section class="relative isolate px-4 pb-24 pt-20 sm:px-6 sm:pb-32 sm:pt-32">
		<div class="pointer-events-none absolute inset-0 z-0">
			<div
				class="footer-aurora absolute left-1/2 top-1/2 h-[60vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 animate-footer-breathe rounded-[50%] blur-[80px]"
			></div>
		</div>

		<div
			data-hero-giant
			aria-hidden="true"
			class="footer-giant-bg-text pointer-events-none absolute -bottom-[8vh] left-1/2 z-0 -translate-x-1/2 select-none whitespace-nowrap"
		>
			MAVLO
		</div>

		<div class="relative z-10 mx-auto max-w-3xl text-center">
			<div
				data-anim="fade-up"
				class="mb-6 inline-flex items-center gap-2 rounded-full border border-border/40 bg-background/30 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground backdrop-blur-md"
			>
				<Sparkles class="size-3 text-primary" />
				Personal · Free · Open
			</div>

			<h1
				data-anim="fade-up"
				class="footer-text-glow text-5xl font-black tracking-tighter sm:text-7xl"
			>
				Lacak uangmu<br />tanpa harus bayar.
			</h1>

			<p
				data-anim="fade-up"
				class="mx-auto mt-8 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
			>
				Mavlo lahir dari satu pertanyaan yang sering muncul tiap akhir bulan:
				<span class="text-foreground font-medium italic">"uangku habis ke mana?"</span>
			</p>

			<div
				data-anim="fade-up"
				class="mt-10 flex flex-wrap items-center justify-center gap-4"
			>
				<a
					href="/sign-up"
					use:magnetic={{ strength: 0.3, tilt: 0.08 }}
					class="footer-glass-pill group flex items-center gap-3 rounded-full px-10 py-5 text-sm font-bold text-foreground md:text-base"
				>
					Mulai gratis
					<ArrowRight class="size-4 transition-transform duration-300 group-hover:translate-x-1" />
				</a>
				<a
					href="/sign-in"
					use:magnetic={{ strength: 0.3, tilt: 0.08 }}
					class="footer-glass-pill rounded-full px-10 py-5 text-sm font-bold text-muted-foreground hover:text-foreground md:text-base"
				>
					Saya sudah punya akun
				</a>
			</div>
		</div>
	</section>

	<!-- Marquee divider -->
	<div
		aria-hidden="true"
		class="relative z-10 -my-2 overflow-hidden border-y border-border/30 bg-background/40 py-4 backdrop-blur-md"
	>
		<div
			class="animate-footer-scroll-marquee flex w-max items-center text-xs font-medium tracking-[0.3em] text-muted-foreground/60 sm:text-sm"
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
				<span class="text-[10px] font-black tracking-[0.3em] text-primary/80">01</span>
				<span class="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent"></span>
				<span class="text-[10px] font-bold tracking-[0.3em] uppercase text-muted-foreground">
					Cerita di balik Mavlo
				</span>
			</div>

			<div
				data-anim="fade-up"
				data-stagger
				class="footer-glass-pill relative isolate overflow-hidden rounded-3xl p-8 sm:p-12"
			>
				<div
					aria-hidden="true"
					class="footer-aurora pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full blur-[80px] opacity-60"
				></div>
				<div class="relative space-y-6 text-base leading-relaxed sm:text-lg">
					<p data-stagger-item>
						Aku sering kebingungan tiap akhir bulan. Saldo tinggal sedikit, tapi gak inget
						beli apa aja. Beberapa kali nyoba app pelacak keuangan yang populer — semuanya
						bagus, tapi <span class="text-foreground font-semibold underline decoration-rose-400/60 decoration-2 underline-offset-4">harus bayar</span>
						buat fitur dasar kayak budget per kategori atau export data.
					</p>
					<p data-stagger-item>
						Akhirnya aku bikin sendiri. Fokusnya simpel:
						<span class="text-foreground font-semibold underline decoration-emerald-400/60 decoration-2 underline-offset-4">catat transaksi cepat</span>,
						<span class="text-foreground font-semibold underline decoration-cyan-400/60 decoration-2 underline-offset-4">lihat budget per kategori</span>, dan
						<span class="text-foreground font-semibold underline decoration-violet-400/60 decoration-2 underline-offset-4">grafik pengeluaran</span>
						yang gampang dibaca. Tanpa fitur premium, tanpa iklan.
					</p>
					<p data-stagger-item class="text-muted-foreground">
						Kalau Mavlo bantu kamu juga, aku seneng banget. Gunakan sebebasnya.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Features -->
	<section class="relative z-10 px-4 py-20 sm:px-6 sm:py-28">
		<div class="mx-auto max-w-3xl">
			<div data-anim="fade-up" class="mb-6 flex items-center gap-3">
				<span class="text-[10px] font-black tracking-[0.3em] text-primary/80">02</span>
				<span class="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent"></span>
				<span class="text-[10px] font-bold tracking-[0.3em] uppercase text-muted-foreground">
					Yang kamu dapat
				</span>
			</div>

			<h2
				data-anim="fade-up"
				class="footer-text-glow mb-10 text-4xl font-black tracking-tighter sm:text-5xl"
			>
				Empat hal kecil<br />yang bikin beda.
			</h2>

			<div data-stagger class="grid gap-4 sm:grid-cols-2">
				{#each features as f, i (f.title)}
					<div
						data-stagger-item
						class="feature-card group relative rounded-2xl border border-border/40 p-6 backdrop-blur-md transition-[transform,border-color] duration-300 ease-out hover:scale-[1.02] {accentBg[f.accent]} {accentBorder[f.accent]}"
					>
						<div
							class="mb-4 inline-flex size-11 items-center justify-center rounded-xl border backdrop-blur {accentIconBg[f.accent]}"
						>
							<f.icon class="size-5 {accentIcon[f.accent]}" />
						</div>
						<div class="mb-1 flex items-baseline gap-2">
							<span class="text-[10px] font-bold tracking-widest text-muted-foreground/60">
								0{i + 1}
							</span>
							<h3 class="text-lg font-bold tracking-tight">{f.title}</h3>
						</div>
						<p class="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Privacy strip -->
	<section class="relative z-10 px-4 py-12 sm:px-6 sm:py-16">
		<div class="mx-auto max-w-3xl">
			<div
				data-anim="fade-up"
				class="footer-glass-pill flex items-center gap-4 rounded-2xl p-5 sm:p-6"
			>
				<div
					class="grid size-12 shrink-0 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-500/10"
				>
					<Lock class="size-5 text-emerald-300" />
				</div>
				<p class="text-sm leading-relaxed text-muted-foreground sm:text-base">
					Datamu disimpan terisolasi per akun. Tidak dijual, tidak dipakai untuk training, tidak
					dishare ke pihak ketiga.
					<span class="text-foreground font-medium">
						Tujuannya cuma satu: bantu kamu paham keuangan sendiri.
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
				<span class="text-[10px] font-bold tracking-[0.3em] uppercase text-muted-foreground">
					Dukungan
				</span>
			</div>

			<div
				data-anim="fade-up"
				class="footer-glass-pill relative isolate overflow-hidden rounded-3xl p-8 text-center sm:p-12"
			>
				<div
					aria-hidden="true"
					class="pointer-events-none absolute inset-0"
					style="background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(244,63,94,0.18), transparent 70%);"
				></div>

				<div class="relative">
					<div
						class="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-rose-400/30 bg-rose-500/15"
					>
						<Heart class="animate-footer-heartbeat size-6 fill-rose-400 text-rose-400" />
					</div>
					<h2 class="footer-text-glow text-3xl font-black tracking-tight sm:text-4xl">
						Suka Mavlo? Boleh traktir.
					</h2>
					<p class="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
						Mavlo gratis dan akan tetap gratis. Tapi kalau bantu kamu hemat ratusan ribu per
						bulan, dukungan kecil bantu aku bayar server dan tetap waras ngembangin fitur baru.
					</p>

					<div
						class="mx-auto mt-7 max-w-md rounded-2xl border border-dashed border-border/50 bg-background/30 p-4 text-sm backdrop-blur"
					>
						<p class="text-muted-foreground">
							Platform donasi belum ditentukan. Stay tuned —
							<span class="text-foreground font-medium">link akan diumumkan di sini.</span>
						</p>
					</div>

					<p class="mt-5 text-xs text-muted-foreground">
						Sementara, kamu bisa share Mavlo ke teman yang lagi pusing soal keuangan.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Cinematic footer with embedded CTA -->
	<CinematicFooter
		ctaTitle="Siap lihat ke mana uangmu pergi?"
		ctaDescription="No credit card. Tidak akan pernah."
		primaryHref="/sign-up"
		primaryLabel="Buat akun gratis"
		secondaryHref="/sign-in"
		secondaryLabel="Saya sudah punya akun"
	/>
</div>

<style>
	.landing :global(.footer-glass-pill) {
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
