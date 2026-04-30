<script lang="ts">
	import { enhance } from '$app/forms';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import MoneyInput from '$lib/components/forms/money-input.svelte';
	import SegmentedControl from '$lib/components/ui/segmented-control.svelte';
	import { getIconByName } from '$lib/utils/category-icons.js';
	import {
		Coins,
		Landmark,
		CreditCard,
		Wallet,
		PiggyBank,
		CircleEllipsis,
		Check,
		ArrowRight,
		ArrowLeft,
		Sparkles
	} from 'lucide-svelte';
	import { cn } from '$lib/utils.js';

	let { data, form } = $props();

	let step = $state<1 | 2 | 3>(1);
	let pending = $state(false);

	let currency = $state('IDR');
	let timezone = $state('Asia/Jakarta');
	let locale = $state('id-ID');

	let accountName = $state('');
	let accountType = $state<'cash' | 'bank' | 'credit' | 'wallet' | 'savings' | 'other'>('cash');
	let initialBalanceCents = $state<number | null>(0);

	const allCategoryNames = $derived(data.defaultCategories.map((c) => c.name));
	let selectedCategories = $state<string[]>(data.defaultCategories.map((c) => c.name));

	function toggleCategory(name: string) {
		selectedCategories = selectedCategories.includes(name)
			? selectedCategories.filter((n) => n !== name)
			: [...selectedCategories, name];
	}

	function selectAll() {
		selectedCategories = [...allCategoryNames];
	}
	function clearAll() {
		selectedCategories = [];
	}

	const accountTypes = [
		{ value: 'cash', label: 'Cash', icon: Coins },
		{ value: 'bank', label: 'Bank', icon: Landmark },
		{ value: 'wallet', label: 'E-wallet', icon: Wallet },
		{ value: 'savings', label: 'Savings', icon: PiggyBank },
		{ value: 'credit', label: 'Kartu', icon: CreditCard },
		{ value: 'other', label: 'Lainnya', icon: CircleEllipsis }
	] as const;

	const currencyOptions = [
		{ value: 'IDR', label: 'IDR' },
		{ value: 'USD', label: 'USD' },
		{ value: 'EUR', label: 'EUR' }
	];

	const canNextFrom2 = $derived(accountName.trim().length > 0);
</script>

<svelte:head><title>Setup — Mavlo</title></svelte:head>

