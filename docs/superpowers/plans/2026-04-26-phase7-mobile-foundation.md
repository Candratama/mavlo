# Phase 7 Implementation Plan (Mobile Foundation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Make Mavlo usable on phones. Mobile nav (bottom tab bar + hamburger sheet for secondary). Responsive tables (card-list under `md`). Currency-aware money input (Rupiah display, cents storage). Bigger touch targets. Safe-area insets.

**Architecture:** Existing `(app)/+layout.svelte` keeps the desktop sidebar; below `md` it hides and a bottom tab bar takes over. Tables get a sibling card-list layout for `<md` views. A reusable `<MoneyInput>` component handles localized number entry → integer cents.

**Conventions:**

- `<NEW_REPO>` = `/Users/candratama/Project/WebDev/mavlo`
- Branch: `main` (greenfield, branch strategy A)
- Mobile breakpoint: `md` (768px) — same as Tailwind default
- Touch target floor: 44px (Apple HIG); use `size-11` Tailwind utility

---

## Task 1: Mobile Navigation (Bottom Tab Bar + Drawer Sheet)

**Files:**

- Modify: `<NEW_REPO>/src/routes/(app)/+layout.svelte`

Strategy:

- Desktop (`≥md`): keep existing sidebar; header gets a brand mark too for parity
- Mobile (`<md`): no sidebar; header shows hamburger + brand + sign-out
- Mobile bottom: fixed-position tab bar with the 5 most-used routes (Dashboard, Transactions, Accounts, Budgets, Settings — drop Categories from primary; it's still in the hamburger sheet)
- Hamburger opens a `Sheet` (left side) with full nav incl. Categories

- [ ] **Step 1: Install `sheet`**

```bash
cd /Users/candratama/Project/WebDev/mavlo
./node_modules/.bin/shadcn-svelte add sheet --yes
```

If sheet asks about overwrites, answer No to keep existing components.

- [ ] **Step 2: Replace `src/routes/(app)/+layout.svelte`**

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import {
		LayoutDashboard,
		ArrowLeftRight,
		Wallet,
		Tag,
		PiggyBank,
		Settings,
		Coins,
		LogOut,
		Menu
	} from 'lucide-svelte';

	let { children, data } = $props();

	let mobileNavOpen = $state(false);

	const primaryNav = [
		{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/transactions', label: 'Tx', longLabel: 'Transactions', icon: ArrowLeftRight },
		{ href: '/accounts', label: 'Accounts', icon: Wallet },
		{ href: '/budgets', label: 'Budgets', icon: PiggyBank },
		{ href: '/settings', label: 'Settings', icon: Settings }
	];

	const allNav = [
		{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
		{ href: '/accounts', label: 'Accounts', icon: Wallet },
		{ href: '/categories', label: 'Categories', icon: Tag },
		{ href: '/budgets', label: 'Budgets', icon: PiggyBank },
		{ href: '/settings', label: 'Settings', icon: Settings }
	];

	const isActive = (href: string) =>
		page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

<svelte:head><title>Mavlo</title></svelte:head>

<div class="bg-background flex min-h-screen">
	<!-- Desktop sidebar -->
	<aside
		class="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-60 flex-col border-r p-4 md:flex"
	>
		<div class="mb-6 flex items-center gap-2">
			<Coins class="text-primary h-5 w-5" />
			<h1 class="text-primary text-xl font-bold">Mavlo</h1>
		</div>
		<nav class="flex-1 space-y-1 text-sm">
			{#each allNav as item}
				<a
					href={item.href}
					class="flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors {isActive(
						item.href
					)
						? 'bg-accent text-accent-foreground font-medium'
						: 'text-sidebar-foreground hover:bg-accent/50 hover:text-accent-foreground'}"
				>
					<item.icon class="h-4 w-4 shrink-0" />
					{item.label}
				</a>
			{/each}
		</nav>
	</aside>

	<main class="flex min-w-0 flex-1 flex-col">
		<header
			class="bg-background flex items-center justify-between gap-3 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]
				sm:px-6"
		>
			<!-- Mobile brand + hamburger -->
			<div class="flex items-center gap-2 md:hidden">
				<Sheet.Root bind:open={mobileNavOpen}>
					<Sheet.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="ghost"
								size="icon"
								class="size-11"
								aria-label="Open navigation"
							>
								<Menu class="h-5 w-5" />
							</Button>
						{/snippet}
					</Sheet.Trigger>
					<Sheet.Content side="left" class="w-64 p-4">
						<Sheet.Header class="mb-4 text-left">
							<Sheet.Title class="flex items-center gap-2">
								<Coins class="text-primary h-5 w-5" />
								<span class="text-primary">Mavlo</span>
							</Sheet.Title>
						</Sheet.Header>
						<nav class="space-y-1 text-sm">
							{#each allNav as item}
								<a
									href={item.href}
									onclick={() => (mobileNavOpen = false)}
									class="flex items-center gap-2.5 rounded-md px-3 py-3 transition-colors {isActive(
										item.href
									)
										? 'bg-accent text-accent-foreground font-medium'
										: 'text-sidebar-foreground hover:bg-accent/50 hover:text-accent-foreground'}"
								>
									<item.icon class="h-4 w-4 shrink-0" />
									{item.label}
								</a>
							{/each}
						</nav>
					</Sheet.Content>
				</Sheet.Root>
				<div class="flex items-center gap-1.5">
					<Coins class="text-primary h-5 w-5" />
					<span class="text-primary text-base font-bold">Mavlo</span>
				</div>
			</div>

			<span class="text-muted-foreground hidden text-sm md:inline">Hi, {data.user.name}</span>

			<form method="POST" action="/sign-out">
				<Button type="submit" variant="ghost" size="sm" class="h-9 gap-1.5 sm:h-8">
					<LogOut class="h-4 w-4" />
					<span class="hidden sm:inline">Sign out</span>
				</Button>
			</form>
		</header>

		<div
			class="flex-1 overflow-x-hidden p-3 pb-[max(5rem,calc(env(safe-area-inset-bottom)+5rem))] sm:p-4 md:p-6 md:pb-6"
		>
			{@render children()}
		</div>
	</main>

	<!-- Mobile bottom tab bar -->
	<nav
		class="bg-background fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)]
			md:hidden"
	>
		<ul class="grid grid-cols-5">
			{#each primaryNav as item}
				<li>
					<a
						href={item.href}
						class="flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium {isActive(
							item.href
						)
							? 'text-primary'
							: 'text-muted-foreground'}"
					>
						<item.icon class="h-5 w-5" />
						<span>{item.label}</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</div>
