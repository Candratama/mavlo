<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		ArrowRight,
		Wallet,
		PiggyBank,
		BarChart3,
		Smartphone,
		Heart,
		Lock
	} from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { setMode } from 'mode-watcher';

	onMount(() => {
		setMode('dark');
	});

	const features = [
		{
			icon: Wallet,
			title: 'Multi-account',
			body: 'Cash, bank, e-wallet, kartu kredit. Semua saldo di satu tempat.'
		},
		{
			icon: PiggyBank,
			title: 'Budget per kategori',
			body: 'Pasang limit bulanan. Bar progres + warning kalau over.'
		},
		{
			icon: BarChart3,
			title: 'Visualisasi pengeluaran',
			body: 'Donut chart, daily flow, income vs expense 6 bulan.'
		},
		{
			icon: Smartphone,
			title: 'PWA-first, offline-friendly',
			body: 'Install di home screen. Pakai kayak app native, gratis.'
		}
	];
</script>

<svelte:head>
	<title>Mavlo — Lacak Uangmu Tanpa Bayar</title>
	<meta
		name="description"
		content="App pribadi pelacak keuangan. Gratis. Buatan sendiri karena gak mau bayar app sejenis."
	/>
</svelte:head>

<div class="dark min-h-screen w-full bg-[#020617] text-foreground relative">
	<!-- Emerald radial glow -->
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 z-0"
		style="background-image: radial-gradient(circle 500px at 50% 300px, rgba(16,185,129,0.35), transparent);"
	></div>

	<!-- Top bar -->
	<header class="border-b border-border/40 backdrop-blur sticky top-0 z-30 bg-background/80">
		<div class="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<img src="/icon-192.png" alt="Mavlo" class="size-7 rounded-md" />
				<span class="font-bold text-lg text-primary">Mavlo</span>
			</div>
			<div class="flex items-center gap-2">
				<Button variant="ghost" href="/sign-in" size="sm">Sign in</Button>
				<Button href="/sign-up" size="sm">
					Get started <ArrowRight class="size-4 ml-1" />
				</Button>
			</div>
		</div>
	</header>

	<!-- Hero -->
	<section class="px-4 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-20">
		<div class="max-w-3xl mx-auto text-center">
			<p class="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
				Personal · Free · Open
			</p>
			<h1
				class="text-4xl sm:text-6xl font-bold tracking-tight bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent"
			>
				Lacak uangmu tanpa harus bayar.
			</h1>
			<p class="mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed">
				Mavlo lahir dari satu pertanyaan yang sering muncul tiap akhir bulan:
				<span class="text-foreground font-medium">"uangku habis ke mana?"</span>
			</p>
			<div class="mt-8 flex items-center justify-center gap-3 flex-wrap">
				<Button href="/sign-up" size="lg">
					Mulai gratis <ArrowRight class="size-4 ml-1.5" />
				</Button>
				<Button href="/sign-in" variant="outline" size="lg">Saya sudah punya akun</Button>
			</div>
		</div>
	</section>

	<!-- Story -->
	<section class="px-4 sm:px-6 pb-12 sm:pb-20">
		<div class="max-w-3xl mx-auto">
			<div
				class="rounded-2xl border bg-gradient-to-br from-emerald-500/10 via-card to-card p-6 sm:p-10 space-y-5 text-base sm:text-lg leading-relaxed"
			>
				<p class="text-xs uppercase tracking-wider text-muted-foreground">Cerita di balik Mavlo</p>
				<p>
					Aku sering kebingungan tiap akhir bulan. Saldo tinggal sedikit, tapi gak inget
					beli apa aja. Beberapa kali nyoba app pelacak keuangan yang populer — semuanya
					bagus, tapi <span class="text-foreground font-medium">harus bayar</span> buat
					fitur dasar kayak budget per kategori atau export data.
				</p>
				<p>
					Akhirnya aku bikin sendiri. Fokusnya simpel:
					<span class="text-foreground font-medium">catat transaksi cepat</span>,
					<span class="text-foreground font-medium">lihat budget per kategori</span>, dan
					<span class="text-foreground font-medium">grafik pengeluaran</span> yang
					gampang dibaca. Tanpa fitur premium, tanpa iklan.
				</p>
				<p class="text-muted-foreground">
					Kalau Mavlo bantu kamu juga, aku seneng banget. Gunakan sebebasnya.
				</p>
			</div>
		</div>
	</section>

	<!-- Features -->
	<section class="px-4 sm:px-6 pb-12 sm:pb-20">
		<div class="max-w-5xl mx-auto">
			<h2 class="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-10">
				Yang kamu dapat
			</h2>
			<div class="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
				{#each features as f (f.title)}
					<div class="rounded-xl border bg-card p-5 hover:bg-accent/20 transition-colors">
						<div
							class="size-10 rounded-lg bg-primary/15 inline-flex items-center justify-center mb-3"
						>
							<f.icon class="size-5 text-primary" />
						</div>
						<h3 class="font-semibold mb-1.5">{f.title}</h3>
						<p class="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Privacy strip -->
	<section class="px-4 sm:px-6 pb-12 sm:pb-20">
		<div class="max-w-3xl mx-auto">
			<div class="rounded-xl border bg-card p-5 flex items-start gap-3 sm:items-center">
				<div class="size-9 shrink-0 rounded-lg bg-emerald-500/15 flex items-center justify-center">
					<Lock class="size-4 text-emerald-400" />
				</div>
				<p class="text-sm text-muted-foreground">
					Datamu disimpan terisolasi per akun. Tidak dijual, tidak dipakai untuk training,
					tidak dishare ke pihak ketiga.
					<span class="text-foreground">Tujuannya cuma satu: bantu kamu paham keuangan sendiri.</span>
				</p>
			</div>
		</div>
	</section>

	<!-- Donation -->
	<section class="px-4 sm:px-6 pb-12 sm:pb-20">
		<div class="max-w-3xl mx-auto">
			<div
				class="rounded-2xl border bg-gradient-to-br from-rose-500/10 via-card to-card p-6 sm:p-10 text-center"
			>
				<div
					class="size-12 rounded-full bg-rose-500/15 inline-flex items-center justify-center mb-4"
				>
					<Heart class="size-6 text-rose-400" />
				</div>
				<h2 class="text-2xl sm:text-3xl font-bold tracking-tight">Suka Mavlo? Boleh traktir.</h2>
				<p class="mt-3 text-muted-foreground leading-relaxed">
					Mavlo gratis dan akan tetap gratis. Tapi kalau bantu kamu hemat ratusan ribu
					per bulan, dukungan kecil bantu aku bayar server dan tetap waras ngembangin
					fitur baru.
				</p>
				<div class="mt-6 rounded-xl border border-dashed bg-background/50 p-4 text-sm">
					<p class="text-muted-foreground">
						Platform donasi belum ditentukan. Stay tuned —
						<span class="text-foreground">link akan diumumkan di sini</span>.
					</p>
				</div>
				<p class="mt-4 text-xs text-muted-foreground">
					Sementara, kamu bisa share Mavlo ke teman yang lagi pusing soal keuangan.
				</p>
			</div>
		</div>
	</section>

	<!-- Final CTA -->
	<section class="px-4 sm:px-6 pb-16 sm:pb-24">
		<div class="max-w-3xl mx-auto text-center">
			<h2 class="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
				Siap mulai lihat ke mana uangmu pergi?
			</h2>
			<Button href="/sign-up" size="lg">
				Buat akun gratis <ArrowRight class="size-4 ml-1.5" />
			</Button>
			<p class="mt-3 text-xs text-muted-foreground">No credit card. Tidak akan pernah.</p>
		</div>
	</section>

	<!-- Footer -->
	<footer class="border-t border-border/40 px-4 sm:px-6 py-6">
		<div
			class="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground"
		>
			<div class="flex items-center gap-2">
				<img src="/icon-192.png" alt="Mavlo" class="size-5 rounded" />
				<span>Mavlo · Built solo, for solo.</span>
			</div>
			<div class="flex items-center gap-4">
				<a href="/sign-in" class="hover:text-foreground transition-colors">Sign in</a>
				<a href="/sign-up" class="hover:text-foreground transition-colors">Sign up</a>
			</div>
		</div>
	</footer>
</div>