<div class="mb-6 flex items-center justify-between">
	<h1 class="mavlo-headline text-2xl font-black tracking-tight sm:text-3xl">
		{#if step === 1}
			Set preferensi lo
		{:else if step === 2}
			Akun pertama lo
		{:else}
			Pilih kategori
		{/if}
	</h1>
	<span class="text-muted-foreground text-xs font-medium tabular-nums">{step}/3</span>
</div>

<div class="bg-border/40 mb-6 h-1 overflow-hidden rounded-full">
	<div
		class="h-full bg-emerald-400 transition-all duration-300"
		style="width: {(step / 3) * 100}%"
	></div>
</div>

<form
	method="POST"
	use:enhance={() => {
		pending = true;
		return async ({ update }) => {
			await update();
			pending = false;
		};
	}}
	class="space-y-5"
>
	<input type="hidden" name="currency" value={currency} />
	<input type="hidden" name="locale" value={locale} />
	<input type="hidden" name="timezone" value={timezone} />
	<input type="hidden" name="accountName" value={accountName} />
	<input type="hidden" name="accountType" value={accountType} />
	<input type="hidden" name="initialBalanceCents" value={initialBalanceCents ?? 0} />
	<input type="hidden" name="categoryNames" value={selectedCategories.join(',')} />

	{#if step === 1}
		<p class="text-muted-foreground text-sm">
			Default udah di-set buat Indonesia. Lo bisa ubah nanti di Settings.
		</p>

		<div class="space-y-2">
			<Label>Currency</Label>
			<SegmentedControl options={currencyOptions} bind:value={currency} ariaLabel="Currency" />
		</div>

		<div class="space-y-1.5">
			<Label for="locale">Locale</Label>
			<Input id="locale" bind:value={locale} maxlength={20} />
			<p class="text-muted-foreground text-xs">Format tanggal & angka (contoh: id-ID).</p>
		</div>

		<div class="space-y-1.5">
			<Label for="timezone">Timezone</Label>
			<Input id="timezone" bind:value={timezone} maxlength={60} />
			<p class="text-muted-foreground text-xs">Contoh: Asia/Jakarta, Asia/Makassar.</p>
		</div>
	{:else if step === 2}
		<p class="text-muted-foreground text-sm">
			Bikin minimal satu akun (dompet, rekening bank, e-wallet) buat mulai catat.
		</p>

		<div class="space-y-1.5">
			<Label for="account-name">Nama akun</Label>
			<Input
				id="account-name"
				bind:value={accountName}
				placeholder="Cash, BCA, GoPay, dll"
				maxlength={80}
				required
			/>
		</div>

		<div class="space-y-2">
			<Label>Tipe</Label>
			<div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
				{#each accountTypes as t (t.value)}
					{@const Icon = t.icon}
					<button
						type="button"
						onclick={() => (accountType = t.value)}
						class={cn(
							'flex flex-col items-center gap-1 rounded-xl border p-3 text-xs transition-all',
							accountType === t.value
								? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300'
								: 'border-border/60 bg-background/30 text-muted-foreground hover:border-border hover:text-foreground'
						)}
					>
						<Icon class="size-5" />
						<span>{t.label}</span>
					</button>
				{/each}
			</div>
		</div>

		<div class="space-y-1.5">
			<Label>Saldo awal</Label>
			<MoneyInput name="_initialBalanceDisplay" bind:value={initialBalanceCents} placeholder="0" />
			<p class="text-muted-foreground text-xs">Saldo sekarang di akun ini. Boleh 0.</p>
		</div>
	{:else}
		<p class="text-muted-foreground text-sm">
			Pilih kategori yg lo butuh. Bisa edit/tambah lagi nanti.
		</p>

		<div class="flex gap-2">
			<Button type="button" variant="outline" size="sm" onclick={selectAll}>Pilih semua</Button>
			<Button type="button" variant="ghost" size="sm" onclick={clearAll}>Kosongin</Button>
		</div>

		<div class="space-y-2">
			<p class="text-muted-foreground text-xs font-bold tracking-wider uppercase">Pengeluaran</p>
			<div class="grid grid-cols-2 gap-2">
				{#each data.defaultCategories.filter((c) => c.kind === 'expense') as cat (cat.name)}
					{@const Icon = getIconByName(cat.icon)}
					{@const active = selectedCategories.includes(cat.name)}
					<button
						type="button"
						onclick={() => toggleCategory(cat.name)}
						class={cn(
							'flex items-center gap-2 rounded-xl border p-3 text-sm transition-all',
							active
								? 'border-emerald-400/60 bg-emerald-400/10 text-foreground'
								: 'border-border/60 bg-background/30 text-muted-foreground hover:border-border'
						)}
					>
						<span
							class="flex size-7 shrink-0 items-center justify-center rounded-lg"
							style="background-color: {cat.color}20; color: {cat.color}"
						>
							{#if Icon}<Icon class="size-4" />{/if}
						</span>
						<span class="flex-1 text-left">{cat.name}</span>
						{#if active}<Check class="size-4 text-emerald-400" />{/if}
					</button>
				{/each}
			</div>
		</div>

		<div class="space-y-2">
			<p class="text-muted-foreground text-xs font-bold tracking-wider uppercase">Pemasukan</p>
			<div class="grid grid-cols-2 gap-2">
				{#each data.defaultCategories.filter((c) => c.kind === 'income') as cat (cat.name)}
					{@const Icon = getIconByName(cat.icon)}
					{@const active = selectedCategories.includes(cat.name)}
					<button
						type="button"
						onclick={() => toggleCategory(cat.name)}
						class={cn(
							'flex items-center gap-2 rounded-xl border p-3 text-sm transition-all',
							active
								? 'border-emerald-400/60 bg-emerald-400/10 text-foreground'
								: 'border-border/60 bg-background/30 text-muted-foreground hover:border-border'
						)}
					>
						<span
							class="flex size-7 shrink-0 items-center justify-center rounded-lg"
							style="background-color: {cat.color}20; color: {cat.color}"
						>
							{#if Icon}<Icon class="size-4" />{/if}
						</span>
						<span class="flex-1 text-left">{cat.name}</span>
						{#if active}<Check class="size-4 text-emerald-400" />{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if form?.message}
		<p class="text-destructive text-sm">{form.message}</p>
	{/if}

	<div class="flex items-center gap-2 pt-2">
		{#if step > 1}
			<Button
				type="button"
				variant="outline"
				onclick={() => (step = (step - 1) as 1 | 2 | 3)}
				disabled={pending}
			>
				<ArrowLeft class="size-4" />
				Kembali
			</Button>
		{/if}

		{#if step < 3}
			<Button
				type="button"
				class="ml-auto"
				onclick={() => (step = (step + 1) as 1 | 2 | 3)}
				disabled={(step === 2 && !canNextFrom2) || pending}
			>
				Lanjut
				<ArrowRight class="size-4" />
			</Button>
		{:else}
			<SubmitButton {pending} class="lift ml-auto">
				<Sparkles class="size-4" />
				Selesai & masuk dashboard
			</SubmitButton>
		{/if}
	</div>
</form>