```

- [ ] **Step 3: Type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/(routes/\\(app\\)/\\+layout|lib/components/ui/sheet)" || echo "no errors"
git add -A "src/routes/(app)/+layout.svelte" src/lib/components/ui/sheet
git commit -m "feat(mobile): bottom tab bar + hamburger sheet for mobile nav"
```

---

## Task 2: Money Input Component

**Files:**

- Create: `<NEW_REPO>/src/lib/components/forms/money-input.svelte`
- Create: `<NEW_REPO>/src/lib/components/forms/money-input.test.ts` (logic-only test for parsing/formatting)
- Create: `<NEW_REPO>/src/lib/utils/money.ts`
- Create: `<NEW_REPO>/src/lib/utils/money.test.ts`

UX: shows formatted Rupiah ("50.000") in the display field. Submits the underlying integer cents via a hidden field with the original `name`.

For Indonesian formatting:

- Input visible: "50.000" (no decimals, dot thousands separator)
- Stored: `5000000` cents (Rp 50.000.00)

- [ ] **Step 1: Write failing tests**

`src/lib/utils/money.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseRupiahToCents, formatCentsToRupiah, formatCentsAsCurrency } from './money';

describe('parseRupiahToCents', () => {
	it('parses dot-separated thousands', () => {
		expect(parseRupiahToCents('50.000')).toBe(5_000_000);
		expect(parseRupiahToCents('1.234.567')).toBe(123_456_700);
	});

	it('parses bare integers', () => {
		expect(parseRupiahToCents('500')).toBe(50_000);
		expect(parseRupiahToCents('0')).toBe(0);
	});

	it('strips currency prefix and trims', () => {
		expect(parseRupiahToCents('Rp 50.000')).toBe(5_000_000);
		expect(parseRupiahToCents('  Rp50.000  ')).toBe(5_000_000);
	});

	it('returns null on bad input', () => {
		expect(parseRupiahToCents('')).toBeNull();
		expect(parseRupiahToCents('abc')).toBeNull();
		expect(parseRupiahToCents('-100')).toBeNull();
	});
});

describe('formatCentsToRupiah', () => {
	it('formats cents to dot-separated thousands (no Rp prefix)', () => {
		expect(formatCentsToRupiah(5_000_000)).toBe('50.000');
		expect(formatCentsToRupiah(0)).toBe('0');
		expect(formatCentsToRupiah(123_456_700)).toBe('1.234.567');
	});
});

describe('formatCentsAsCurrency', () => {
	it('renders with Rp prefix and locale separator', () => {
		expect(formatCentsAsCurrency(5_000_000, 'IDR')).toMatch(/Rp\s?50\.000/);
	});
});
```

