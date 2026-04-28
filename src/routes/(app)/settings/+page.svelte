<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { setMode } from 'mode-watcher';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { Sun, Moon, Monitor, LogOut, User as UserIcon, Mail, Loader2 } from 'lucide-svelte';
	import { notify } from '$lib/utils/toast.js';
	import SegmentedControl, {
		type SegmentedOption
	} from '$lib/components/ui/segmented-control.svelte';
	import PickerSheet, { type PickerItem } from '$lib/components/ui/picker-sheet.svelte';
	import { Smartphone, Download, Share, Check } from 'lucide-svelte';
	import {
		getPwaInstallState,
		triggerInstall,
		isIOS,
		isStandalone
	} from '$lib/stores/pwa-install.svelte.js';

	let { data } = $props();
	const prefs = $derived(data.preferences);

	let saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let formEl: HTMLFormElement | undefined = $state();
	let savedTimer: ReturnType<typeof setTimeout> | null = null;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let prefsInitialized = false;

	const currencyItems: PickerItem[] = [
		{ value: 'IDR', label: 'IDR', description: 'Indonesian Rupiah' },
		{ value: 'USD', label: 'USD', description: 'US Dollar' },
		{ value: 'EUR', label: 'EUR', description: 'Euro' },
		{ value: 'SGD', label: 'SGD', description: 'Singapore Dollar' },
		{ value: 'MYR', label: 'MYR', description: 'Malaysian Ringgit' },
		{ value: 'JPY', label: 'JPY', description: 'Japanese Yen' },
		{ value: 'GBP', label: 'GBP', description: 'British Pound' },
		{ value: 'AUD', label: 'AUD', description: 'Australian Dollar' },
		{ value: 'CNY', label: 'CNY', description: 'Chinese Yuan' },
		{ value: 'KRW', label: 'KRW', description: 'Korean Won' },
		{ value: 'THB', label: 'THB', description: 'Thai Baht' },
		{ value: 'HKD', label: 'HKD', description: 'Hong Kong Dollar' },
		{ value: 'PHP', label: 'PHP', description: 'Philippine Peso' },
		{ value: 'VND', label: 'VND', description: 'Vietnamese Dong' },
		{ value: 'INR', label: 'INR', description: 'Indian Rupee' },
		{ value: 'CHF', label: 'CHF', description: 'Swiss Franc' },
		{ value: 'CAD', label: 'CAD', description: 'Canadian Dollar' },
		{ value: 'NZD', label: 'NZD', description: 'New Zealand Dollar' }
	];

	const localeItems: PickerItem[] = [
		{ value: 'id-ID', label: 'id-ID', description: 'Indonesian (Indonesia)' },
		{ value: 'en-US', label: 'en-US', description: 'English (US)' },
		{ value: 'en-GB', label: 'en-GB', description: 'English (UK)' },
		{ value: 'en-AU', label: 'en-AU', description: 'English (Australia)' },
		{ value: 'en-SG', label: 'en-SG', description: 'English (Singapore)' },
		{ value: 'ms-MY', label: 'ms-MY', description: 'Malay (Malaysia)' },
		{ value: 'ja-JP', label: 'ja-JP', description: 'Japanese (Japan)' },
		{ value: 'zh-CN', label: 'zh-CN', description: 'Chinese (China)' },
		{ value: 'zh-HK', label: 'zh-HK', description: 'Chinese (Hong Kong)' },
		{ value: 'ko-KR', label: 'ko-KR', description: 'Korean (Korea)' },
		{ value: 'th-TH', label: 'th-TH', description: 'Thai (Thailand)' },
		{ value: 'vi-VN', label: 'vi-VN', description: 'Vietnamese (Vietnam)' },
		{ value: 'fr-FR', label: 'fr-FR', description: 'French (France)' },
		{ value: 'de-DE', label: 'de-DE', description: 'German (Germany)' },
		{ value: 'es-ES', label: 'es-ES', description: 'Spanish (Spain)' },
		{ value: 'pt-BR', label: 'pt-BR', description: 'Portuguese (Brazil)' }
	];

	const timezoneItems: PickerItem[] = [
		{ value: 'Asia/Jakarta', label: 'Asia/Jakarta', description: 'WIB · UTC+7' },
		{ value: 'Asia/Makassar', label: 'Asia/Makassar', description: 'WITA · UTC+8' },
		{ value: 'Asia/Jayapura', label: 'Asia/Jayapura', description: 'WIT · UTC+9' },
		{ value: 'Asia/Singapore', label: 'Asia/Singapore', description: 'UTC+8' },
		{ value: 'Asia/Kuala_Lumpur', label: 'Asia/Kuala_Lumpur', description: 'UTC+8' },
		{ value: 'Asia/Bangkok', label: 'Asia/Bangkok', description: 'UTC+7' },
		{ value: 'Asia/Manila', label: 'Asia/Manila', description: 'UTC+8' },
		{ value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong', description: 'UTC+8' },
		{ value: 'Asia/Tokyo', label: 'Asia/Tokyo', description: 'UTC+9' },
		{ value: 'Asia/Seoul', label: 'Asia/Seoul', description: 'UTC+9' },
		{ value: 'Asia/Shanghai', label: 'Asia/Shanghai', description: 'UTC+8' },
		{ value: 'Asia/Taipei', label: 'Asia/Taipei', description: 'UTC+8' },
		{ value: 'Asia/Kolkata', label: 'Asia/Kolkata', description: 'UTC+5:30' },
		{ value: 'Asia/Dubai', label: 'Asia/Dubai', description: 'UTC+4' },
		{ value: 'Australia/Sydney', label: 'Australia/Sydney', description: 'UTC+10/+11' },
		{ value: 'Australia/Perth', label: 'Australia/Perth', description: 'UTC+8' },
		{ value: 'Pacific/Auckland', label: 'Pacific/Auckland', description: 'UTC+12/+13' },
		{ value: 'UTC', label: 'UTC', description: 'Coordinated Universal Time' },
		{ value: 'Europe/London', label: 'Europe/London', description: 'UTC+0/+1' },
		{ value: 'Europe/Paris', label: 'Europe/Paris', description: 'UTC+1/+2' },
		{ value: 'Europe/Berlin', label: 'Europe/Berlin', description: 'UTC+1/+2' },
		{ value: 'Europe/Amsterdam', label: 'Europe/Amsterdam', description: 'UTC+1/+2' },
		{ value: 'America/New_York', label: 'America/New_York', description: 'UTC-5/-4' },
		{ value: 'America/Chicago', label: 'America/Chicago', description: 'UTC-6/-5' },
		{ value: 'America/Denver', label: 'America/Denver', description: 'UTC-7/-6' },
		{ value: 'America/Los_Angeles', label: 'America/Los_Angeles', description: 'UTC-8/-7' },
		{ value: 'America/Toronto', label: 'America/Toronto', description: 'UTC-5/-4' },
		{ value: 'America/Sao_Paulo', label: 'America/Sao_Paulo', description: 'UTC-3' }
	];

	let selectedCurrency = $state<string>(prefs.currency ?? 'IDR');
	let selectedLocale = $state<string>(prefs.locale ?? 'id-ID');
	let selectedTimezone = $state<string>(prefs.timezone ?? 'Asia/Jakarta');

	type Theme = 'light' | 'dark' | 'system';
	let selectedTheme = $state<Theme>(prefs.theme as Theme);

	const themeOptions: SegmentedOption[] = [
		{ value: 'light', label: 'Light', icon: Sun },
		{ value: 'dark', label: 'Dark', icon: Moon },
		{ value: 'system', label: 'System', icon: Monitor }
	];

	let selectedWeekStart = $state<string>(String(prefs.weekStartsOn ?? 1));

	const weekStartOptions: SegmentedOption[] = [
		{ value: '0', label: 'Su' },
		{ value: '1', label: 'Mo' },
		{ value: '2', label: 'Tu' },
		{ value: '3', label: 'We' },
		{ value: '4', label: 'Th' },
		{ value: '5', label: 'Fr' },
		{ value: '6', label: 'Sa' }
	];

	let selectedMonthStartDay = $state<number>(prefs.monthStartDay ?? 1);
	const cycleDays = Array.from({ length: 31 }, (_, i) => i + 1);

	$effect(() => {
		const t = selectedTheme;
		untrack(() => setMode(t as Theme));
	});

	$effect(() => {
		// Track all preference fields
		void selectedCurrency;
		void selectedLocale;
		void selectedTimezone;
		void selectedTheme;
		void selectedWeekStart;
		void selectedMonthStartDay;

		if (!prefsInitialized) {
			prefsInitialized = true;
			return;
		}

		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			formEl?.requestSubmit();
		}, 600);
	});

	const pwa = getPwaInstallState();
	let iosDevice = $state(false);
	let alreadyInstalled = $state(false);

	$effect(() => {
		iosDevice = isIOS();
		alreadyInstalled = isStandalone();
	});

	async function onInstall() {
		const result = await triggerInstall();
		if (result === 'accepted') {
			notify.success('App installed');
		} else if (result === 'dismissed') {
			notify.info('Install dismissed');
		}
	}
</script>

<svelte:head><title>Settings — Mavlo</title></svelte:head>

<h1 class="mavlo-headline mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>

<div class="grid max-w-6xl gap-6 lg:grid-cols-[3fr_7fr]">
	<div class="space-y-6">
		<!-- Account -->
		<Card.Root>
		<Card.Header>
			<Card.Title>Account</Card.Title>
			<Card.Description>Your profile picture, identity, and session.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-5">
			<div class="flex items-center gap-4">
				{#if data.user.image}
					<img
						src={data.user.image}
						alt="Current avatar"
						class="size-16 shrink-0 rounded-full border object-cover"
					/>
				{:else}
					<div
						class="bg-muted flex size-16 shrink-0 items-center justify-center rounded-full border"
					>
						<UserIcon class="text-muted-foreground size-7" />
					</div>
				{/if}
				<div class="min-w-0 flex-1">
					<div class="truncate font-medium">{data.user.name ?? '—'}</div>
					<div class="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
						<Mail class="size-3.5 shrink-0" />
						<span class="truncate">{data.user.email}</span>
					</div>
					{#if data.user.username}
						<div class="text-muted-foreground mt-0.5 truncate text-xs">@{data.user.username}</div>
					{/if}
				</div>
			</div>

			<div class="space-y-2">
				<Label for="username-input" class="text-muted-foreground text-xs tracking-wider uppercase">
					Username
				</Label>
				<form
					method="POST"
					action="?/username"
					use:enhance={() => {
						return async ({ result, update }) => {
							await update();
							if (result.type === 'success') {
								notify.success('Username updated');
							} else if (result.type === 'failure') {
								const msg = (result.data as { usernameError?: string } | undefined)?.usernameError;
								notify.error(msg ?? 'Could not update username');
							}
						};
					}}
					class="flex items-center gap-2"
				>
					<Input
						id="username-input"
						name="username"
						placeholder={data.user.username ?? 'your_username'}
						maxlength={30}
						required
					/>
					<Button type="submit">Save</Button>
				</form>
				<p class="text-muted-foreground text-xs">
					3–30 characters, letters, numbers, dot, underscore.
				</p>
			</div>

			<div class="space-y-2">
				<Label class="text-muted-foreground text-xs tracking-wider uppercase">Profile picture</Label
				>
				<form
					method="POST"
					action="/settings/avatar"
					enctype="multipart/form-data"
					class="flex items-center gap-2"
				>
					<Input
						type="file"
						name="avatar"
						accept="image/png,image/jpeg,image/webp,image/gif"
						required
					/>
					<Button type="submit">Upload</Button>
				</form>
				<p class="text-muted-foreground text-xs">PNG, JPEG, WebP, or GIF; max 2 MB.</p>
			</div>

			<div class="border-t pt-4">
				<form method="POST" action="/sign-out">
					<Button type="submit" variant="outline" class="text-destructive w-full sm:w-auto">
						<LogOut class="mr-1.5 size-4" /> Sign out
					</Button>
				</form>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Install -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Install app</Card.Title>
			<Card.Description>Add Mavlo to your home screen for an app-like experience.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if alreadyInstalled}
				<div class="text-income flex items-center gap-2 text-sm">
					<Check class="size-4" /> Already installed
				</div>
			{:else if pwa.canInstall}
				<Button onclick={onInstall}>
					<Download class="mr-1.5 size-4" /> Install Mavlo
				</Button>
				<p class="text-muted-foreground mt-2 text-xs">
					Adds Mavlo to your home screen / app drawer.
				</p>
			{:else if iosDevice}
				<div class="space-y-2 text-sm">
					<p class="text-muted-foreground flex items-center gap-2">
						<Smartphone class="size-4" /> On iOS Safari, tap <Share class="size-4" /> Share, then
						<strong class="text-foreground">Add to Home Screen</strong>.
					</p>
				</div>
			{:else}
				<p class="text-muted-foreground text-sm">
					Open Mavlo in Chrome / Edge / Safari. Browser will offer the install option when ready.
				</p>
			{/if}
		</Card.Content>
	</Card.Root>
	</div>

	<div class="space-y-6">
	<!-- Preferences (general + cycle in one form) -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Preferences</Card.Title>
			<Card.Description>Currency, locale, timezone, theme, and cycle.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				bind:this={formEl}
				method="POST"
				action="?/prefs"
				use:enhance={() => {
					saveState = 'saving';
					if (savedTimer) clearTimeout(savedTimer);
					return async ({ result }) => {
						if (result.type === 'success') {
							saveState = 'saved';
							savedTimer = setTimeout(() => {
								if (saveState === 'saved') saveState = 'idle';
							}, 1500);
						} else if (result.type === 'failure') {
							saveState = 'error';
							const message = (result.data as { message?: string } | undefined)?.message;
							notify.error(message ?? 'Could not save preferences');
						}
					};
				}}
				class="space-y-6"
			>
				<section class="space-y-4">
					<h2 class="text-muted-foreground text-xs tracking-wider uppercase">General</h2>
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<Label>Default currency</Label>
							<PickerSheet
								items={currencyItems}
								bind:value={selectedCurrency}
								name="currency"
								placeholder="Select currency"
								title="Currency"
								searchable
							/>
						</div>
						<div class="space-y-1">
							<Label>Locale</Label>
							<PickerSheet
								items={localeItems}
								bind:value={selectedLocale}
								name="locale"
								placeholder="Select locale"
								title="Locale"
								searchable
							/>
						</div>
					</div>
					<div class="space-y-1">
						<Label>Timezone</Label>
						<PickerSheet
							items={timezoneItems}
							bind:value={selectedTimezone}
							name="timezone"
							placeholder="Select timezone"
							title="Timezone"
							searchable
						/>
					</div>
					<div class="space-y-1">
						<Label>Theme</Label>
						<SegmentedControl options={themeOptions} bind:value={selectedTheme} name="theme" />
					</div>
				</section>

				<section class="space-y-4 border-t pt-5">
					<h2 class="text-muted-foreground text-xs tracking-wider uppercase">Cycle</h2>
					<div class="space-y-1">
						<Label>Week starts on</Label>
						<SegmentedControl
							options={weekStartOptions}
							bind:value={selectedWeekStart}
							name="weekStartsOn"
						/>
					</div>
					<div class="space-y-2">
						<Label>Cycle start (e.g. payday)</Label>
						<div class="bg-muted grid grid-cols-7 gap-1.5 rounded-lg p-2">
							{#each cycleDays as d (d)}
								<button
									type="button"
									onclick={() => (selectedMonthStartDay = d)}
									class="h-9 rounded-md text-sm tabular-nums transition-colors {selectedMonthStartDay ===
									d
										? 'bg-primary text-primary-foreground font-semibold'
										: 'hover:bg-background text-foreground'}"
									aria-pressed={selectedMonthStartDay === d}
								>
									{d}
								</button>
							{/each}
						</div>
						<input type="hidden" name="monthStartDay" value={selectedMonthStartDay} />
						<p class="text-muted-foreground text-xs">
							Day 1 = calendar month. Day 25 = your month runs 25th to 24th. Affects current and
							future periods.
						</p>
					</div>
				</section>

				<div class="flex h-5 items-center justify-end border-t pt-4 text-xs">
					{#if saveState === 'saving'}
						<span class="text-muted-foreground inline-flex items-center gap-1.5">
							<Loader2 class="size-3.5 animate-spin" /> Saving…
						</span>
					{:else if saveState === 'saved'}
						<span class="text-income inline-flex items-center gap-1.5">
							<Check class="size-3.5" /> Saved
						</span>
					{:else if saveState === 'error'}
						<span class="text-destructive">Could not save — try again</span>
					{:else}
						<span class="text-muted-foreground">Changes save automatically</span>
					{/if}
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	</div>
</div>