- [ ] **Step 2: Run (FAIL)**

- [ ] **Step 3: Create `src/lib/utils/money.ts`**

```typescript
/**
 * Parse a user-entered Rupiah string to integer cents (1 IDR = 100 cents in our schema).
 * Accepts: "50.000", "Rp 50.000", "500", "0", with surrounding whitespace.
 * Returns null on invalid / negative input.
 */
export function parseRupiahToCents(input: string): number | null {
	if (typeof input !== 'string') return null;
	const cleaned = input
		.trim()
		.replace(/^Rp\s?/i, '')
		.trim();
	if (cleaned === '') return null;
	if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(cleaned)) return null;
	const digits = cleaned.replace(/\./g, '');
	const value = Number(digits);
	if (!Number.isFinite(value) || value < 0) return null;
	return value * 100;
}

/**
 * Format integer cents to dot-separated thousands without "Rp" prefix
 * (for in-input display).
 */
export function formatCentsToRupiah(cents: number): string {
	const rupiah = Math.trunc(cents / 100);
	return rupiah.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Full currency formatting (with Rp / locale).
 */
export function formatCentsAsCurrency(cents: number, currency: string): string {
	return new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency,
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(cents / 100);
}
```

- [ ] **Step 4: Run (PASS)**

- [ ] **Step 5: Create `src/lib/components/forms/money-input.svelte`**

```svelte
<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { formatCentsToRupiah, parseRupiahToCents } from '$lib/utils/money.js';

	type Props = {
		/** Form field name; submits as integer cents. */
		name: string;
		/** Initial value in cents. */
		value?: number | null;
		required?: boolean;
		min?: number;
		id?: string;
		placeholder?: string;
		class?: string;
	};

	let {
		name,
		value = null,
		required = false,
		min = 0,
		id,
		placeholder = '0',
		class: className = ''
	}: Props = $props();

	let display = $state(value !== null && value !== undefined ? formatCentsToRupiah(value) : '');

	const cents = $derived(parseRupiahToCents(display));

	function reformat() {
		if (cents === null) return;
		display = formatCentsToRupiah(cents);
	}

	function onInput(e: Event) {
		const raw = (e.currentTarget as HTMLInputElement).value;
		// Strip non-digit + non-dot chars, allow user to type freely
		const cleaned = raw.replace(/[^\d.]/g, '');
		display = cleaned;
	}
</script>

<div class="relative">
	<span
		class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
	>
		Rp
	</span>
	<Input
		{id}
		type="text"
		inputmode="numeric"
		autocomplete="off"
		value={display}
		oninput={onInput}
		onblur={reformat}
		{placeholder}
		{required}
		class="pl-9 tabular-nums {className}"
	/>
	<input type="hidden" {name} value={cents ?? ''} />
	{#if required && cents === null && display !== ''}
		<p class="text-destructive mt-1 text-xs">Invalid amount</p>
	{:else if min !== undefined && cents !== null && cents < min}
		<p class="text-destructive mt-1 text-xs">Min Rp {formatCentsToRupiah(min)}</p>
	{/if}
</div>
```

- [ ] **Step 6: Type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/lib/(utils/money|components/forms)" || echo "no errors"
git add src/lib/utils/money.ts src/lib/utils/money.test.ts src/lib/components/forms/
git commit -m "feat(forms): MoneyInput + parse/format utilities for Rupiah ↔ cents"
```

---

## Task 3: Wire MoneyInput Into All Money Forms

**Files:**

- Modify: accounts (initialBalanceCents), transactions (amountCents), budgets (limitCents)

Replace plain `<Input type="number" name="...Cents" />` with `<MoneyInput name="..." value={...} />` in each create + edit dialog.

- [ ] **Step 1: Update `src/routes/(app)/accounts/+page.svelte`** — replace `Initial balance (cents)` Input in both dialogs with `<MoneyInput name="initialBalanceCents" value={editTarget?.initialBalanceCents} required />`. Update labels to "Initial balance".

- [ ] **Step 2: Update `src/routes/(app)/transactions/+page.svelte`** — replace `Amount (cents)` in both dialogs with `<MoneyInput name="amountCents" value={editTarget?.amountCents} required min={1} />`. Label: "Amount".

- [ ] **Step 3: Update `src/routes/(app)/budgets/+page.svelte`** — replace `Limit (cents)` in both dialogs with `<MoneyInput name="limitCents" required min={1} />` (create) and `value={editTarget?.limitCents}` (edit). Label: "Limit".

- [ ] **Step 4: Type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/routes/\\(app\\)/(accounts|transactions|budgets)" || echo "no errors"
git add "src/routes/(app)/accounts/" "src/routes/(app)/transactions/" "src/routes/(app)/budgets/"
git commit -m "feat(forms): use MoneyInput in accounts/transactions/budgets dialogs"
```

---

## Task 4: Responsive Tables (Card-List Below `md`)

**Files:**

- Modify: accounts, categories, transactions, budgets pages

Strategy: same data renders twice — `<Table>` for `≥md`, `<ul>` of cards for `<md`. Both share data + actions; only layout differs.

For transactions (most complex): the card view shows date+kind+amount on top row, account+category+note on second row, dropdown menu to the right.

For accounts/categories/budgets: similar card-list pattern.

This is mechanical work. The pattern:

```svelte
<div class="hidden md:block">
	<!-- existing table -->
</div>
<ul class="md:hidden space-y-2">
	{#each items as item (item.id)}
		<li class="rounded-lg border bg-card p-3 flex items-start gap-3">
			<!-- summary content -->
			<DropdownMenu...>
		</li>
	{/each}
</ul>
```

- [ ] **Step 1: Add card-list to accounts** — for each account, show name (font-medium), type+currency line (muted text-xs), formatted balance on the right. Same dropdown menu (bigger touch target on mobile via `class="size-11 md:size-8"` on the trigger button).

- [ ] **Step 2: Add card-list to categories** — name, kind+color swatch line, dropdown menu.

- [ ] **Step 3: Add card-list to transactions** — line 1: date · kind (colored) · amount (right-aligned, signed). Line 2: account → optional dest (transfer) · category · note (truncated). Dropdown menu.

- [ ] **Step 4: Add card-list to budgets** — already a card grid! Just adjust the existing grid: switch from `md:grid-cols-2` to `grid-cols-1 md:grid-cols-2` (it already is — confirm). Verify each card stacks cleanly on mobile.

- [ ] **Step 5: Bigger touch targets on dropdown triggers**

For each `<DropdownMenu.Trigger>` button using `class="size-8"`, change to `class="size-11 md:size-8"`.

- [ ] **Step 6: Type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/routes/\\(app\\)/(accounts|categories|transactions|budgets)" || echo "no errors"
git add "src/routes/(app)/"
git commit -m "feat(mobile): card-list layout below md for accounts/categories/transactions"
```

---

## Task 5: Mobile-Friendly Filter Bar (Transactions)

**Files:**

- Modify: `<NEW_REPO>/src/routes/(app)/transactions/+page.svelte`

Current: `grid-cols-2 md:grid-cols-6` — 5 fields cramped 2-up on mobile. Better: collapsible filter sheet on mobile (button "Filters" opens a sheet with the form), inline grid on desktop.

OR simpler: stack filters single-column on mobile with collapsible disclosure ("Show filters" button). Still keep date inputs visible since they're most-used.

Cleanest: just stack the filters vertically on mobile (`grid-cols-1 md:grid-cols-6`). 5 inputs stacked is fine — better than cramped 2-up.

- [ ] **Step 1: Change filter grid to `grid-cols-1 md:grid-cols-6`**

In `+page.svelte`, find the filter form and update:

```svelte
<form method="GET" class="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
```

The Apply button should be `class="w-full md:w-auto"` (it already is per current code; verify).

- [ ] **Step 2: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add "src/routes/(app)/transactions/+page.svelte"
git commit -m "feat(mobile): stack transactions filter inputs vertically on mobile"
```

---

## Task 6: Currency Display Updates Across Pages

The dashboard, transactions, accounts, budgets all use `Intl.NumberFormat('id-ID', { ... minimumFractionDigits: 0 })` which renders as "Rp 50.000". Fine. But some places may need cleanup (e.g., budget card balance shows divided cents).

Audit pass: confirm every `formatCents` / `formatAmount` / `formatBalance` call uses `minimumFractionDigits: 0` AND `maximumFractionDigits: 0` (currently some only specify `minimum`, which lets fractional cents render). Fix any lapses.

Use the new `formatCentsAsCurrency` helper from `src/lib/utils/money.ts` (Task 2) to unify.

- [ ] **Step 1: Replace inline `Intl.NumberFormat(...)` calls** with `formatCentsAsCurrency` in:
  - `src/routes/(app)/dashboard/+page.svelte`
  - `src/routes/(app)/transactions/+page.svelte`
  - `src/routes/(app)/accounts/+page.svelte`
  - `src/routes/(app)/budgets/+page.svelte`
  - `src/lib/components/charts/SpendingByCategoryChart.svelte` (if it has one)
  - any other `.svelte` using `Intl.NumberFormat`

- [ ] **Step 2: Type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/(routes|lib/components/charts)" || echo "no errors"
git add -A src/routes src/lib/components
git commit -m "refactor(currency): use formatCentsAsCurrency across pages for consistency"
```

---

## Task 7: Build + Smoke + Deploy

- [ ] **Step 1: Build**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run build 2>&1 | tail -10
```

- [ ] **Step 2: Local preview smoke**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run preview > /tmp/mavlo-preview.log 2>&1 &
PREVIEW_PID=$!
sleep 8
curl -sI http://localhost:4173/dashboard | head -3
curl -s http://localhost:4173/api/health
kill $PREVIEW_PID 2>/dev/null
sleep 2
```

- [ ] **Step 3: Deploy**

```bash
cd /Users/candratama/Project/WebDev/mavlo
./node_modules/.bin/wrangler deploy 2>&1 | tail -10
```

Capture new Version ID.

- [ ] **Step 4: Manual mobile e2e (user-run)**

User opens https://mavlo.wahyucandratama.workers.dev on phone. Verify:

- Bottom tab bar shows 5 tabs, active tab highlighted
- Hamburger opens sheet with full nav incl. Categories
- Pages no horizontal scroll
- Money inputs accept "50.000" naturally
- Dropdown menus easy to tap
- Sign out works from header

---

## Phase 7 Done When

- [ ] Mobile bottom tab bar works
- [ ] Hamburger drawer works
- [ ] Tables collapse to card-lists `<md`
- [ ] MoneyInput accepts Rupiah, stores cents
- [ ] All money forms use MoneyInput
- [ ] Filter bar stacks on mobile
- [ ] Touch targets ≥44px on mobile, ≤32px on desktop
- [ ] Safe-area insets honored on iOS
- [ ] Tests pass; build clean; deployed
