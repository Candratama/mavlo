# Mavlo Phase 12 Mobile-First UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the design at `docs/superpowers/specs/2026-04-26-phase12-mobile-ux-design.md` — three new shared primitives, mobile-first add/edit-transaction sheet, chip-bar filters, per-page polish, and an adjustable monthly cycle (payday) anchor.

**Architecture:** Foundations first (cycle util, last-used util, primitives), then data layer (DB column + cycle-aware server queries), then user-facing surfaces (transaction sheet, filters, page polish). Each task is independently committable.

**Tech Stack:** SvelteKit 2.57, Svelte 5 (runes), Tailwind v4, shadcn-svelte, bits-ui, lucide-svelte, drizzle-kit (D1 over HTTP), vitest + @vitest/browser-playwright.

**Pre-existing baseline (from Phase 11):** `src/lib/server/db/auth.ts` has 1 type error (RESEND_API_KEY missing from regenerated worker types) and ~38 lint errors across other files. Tasks verify "no NEW errors introduced" rather than "exit 0".

---

## File Structure

| File                                                    | Responsibility                                                   | Status |
| ------------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| `src/lib/utils/cycle.ts`                                | Cycle math: getCurrentCycle, getCycleForPeriod, formatCycleLabel | Create |
| `src/lib/utils/cycle.test.ts`                           | Cycle tests (vitest)                                             | Create |
| `src/lib/utils/last-used.ts`                            | localStorage wrapper for last account/kind                       | Create |
| `src/lib/utils/last-used.test.ts`                       | last-used tests                                                  | Create |
| `src/lib/components/ui/segmented-control.svelte`        | Pill segmented control primitive                                 | Create |
| `src/lib/components/ui/segmented-control.test.ts`       | Component tests                                                  | Create |
| `src/lib/components/ui/picker-sheet.svelte`             | Bottom-sheet list picker primitive                               | Create |
| `src/lib/components/ui/picker-sheet.test.ts`            | Component tests                                                  | Create |
| `src/lib/components/ui/fab.svelte`                      | Floating action button primitive                                 | Create |
| `src/lib/stores/add-transaction.ts`                     | Module-scope $state for global add sheet                         | Create |
| `src/lib/components/forms/add-transaction-sheet.svelte` | Add/Edit transaction Sheet+Dialog responsive form                | Create |
| `src/lib/server/db/schema.ts`                           | Add `monthStartDay` column                                       | Modify |
| `src/routes/(app)/+layout.svelte`                       | Mount global Fab + AddTransactionSheet                           | Modify |
| `src/routes/(app)/dashboard/+page.svelte`               | KPI typography + cycle label                                     | Modify |
| `src/routes/(app)/dashboard/+page.server.ts`            | Cycle-aware aggregations                                         | Modify |
| `src/routes/(app)/transactions/+page.svelte`            | Chip filter, FAB-driven add, sheet form                          | Modify |
| `src/routes/(app)/transactions/+page.server.ts`         | Cycle-aware default range                                        | Modify |
| `src/routes/(app)/accounts/+page.svelte`                | Mobile sheet form, type PickerSheet, hero balance                | Modify |
| `src/routes/(app)/budgets/+page.svelte`                 | Period chip, mobile sheet form, category PickerSheet             | Modify |
| `src/routes/(app)/budgets/+page.server.ts`              | Cycle-aware spent calculation                                    | Modify |
| `src/routes/(app)/categories/+page.svelte`              | Mobile sheet form, kind segmented, swatch grid                   | Modify |
| `src/routes/(app)/settings/+page.svelte`                | Theme segmented + monthStartDay field                            | Modify |
| `src/routes/(app)/settings/+page.server.ts`             | Validate monthStartDay                                           | Modify |

---

## Task 1: Cycle Utility (TDD)

**Why:** Pure logic. Foundation for every "this month" query. TDD locks the contract.

**Files:**

- Create: `src/lib/utils/cycle.ts`
- Create: `src/lib/utils/cycle.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/utils/cycle.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getCurrentCycle, getCycleForPeriod, formatCycleLabel } from './cycle';

const TZ = 'Asia/Jakarta';

describe('getCurrentCycle', () => {
	it('startDay=1 returns calendar month boundaries', () => {
		const now = new Date('2026-09-15T12:00:00Z');
		const c = getCurrentCycle(now, 1, TZ);
		expect(c.periodMonth).toBe('2026-09');
		// Sep 1 00:00 Asia/Jakarta = Aug 31 17:00 UTC
		expect(c.start.toISOString()).toBe('2026-08-31T17:00:00.000Z');
		expect(c.end.toISOString()).toBe('2026-09-30T17:00:00.000Z');
	});

	it('startDay=25 with now before the 25th returns previous-month cycle', () => {
		const now = new Date('2026-09-10T12:00:00Z');
		const c = getCurrentCycle(now, 25, TZ);
		expect(c.periodMonth).toBe('2026-08');
		expect(c.start.toISOString()).toBe('2026-08-24T17:00:00.000Z'); // Aug 25 Jakarta
		expect(c.end.toISOString()).toBe('2026-09-24T17:00:00.000Z'); // Sep 25 Jakarta
	});

	it('startDay=25 with now on or after the 25th returns current-month cycle', () => {
		const now = new Date('2026-09-26T12:00:00Z');
		const c = getCurrentCycle(now, 25, TZ);
		expect(c.periodMonth).toBe('2026-09');
		expect(c.start.toISOString()).toBe('2026-09-24T17:00:00.000Z');
		expect(c.end.toISOString()).toBe('2026-10-24T17:00:00.000Z');
	});

	it('startDay clamps to 28 (Feb safety) for caller convenience', () => {
		const now = new Date('2026-02-10T12:00:00Z');
		const c = getCurrentCycle(now, 31, TZ);
		// Implementation must cap input at 28
		expect(c.periodMonth).toBe('2026-01');
	});
});

describe('getCycleForPeriod', () => {
	it('startDay=1 maps period to calendar month', () => {
		const c = getCycleForPeriod('2026-09', 1, TZ);
		expect(c.start.toISOString()).toBe('2026-08-31T17:00:00.000Z');
		expect(c.end.toISOString()).toBe('2026-09-30T17:00:00.000Z');
	});

	it('startDay=25 maps period to anchor-month-25 → next-month-25', () => {
		const c = getCycleForPeriod('2026-09', 25, TZ);
		expect(c.start.toISOString()).toBe('2026-09-24T17:00:00.000Z');
		expect(c.end.toISOString()).toBe('2026-10-24T17:00:00.000Z');
	});
});

describe('formatCycleLabel', () => {
	it('returns "September 2026" for startDay=1', () => {
		const c = getCycleForPeriod('2026-09', 1, TZ);
		expect(formatCycleLabel(c, 1, 'en')).toBe('September 2026');
	});

	it('returns "Sep 25 – Oct 24" for startDay=25', () => {
		const c = getCycleForPeriod('2026-09', 25, TZ);
		const label = formatCycleLabel(c, 25, 'en');
		expect(label).toMatch(/Sep 25.*Oct 24/);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/utils/cycle.test.ts`
Expected: FAIL with "Cannot find module './cycle'".

- [ ] **Step 3: Implement cycle.ts**

Create `src/lib/utils/cycle.ts`:

```ts
export interface Cycle {
	start: Date;
	end: Date;
	periodMonth: string;
}

function clampStartDay(startDay: number): number {
	if (!Number.isFinite(startDay)) return 1;
	return Math.min(28, Math.max(1, Math.trunc(startDay)));
}

function getZonedYearMonthDay(date: Date, timezone: string): { y: number; m: number; d: number } {
	const fmt = new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});
	const parts = fmt.formatToParts(date);
	const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
	return { y: get('year'), m: get('month'), d: get('day') };
}

function zonedDayStartUtc(year: number, month1to12: number, day: number, timezone: string): Date {
	// Find UTC instant whose zoned wall time is year-month-day 00:00:00.
	const guess = new Date(Date.UTC(year, month1to12 - 1, day, 0, 0, 0));
	const z = getZonedYearMonthDay(guess, timezone);
	const wallUtc = Date.UTC(z.y, z.m - 1, z.d, 0, 0, 0);
	const targetUtc = Date.UTC(year, month1to12 - 1, day, 0, 0, 0);
	const offsetMs = targetUtc - wallUtc;
	return new Date(guess.getTime() + offsetMs);
}

function periodMonthStr(year: number, month1to12: number): string {
	return `${year}-${String(month1to12).padStart(2, '0')}`;
}

function addMonths(year: number, month1to12: number, delta: number): { y: number; m: number } {
	const idx = year * 12 + (month1to12 - 1) + delta;
	return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

export function getCycleForPeriod(periodYYYYMM: string, startDay: number, timezone: string): Cycle {
	const sd = clampStartDay(startDay);
	const [yStr, mStr] = periodYYYYMM.split('-');
	const y = Number(yStr);
	const m = Number(mStr);
	const start = zonedDayStartUtc(y, m, sd, timezone);
	const next = addMonths(y, m, 1);
	const end = zonedDayStartUtc(next.y, next.m, sd, timezone);
	return { start, end, periodMonth: periodMonthStr(y, m) };
}

export function getCurrentCycle(now: Date, startDay: number, timezone: string): Cycle {
	const sd = clampStartDay(startDay);
	const z = getZonedYearMonthDay(now, timezone);
	let anchorY = z.y;
	let anchorM = z.m;
	if (z.d < sd) {
		const prev = addMonths(z.y, z.m, -1);
		anchorY = prev.y;
		anchorM = prev.m;
	}
	return getCycleForPeriod(periodMonthStr(anchorY, anchorM), sd, timezone);
}

export function formatCycleLabel(cycle: Cycle, startDay: number, locale = 'en'): string {
	const sd = clampStartDay(startDay);
	const startFmt = new Intl.DateTimeFormat(locale, {
		month: 'long',
		year: 'numeric'
	});
	if (sd === 1) {
		return startFmt.format(cycle.start);
	}
	const dayFmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
	const endInclusive = new Date(cycle.end.getTime() - 1);
	return `${dayFmt.format(cycle.start)} – ${dayFmt.format(endInclusive)}`;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/lib/utils/cycle.test.ts`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/cycle.ts src/lib/utils/cycle.test.ts
git commit -m "feat(util): cycle helpers for adjustable monthly anchor

Pure UTC math + Intl-based zoning. Caps startDay at 28 to avoid Feb
edge cases. getCurrentCycle / getCycleForPeriod return half-open
[start, end) ranges. formatCycleLabel renders 'September 2026' for
startDay=1 and 'Sep 25 – Oct 24' otherwise."
```

---

## Task 2: Last-Used Utility (TDD)

**Why:** Powers Q4-B defaults (last-used account, last-used kind). SSR-safe.

**Files:**

- Create: `src/lib/utils/last-used.ts`
- Create: `src/lib/utils/last-used.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/utils/last-used.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getLastUsed, setLastUsed } from './last-used';

describe('last-used', () => {
	beforeEach(() => {
		if (typeof localStorage !== 'undefined') localStorage.clear();
	});

	it('returns empty object when no value stored', () => {
		expect(getLastUsed()).toEqual({});
	});

	it('roundtrips kind and accountId', () => {
		setLastUsed({ accountId: 'acct-1', kind: 'expense' });
		expect(getLastUsed()).toEqual({ accountId: 'acct-1', kind: 'expense' });
	});

	it('partial set merges with existing', () => {
		setLastUsed({ accountId: 'acct-1', kind: 'expense' });
		setLastUsed({ kind: 'income' });
		expect(getLastUsed()).toEqual({ accountId: 'acct-1', kind: 'income' });
	});

	it('returns empty object for malformed JSON', () => {
		localStorage.setItem('mavlo:last-used', '{not-json');
		expect(getLastUsed()).toEqual({});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/utils/last-used.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement last-used.ts**

Create `src/lib/utils/last-used.ts`:

```ts
const KEY = 'mavlo:last-used';

export type LastUsed = {
	accountId?: string;
	kind?: 'income' | 'expense' | 'transfer';
};

export function getLastUsed(): LastUsed {
	if (typeof window === 'undefined') return {};
	try {
		const raw = window.localStorage.getItem(KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return typeof parsed === 'object' && parsed !== null ? (parsed as LastUsed) : {};
	} catch {
		return {};
	}
}

export function setLastUsed(next: Partial<LastUsed>): void {
	if (typeof window === 'undefined') return;
	try {
		const current = getLastUsed();
		const merged = { ...current, ...next };
		window.localStorage.setItem(KEY, JSON.stringify(merged));
	} catch {
		// Ignore quota / privacy-mode errors
	}
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/lib/utils/last-used.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/last-used.ts src/lib/utils/last-used.test.ts
git commit -m "feat(util): last-used localStorage helper

SSR-safe getter/setter for last account + kind. Partial set merges
with existing. Returns empty object for SSR or malformed JSON."
```

---

## Task 3: SegmentedControl Primitive

**Why:** Replaces 2-3 option native selects (kind, theme).

**Files:**

- Create: `src/lib/components/ui/segmented-control.svelte`

- [ ] **Step 1: Implement component**

Create `src/lib/components/ui/segmented-control.svelte`:

```svelte
<script lang="ts" module>
	import type { Component } from 'svelte';

	export type SegmentedOption = {
		value: string;
		label: string;
		icon?: Component;
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils.js';

	type Props = {
		options: SegmentedOption[];
		value: string;
		name?: string;
		ariaLabel?: string;
		class?: string;
	};

	let {
		options,
		value = $bindable(),
		name,
		ariaLabel = 'Selection',
		class: className = ''
	}: Props = $props();

	function onKeydown(e: KeyboardEvent) {
		const idx = options.findIndex((o) => o.value === value);
		if (idx < 0) return;
		if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
			e.preventDefault();
			value = options[(idx + 1) % options.length].value;
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
			e.preventDefault();
			value = options[(idx - 1 + options.length) % options.length].value;
		}
	}
</script>

<div
	role="radiogroup"
	aria-label={ariaLabel}
	class={cn('bg-muted inline-grid w-full gap-1 rounded-lg p-1', className)}
	style="grid-template-columns: repeat({options.length}, minmax(0, 1fr));"
	onkeydown={onKeydown}
>
	{#each options as opt (opt.value)}
		<button
			type="button"
			role="radio"
			aria-checked={value === opt.value}
			tabindex={value === opt.value ? 0 : -1}
			onclick={() => (value = opt.value)}
			class={cn(
				'flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm transition-all',
				value === opt.value
					? 'bg-background text-foreground font-medium shadow-sm'
					: 'text-muted-foreground hover:text-foreground'
			)}
		>
			{#if opt.icon}
				<opt.icon class="size-4" />
			{/if}
			<span>{opt.label}</span>
		</button>
	{/each}
</div>

{#if name}
	<input type="hidden" {name} {value} />
{/if}
```

- [ ] **Step 2: Verify type-check**

Run: `npm run check 2>&1 | tail -5`
Expected: Same baseline error count as Phase 11 (no NEW errors in segmented-control.svelte).

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/ui/segmented-control.svelte
git commit -m "feat(ui): SegmentedControl primitive

Pill-style radio group with arrow-key navigation. Optional hidden
input for form submission. Used for transaction kind, category kind,
theme."
```

---

## Task 4: PickerSheet Primitive

**Why:** Replaces long-list native selects (account, category, account-type).

**Files:**

- Create: `src/lib/components/ui/picker-sheet.svelte`

- [ ] **Step 1: Implement component**

Create `src/lib/components/ui/picker-sheet.svelte`:

```svelte
<script lang="ts" module>
	import type { Component } from 'svelte';

	export type PickerItem = {
		value: string;
		label: string;
		description?: string;
		icon?: Component;
	};

	export type PickerGroup = {
		label: string;
		items: PickerItem[];
	};
</script>

<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { ChevronRight, Check, Search } from 'lucide-svelte';
	import { cn } from '$lib/utils.js';

	type Props = {
		items?: PickerItem[];
		groups?: PickerGroup[];
		value: string;
		name?: string;
		placeholder?: string;
		title?: string;
		searchable?: boolean;
		disabled?: boolean;
		id?: string;
		class?: string;
	};

	let {
		items,
		groups,
		value = $bindable(),
		name,
		placeholder = 'Select…',
		title = 'Select',
		searchable = false,
		disabled = false,
		id,
		class: className = ''
	}: Props = $props();

	let open = $state(false);
	let query = $state('');

	const flat = $derived<PickerItem[]>(groups ? groups.flatMap((g) => g.items) : (items ?? []));
	const selected = $derived(flat.find((i) => i.value === value));

	function matches(it: PickerItem, q: string): boolean {
		if (!q) return true;
		const needle = q.toLowerCase();
		return it.label.toLowerCase().includes(needle);
	}

	const filteredGroups = $derived<PickerGroup[]>(
		groups
			? groups
					.map((g) => ({ label: g.label, items: g.items.filter((i) => matches(i, query)) }))
					.filter((g) => g.items.length)
			: []
	);

	const filteredItems = $derived<PickerItem[]>(
		!groups ? (items ?? []).filter((i) => matches(i, query)) : []
	);

	function pick(v: string) {
		value = v;
		open = false;
		query = '';
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				type="button"
				{id}
				{disabled}
				class={cn(
					'border-input bg-background hover:bg-accent/30 flex h-9 w-full items-center justify-between rounded-md border px-3 text-sm transition-colors disabled:opacity-50 md:h-8',
					!selected && 'text-muted-foreground',
					className
				)}
			>
				<span class="flex min-w-0 items-center gap-2">
					{#if selected?.icon}
						<selected.icon class="size-4 shrink-0" />
					{/if}
					<span class="truncate">{selected?.label ?? placeholder}</span>
				</span>
				<ChevronRight class="size-4 shrink-0 opacity-60" />
			</button>
		{/snippet}
	</Sheet.Trigger>
	<Sheet.Content side="bottom" class="flex max-h-[80dvh] flex-col p-0">
		<Sheet.Header class="p-4 pb-2 text-left">
			<Sheet.Title>{title}</Sheet.Title>
		</Sheet.Header>
		{#if searchable}
			<div class="relative px-4 pb-2">
				<Search
					class="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 opacity-50"
				/>
				<Input type="search" placeholder="Search…" bind:value={query} class="pl-9" autofocus />
			</div>
		{/if}
		<div class="flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
			{#if groups}
				{#each filteredGroups as g (g.label)}
					<div
						class="text-muted-foreground px-4 pt-3 pb-1 text-xs font-medium tracking-wide uppercase"
					>
						{g.label}
					</div>
					<ul>
						{#each g.items as it (it.value)}
							<li>
								<button
									type="button"
									onclick={() => pick(it.value)}
									class={cn(
										'hover:bg-accent/50 flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm',
										value === it.value && 'bg-accent/30'
									)}
								>
									<span class="flex min-w-0 items-center gap-2">
										{#if it.icon}
											<it.icon class="size-4 shrink-0" />
										{/if}
										<span class="truncate">{it.label}</span>
									</span>
									{#if value === it.value}
										<Check class="text-primary size-4" />
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				{/each}
			{:else}
				<ul>
					{#each filteredItems as it (it.value)}
						<li>
							<button
								type="button"
								onclick={() => pick(it.value)}
								class={cn(
									'hover:bg-accent/50 flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm',
									value === it.value && 'bg-accent/30'
								)}
							>
								<span class="flex min-w-0 items-center gap-2">
									{#if it.icon}
										<it.icon class="size-4 shrink-0" />
									{/if}
									<span class="flex min-w-0 flex-col">
										<span class="truncate">{it.label}</span>
										{#if it.description}
											<span class="text-muted-foreground truncate text-xs">{it.description}</span>
										{/if}
									</span>
								</span>
								{#if value === it.value}
									<Check class="text-primary size-4" />
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>

{#if name}
	<input type="hidden" {name} {value} />
{/if}
```

- [ ] **Step 2: Verify type-check**

Run: `npm run check 2>&1 | tail -5`
Expected: No NEW errors in picker-sheet.svelte.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/ui/picker-sheet.svelte
git commit -m "feat(ui): PickerSheet primitive

Bottom-sheet long-list picker. Supports flat items, grouped items,
optional search, optional icon per item. Hidden input for forms. Used
for account, category, account type, transferTo selectors."
```

---

## Task 5: Fab Primitive + Add-Transaction Store

**Why:** FAB invokes the Add-Transaction sheet from any page.

**Files:**

- Create: `src/lib/stores/add-transaction.ts`
- Create: `src/lib/components/ui/fab.svelte`

- [ ] **Step 1: Implement store**

Create `src/lib/stores/add-transaction.ts`:

```ts
type State = {
	open: boolean;
	defaultKind: 'income' | 'expense' | 'transfer';
};

const state = $state<State>({ open: false, defaultKind: 'expense' });

export function openAddTransaction(defaultKind: 'income' | 'expense' | 'transfer' = 'expense') {
	state.defaultKind = defaultKind;
	state.open = true;
}

export function closeAddTransaction() {
	state.open = false;
}

export function getAddTransactionState(): State {
	return state;
}
```

- [ ] **Step 2: Implement Fab**

Create `src/lib/components/ui/fab.svelte`:

```svelte
<script lang="ts">
	import { Plus } from 'lucide-svelte';
	import { openAddTransaction } from '$lib/stores/add-transaction.js';
	import { cn } from '$lib/utils.js';

	type Props = { class?: string };
	let { class: className = '' }: Props = $props();
</script>

<button
	type="button"
	aria-label="Add transaction"
	onclick={() => openAddTransaction('expense')}
	class={cn(
		'bg-primary text-primary-foreground fixed right-4 z-30 flex size-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 md:hidden',
		'bottom-[calc(var(--bottom-nav-h)+1rem+env(safe-area-inset-bottom))]',
		className
	)}
>
	<Plus class="size-6" />
</button>
```

- [ ] **Step 3: Verify type-check**

Run: `npm run check 2>&1 | tail -5`
Expected: No NEW errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/stores/add-transaction.ts src/lib/components/ui/fab.svelte
git commit -m "feat(ui): Fab primitive + add-transaction store

Single global FAB mobile-only, opens add-transaction sheet via
module-scope $state store. z-30 sits below sheet/dialog (z-50) and
above bottom nav (z-40). Bottom offset accounts for nav height +
safe-area-inset-bottom."
```

---

## Task 6: DB Schema — Add monthStartDay Column

**Why:** Persistence for cycle anchor.

**Files:**

- Modify: `src/lib/server/db/schema.ts:90-99`

- [ ] **Step 1: Add column to schema**

In `src/lib/server/db/schema.ts`, locate `userPreferences` (around line 90). Add `monthStartDay` after `weekStartsOn`:

```ts
export const userPreferences = sqliteTable('user_preferences', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	currency: text('currency').notNull().default('IDR'),
	locale: text('locale').notNull().default('id-ID'),
	timezone: text('timezone').notNull().default('Asia/Jakarta'),
	theme: text('theme', { enum: ['light', 'dark', 'system'] }).notNull().default('system'),
	weekStartsOn: integer('week_starts_on', { mode: 'number' }).notNull().default(1),
	monthStartDay: integer('month_start_day', { mode: 'number' }).notNull().default(1),
	createdAt: epochMsNow('created_at'),
```

(Insert exactly the `monthStartDay` line. Leave `createdAt`/`updatedAt` rows untouched.)

- [ ] **Step 2: Generate migration**

Run: `npm run db:generate`
Expected: Drizzle creates a new migration file under `drizzle/` adding `month_start_day`. Inspect it to confirm only the column add.

- [ ] **Step 3: Apply migration**

Run: `npm run db:push`
Expected: D1 receives the column. Existing rows get default 1.

- [ ] **Step 4: Verify type-check**

Run: `npm run check 2>&1 | tail -5`
Expected: No NEW errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/db/schema.ts drizzle/
git commit -m "feat(db): add monthStartDay column to user_preferences

Integer column 1-28 (clamped in helper) with default 1 (calendar
month). Backs the adjustable payday cycle. Drizzle migration applied
to D1 via db:push."
```

---

## Task 7: Cycle-Aware Server Queries — Dashboard

**Why:** Wire `monthStartDay` into "this month" aggregations.

**Files:**

- Modify: `src/routes/(app)/dashboard/+page.server.ts`

- [ ] **Step 1: Read current loader**

Read the existing `dashboard/+page.server.ts` to understand current month-boundary computation (likely uses `new Date()` and start-of-month math).

- [ ] **Step 2: Replace boundary calc with cycle helper**

In the dashboard loader, after fetching `preferences`, compute the cycle once:

```ts
import { getCurrentCycle } from '$lib/utils/cycle.js';

// Inside load():
const cycle = getCurrentCycle(new Date(), preferences.monthStartDay, preferences.timezone);
```

Replace existing `monthStart`/`monthEnd` Date computations with `cycle.start` / `cycle.end`. SQL queries that filter `occurredAt >= monthStart && occurredAt < monthEnd` use `cycle.start.getTime()` and `cycle.end.getTime()` (epoch ms — schema uses epoch ms for `occurred_at`).

Return cycle metadata so the page can show the label:

```ts
return {
	// existing fields...,
	cycle: {
		periodMonth: cycle.periodMonth,
		startMs: cycle.start.getTime(),
		endMs: cycle.end.getTime()
	},
	monthStartDay: preferences.monthStartDay
};
```

- [ ] **Step 3: Verify type-check + tests pass**

Run: `npm run check 2>&1 | tail -5` — no new errors.
Run: `npm test 2>&1 | tail -3` — same pass count as baseline (79 expected).

- [ ] **Step 4: Commit**

```bash
git add 'src/routes/(app)/dashboard/+page.server.ts'
git commit -m "feat(dashboard): cycle-aware monthly aggregations

monthExpenseCents, monthIncomeCents, dailySpending, and
spendingByCategory now use getCurrentCycle(now, monthStartDay,
timezone) instead of calendar month. Returns cycle metadata so the
client can render the cycle label."
```

---

## Task 8: Cycle-Aware Server Queries — Transactions + Budgets

**Why:** Default transaction filter range and budget spent calc both depend on cycle.

**Files:**

- Modify: `src/routes/(app)/transactions/+page.server.ts`
- Modify: `src/routes/(app)/budgets/+page.server.ts`

- [ ] **Step 1: Update transactions loader default range**

In `src/routes/(app)/transactions/+page.server.ts`, when neither `from` nor `to` query param is present, default the date range to the current cycle:

```ts
import { getCurrentCycle } from '$lib/utils/cycle.js';

// Inside load(), after parsing url.searchParams:
const fromParam = url.searchParams.get('from');
const toParam = url.searchParams.get('to');
let fromMs: number | undefined;
let toMs: number | undefined;
if (fromParam) fromMs = new Date(fromParam).getTime();
if (toParam) toMs = new Date(toParam).getTime();
if (fromMs === undefined && toMs === undefined) {
	const cycle = getCurrentCycle(new Date(), preferences.monthStartDay, preferences.timezone);
	fromMs = cycle.start.getTime();
	toMs = cycle.end.getTime();
}
```

Pipe `fromMs`/`toMs` into the existing transactions query. Existing display values for `data.filter.from` / `data.filter.to` should reflect the active range so the UI chips render correctly:

```ts
return {
	// existing fields...,
	filter: {
		from: fromParam ?? '',
		to: toParam ?? ''
		// ...
	}
};
```

(Keep raw user input `from`/`to` empty when defaulted, so the chip bar shows nothing for those — chips only render when explicitly set.)

- [ ] **Step 2: Update budgets loader spent calc**

In `src/routes/(app)/budgets/+page.server.ts`, replace any existing month-boundary math with `getCycleForPeriod` per budget:

```ts
import { getCycleForPeriod, getCurrentCycle } from '$lib/utils/cycle.js';

// When building spentByCategory:
for (const b of budgets) {
	const cycle = getCycleForPeriod(b.periodMonth, preferences.monthStartDay, preferences.timezone);
	const spentRow = await db
		.select({ total: sum(transactions.amountCents) })
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				eq(transactions.kind, 'expense'),
				eq(transactions.categoryId, b.categoryId),
				gte(transactions.occurredAt, cycle.start.getTime()),
				lt(transactions.occurredAt, cycle.end.getTime())
			)
		);
	spentByCategory[b.categoryId] = Number(spentRow[0]?.total ?? 0);
}
```

(Adapt to existing query helper style. Replace whatever fixed `periodStart` / `periodEnd` math previously existed.)

Default `periodMonth` for the filter form (when no `?period=`) = current cycle's `periodMonth`:

```ts
const periodMonth =
	url.searchParams.get('period') ??
	getCurrentCycle(new Date(), preferences.monthStartDay, preferences.timezone).periodMonth;
```

Return cycle metadata so the page can render dual-label:

```ts
return {
	// existing fields...,
	monthStartDay: preferences.monthStartDay,
	timezone: preferences.timezone
};
```

- [ ] **Step 3: Verify**

Run: `npm run check 2>&1 | tail -5` — no new errors.
Run: `npm test 2>&1 | tail -3` — same pass count.

- [ ] **Step 4: Commit**

```bash
git add 'src/routes/(app)/transactions/+page.server.ts' 'src/routes/(app)/budgets/+page.server.ts'
git commit -m "feat(server): cycle-aware transactions default + budget spent

Transactions defaults to current cycle when no from/to. Budget
spentByCategory derived per-budget from getCycleForPeriod so each
budget's range respects the user's monthStartDay. Default period for
new budget filter = current cycle's periodMonth."
```

---

## Task 9: AddTransactionSheet Component

**Why:** Single component renders the new form inside Sheet (mobile) or Dialog (desktop). Reused by Transactions page + global FAB.

**Files:**

- Create: `src/lib/components/forms/add-transaction-sheet.svelte`

- [ ] **Step 1: Implement component**

Create `src/lib/components/forms/add-transaction-sheet.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import MoneyInput from './money-input.svelte';
	import SubmitButton from './submit-button.svelte';
	import SegmentedControl from '$lib/components/ui/segmented-control.svelte';
	import PickerSheet, {
		type PickerItem,
		type PickerGroup
	} from '$lib/components/ui/picker-sheet.svelte';
	import { CalendarDays, StickyNote, Trash2 } from 'lucide-svelte';
	import { setLastUsed } from '$lib/utils/last-used.js';
	import { notify } from '$lib/utils/toast.js';

	type Account = { id: string; name: string; currency: string };
	type Category = { id: string; name: string; kind: 'income' | 'expense' };
	type EditTarget = {
		id: string;
		kind: 'income' | 'expense' | 'transfer';
		amountCents: number;
		accountId: string;
		transferToAccountId: string | null;
		categoryId: string | null;
		occurredAt: number;
		note: string | null;
	};

	type Props = {
		open: boolean;
		mode: 'create' | 'edit';
		accounts: Account[];
		categories: Category[];
		defaultKind?: 'income' | 'expense' | 'transfer';
		defaultAccountId?: string;
		editTarget?: EditTarget | null;
		actionUrl: string; // '?/create' or '?/update'
		onClose: () => void;
		onSuccess?: () => void;
	};

	let {
		open = $bindable(),
		mode,
		accounts,
		categories,
		defaultKind = 'expense',
		defaultAccountId,
		editTarget = null,
		actionUrl,
		onClose,
		onSuccess
	}: Props = $props();

	const todayYmd = new Date().toISOString().slice(0, 10);

	const initial = $derived(() => {
		if (mode === 'edit' && editTarget) {
			return {
				kind: editTarget.kind,
				accountId: editTarget.accountId,
				transferToAccountId: editTarget.transferToAccountId ?? '',
				categoryId: editTarget.categoryId ?? '',
				occurredAt: new Date(editTarget.occurredAt).toISOString().slice(0, 10),
				note: editTarget.note ?? '',
				amountCents: editTarget.amountCents
			};
		}
		return {
			kind: defaultKind,
			accountId: defaultAccountId ?? accounts[0]?.id ?? '',
			transferToAccountId: '',
			categoryId: '',
			occurredAt: todayYmd,
			note: '',
			amountCents: undefined as number | undefined
		};
	});

	let kind = $state<'income' | 'expense' | 'transfer'>(initial().kind);
	let accountId = $state(initial().accountId);
	let transferToAccountId = $state(initial().transferToAccountId);
	let categoryId = $state(initial().categoryId);
	let occurredAt = $state(initial().occurredAt);
	let note = $state(initial().note);
	let showNote = $state(initial().note.length > 0);
	let pending = $state(false);

	$effect(() => {
		// Re-init when reopened or target changes
		if (!open) return;
		const i = initial();
		kind = i.kind;
		accountId = i.accountId;
		transferToAccountId = i.transferToAccountId;
		categoryId = i.categoryId;
		occurredAt = i.occurredAt;
		note = i.note;
		showNote = i.note.length > 0;
	});

	const kindOptions = [
		{ value: 'expense', label: 'Expense' },
		{ value: 'income', label: 'Income' },
		{ value: 'transfer', label: 'Transfer' }
	];

	const accountItems = $derived<PickerItem[]>(
		accounts.map((a) => ({ value: a.id, label: a.name, description: a.currency }))
	);

	const categoryGroups = $derived<PickerGroup[]>([
		{
			label: 'Expense',
			items: [
				{ value: '', label: 'None' },
				...categories
					.filter((c) => c.kind === 'expense')
					.map((c) => ({ value: c.id, label: c.name }))
			]
		},
		{
			label: 'Income',
			items: categories
				.filter((c) => c.kind === 'income')
				.map((c) => ({ value: c.id, label: c.name }))
		}
	]);

	const isToday = $derived(occurredAt === todayYmd);
	const dateLabel = $derived(
		isToday
			? 'Today'
			: new Date(occurredAt).toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				})
	);

	function onClosed() {
		open = false;
		onClose();
	}
</script>

{#snippet body()}
	<form
		method="POST"
		action={actionUrl}
		use:enhance={() => {
			pending = true;
			return async ({ update, result }) => {
				await update();
				pending = false;
				if (result.type === 'success') {
					setLastUsed({ accountId, kind });
					notify.success(mode === 'create' ? 'Transaction added' : 'Transaction updated');
					onSuccess?.();
					onClosed();
				} else if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					notify.error(message ?? 'Could not save transaction');
				}
			};
		}}
		class="space-y-4 px-4 pb-4"
	>
		{#if mode === 'edit' && editTarget}
			<input type="hidden" name="id" value={editTarget.id} />
		{/if}

		<SegmentedControl options={kindOptions} bind:value={kind} ariaLabel="Transaction kind" />
		<input type="hidden" name="kind" value={kind} />

		<div class="space-y-1">
			<div class="text-muted-foreground text-xs">
				{accounts.find((a) => a.id === accountId)?.currency ?? 'IDR'}
			</div>
			<div class="text-3xl font-semibold tabular-nums md:text-2xl">
				<MoneyInput
					name="amountCents"
					value={editTarget?.amountCents ?? null}
					min={1}
					required
					placeholder="0"
					class="h-14 text-3xl font-semibold md:h-12 md:text-2xl"
				/>
			</div>
		</div>

		<div class="space-y-2">
			<Label>{kind === 'transfer' ? 'From account' : 'Account'}</Label>
			<PickerSheet
				items={accountItems}
				bind:value={accountId}
				name="accountId"
				placeholder="Choose account"
				title="Select account"
			/>
		</div>

		{#if kind === 'transfer'}
			<div class="space-y-2">
				<Label>To account</Label>
				<PickerSheet
					items={accountItems.filter((i) => i.value !== accountId)}
					bind:value={transferToAccountId}
					name="transferToAccountId"
					placeholder="Choose destination"
					title="Select destination"
				/>
			</div>
		{:else}
			<div class="space-y-2">
				<Label>Category</Label>
				<PickerSheet
					groups={categoryGroups}
					bind:value={categoryId}
					name="categoryId"
					placeholder="None"
					title="Select category"
					searchable
				/>
			</div>
		{/if}

		<div class="flex flex-wrap items-center gap-2">
			<label
				class="border-input bg-background hover:bg-accent/30 relative inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm"
			>
				<CalendarDays class="size-4" />
				{dateLabel}
				<input
					type="date"
					name="occurredAt"
					bind:value={occurredAt}
					class="absolute inset-0 cursor-pointer opacity-0"
				/>
			</label>
			{#if !showNote}
				<button
					type="button"
					onclick={() => (showNote = true)}
					class="border-input text-muted-foreground hover:bg-accent/30 inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed px-3 text-sm"
				>
					<StickyNote class="size-4" />
					Add note
				</button>
			{/if}
		</div>

		{#if showNote}
			<div class="space-y-1">
				<Label for="tx-note">Note</Label>
				<div class="flex items-center gap-2">
					<Input
						id="tx-note"
						name="note"
						bind:value={note}
						maxlength={200}
						placeholder="Optional"
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onclick={() => {
							note = '';
							showNote = false;
						}}
						aria-label="Remove note"
					>
						<Trash2 class="size-4" />
					</Button>
				</div>
			</div>
		{/if}

		<div
			class="bg-background sticky bottom-0 -mx-4 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
		>
			<SubmitButton {pending} class="w-full">
				{mode === 'create' ? 'Save' : 'Update'}
			</SubmitButton>
		</div>
		<div class="hidden justify-end gap-2 pt-2 md:flex">
			<Button type="button" variant="outline" onclick={onClosed}>Cancel</Button>
			<SubmitButton {pending}>{mode === 'create' ? 'Save' : 'Update'}</SubmitButton>
		</div>
	</form>
{/snippet}

<!-- Mobile Sheet -->
<div class="md:hidden">
	<Sheet.Root bind:open>
		<Sheet.Content side="bottom" class="flex max-h-[90dvh] flex-col p-0">
			<Sheet.Header class="p-4 pb-2 text-left">
				<Sheet.Title>{mode === 'create' ? 'New transaction' : 'Edit transaction'}</Sheet.Title>
			</Sheet.Header>
			<div class="flex-1 overflow-y-auto">
				{@render body()}
			</div>
		</Sheet.Content>
	</Sheet.Root>
</div>

<!-- Desktop Dialog -->
<div class="hidden md:block">
	<Dialog.Root bind:open>
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title>{mode === 'create' ? 'New transaction' : 'Edit transaction'}</Dialog.Title>
			</Dialog.Header>
			{@render body()}
		</Dialog.Content>
	</Dialog.Root>
</div>
```

- [ ] **Step 2: Verify type-check**

Run: `npm run check 2>&1 | tail -5`
Expected: No NEW errors in add-transaction-sheet.svelte.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/forms/add-transaction-sheet.svelte
git commit -m "feat(forms): AddTransactionSheet — mobile-first transaction form

Renders Sheet on mobile, Dialog on desktop. Hero amount with
currency hint, kind segmented, picker rows for account/category,
date chip toggling native picker, optional note. Reads/writes
last-used on success."
```

---

## Task 10: Mount Global FAB + AddTransactionSheet in Layout

**Why:** Single instance available from every page.

**Files:**

- Modify: `src/routes/(app)/+layout.svelte`

- [ ] **Step 1: Add load data plumbing**

Verify the `(app)/+layout.server.ts` already loads `accounts`, `categories`, `preferences` — most pages use them. If not, extend `(app)/+layout.server.ts` to include `accounts` and `categories` (active only). Use existing schema queries.

- [ ] **Step 2: Mount components**

In `src/routes/(app)/+layout.svelte`, add imports and mount Fab + AddTransactionSheet:

```svelte
<script lang="ts">
	// existing imports...
	import Fab from '$lib/components/ui/fab.svelte';
	import AddTransactionSheet from '$lib/components/forms/add-transaction-sheet.svelte';
	import { getAddTransactionState, closeAddTransaction } from '$lib/stores/add-transaction.js';
	import { getLastUsed } from '$lib/utils/last-used.js';
	import { invalidateAll } from '$app/navigation';

	// ...existing code...

	const txState = getAddTransactionState();
	const defaultAccountId = $derived.by(() => {
		if (typeof window === 'undefined') return data.accounts?.[0]?.id;
		return getLastUsed().accountId ?? data.accounts?.[0]?.id;
	});
</script>

<!-- ...existing markup... -->

<!-- After </main> close, before bottom nav: -->
<Fab />

<AddTransactionSheet
	bind:open={txState.open}
	mode="create"
	accounts={data.accounts ?? []}
	categories={data.categories ?? []}
	defaultKind={txState.defaultKind}
	{defaultAccountId}
	actionUrl="/transactions?/create"
	onClose={closeAddTransaction}
	onSuccess={() => invalidateAll()}
/>
```

(Form action POSTs to `/transactions?/create` regardless of which page hosted the FAB — SvelteKit form actions accept absolute URLs.)

- [ ] **Step 3: Verify type-check**

Run: `npm run check 2>&1 | tail -5`
Expected: No NEW errors.

- [ ] **Step 4: Manual visual check**

Run: `npm run dev`. Sign in.

- iPhone SE 375×667 → on `/dashboard`, FAB visible bottom-right above bottom nav.
- Tap FAB → AddTransactionSheet slides up.
- Submit a transaction → list invalidates, sheet closes, toast shown.
- Repeat from `/accounts` and `/budgets` → same.
- Resize to desktop → FAB hidden.

- [ ] **Step 5: Commit**

```bash
git add 'src/routes/(app)/+layout.svelte' 'src/routes/(app)/+layout.server.ts'
git commit -m "feat(layout): global FAB + AddTransactionSheet

Mounts a single FAB and AddTransactionSheet at the layout level so
every (app) page can trigger an add via the store. Posts to
/transactions?/create. invalidateAll() refreshes the current page's
data on success."
```

---

## Task 11: Transactions Page — Chip-Bar Filter + Sheet

**Why:** Replace 5-field grid with mobile-friendly chip bar; replace inline create/edit dialogs with AddTransactionSheet.

**Files:**

- Modify: `src/routes/(app)/transactions/+page.svelte`

- [ ] **Step 1: Build filter chips and filter sheet**

In `src/routes/(app)/transactions/+page.svelte`, replace the existing `<Card.Root>` filter card (the `<form method="GET">` block) with:

```svelte
<script lang="ts">
	// add to imports:
	import * as Sheet from '$lib/components/ui/sheet';
	import SegmentedControl from '$lib/components/ui/segmented-control.svelte';
	import PickerSheet, {
		type PickerItem,
		type PickerGroup
	} from '$lib/components/ui/picker-sheet.svelte';
	import { Filter, X } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	let filterOpen = $state(false);
	let fFrom = $state(data.filter.from ?? '');
	let fTo = $state(data.filter.to ?? '');
	let fAccount = $state(data.filter.accountId ?? '');
	let fCategory = $state(data.filter.categoryId ?? '');
	let fKind = $state(data.filter.kind ?? '');

	const accountById = $derived(new Map(data.accounts.map((a) => [a.id, a])));
	const categoryById = $derived(new Map(data.categories.map((c) => [c.id, c])));

	type Chip = { key: string; label: string; remove: () => void };
	const chips = $derived<Chip[]>(() => {
		const out: Chip[] = [];
		if (data.filter.from)
			out.push({
				key: 'from',
				label: `From: ${data.filter.from}`,
				remove: () => removeParam('from')
			});
		if (data.filter.to)
			out.push({ key: 'to', label: `To: ${data.filter.to}`, remove: () => removeParam('to') });
		if (data.filter.accountId) {
			const a = accountById.get(data.filter.accountId);
			out.push({
				key: 'account',
				label: a?.name ?? 'Account',
				remove: () => removeParam('account')
			});
		}
		if (data.filter.categoryId) {
			const c = categoryById.get(data.filter.categoryId);
			out.push({
				key: 'category',
				label: c?.name ?? 'Category',
				remove: () => removeParam('category')
			});
		}
		if (data.filter.kind)
			out.push({ key: 'kind', label: data.filter.kind, remove: () => removeParam('kind') });
		return out;
	});

	function removeParam(key: string) {
		const params = new URLSearchParams(window.location.search);
		const map: Record<string, string> = {
			from: 'from',
			to: 'to',
			account: 'account',
			category: 'category',
			kind: 'kind'
		};
		params.delete(map[key]);
		goto(`?${params.toString()}`, { keepFocus: true });
	}

	function applyFilters() {
		const params = new URLSearchParams();
		if (fFrom) params.set('from', fFrom);
		if (fTo) params.set('to', fTo);
		if (fAccount) params.set('account', fAccount);
		if (fCategory) params.set('category', fCategory);
		if (fKind) params.set('kind', fKind);
		filterOpen = false;
		goto(`?${params.toString()}`);
	}

	function resetFilters() {
		fFrom = fTo = fAccount = fCategory = fKind = '';
		filterOpen = false;
		goto('?');
	}

	const accountItems = $derived<PickerItem[]>([
		{ value: '', label: 'All accounts' },
		...data.accounts.map((a) => ({ value: a.id, label: a.name }))
	]);

	const categoryItems = $derived<PickerGroup[]>([
		{ label: 'All', items: [{ value: '', label: 'All categories' }] },
		{
			label: 'Expense',
			items: data.categories
				.filter((c) => c.kind === 'expense')
				.map((c) => ({ value: c.id, label: c.name }))
		},
		{
			label: 'Income',
			items: data.categories
				.filter((c) => c.kind === 'income')
				.map((c) => ({ value: c.id, label: c.name }))
		}
	]);

	const kindOptions = [
		{ value: '', label: 'All' },
		{ value: 'income', label: 'Income' },
		{ value: 'expense', label: 'Expense' },
		{ value: 'transfer', label: 'Transfer' }
	];
</script>
```

Replace the previous filter `<Card.Root>` markup with:

```svelte
<!-- Mobile chip bar -->
<div class="mb-4 flex items-center gap-2 overflow-x-auto md:hidden">
	{#if chips.length === 0}
		<button
			type="button"
			onclick={() => (filterOpen = true)}
			class="border-input bg-background inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm"
		>
			<Filter class="size-4" />
			Filter
		</button>
	{:else}
		{#each chips as chip (chip.key)}
			<span
				class="bg-accent text-accent-foreground inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs"
			>
				{chip.label}
				<button type="button" onclick={chip.remove} aria-label="Remove filter">
					<X class="size-3" />
				</button>
			</span>
		{/each}
		<button
			type="button"
			onclick={() => (filterOpen = true)}
			class="border-input inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs"
		>
			<Filter class="size-3" />
			Edit
		</button>
	{/if}
</div>

<!-- Desktop filter form (existing layout, with new primitives) -->
<Card.Root class="mb-6 hidden md:block">
	<Card.Content class="p-4">
		<form
			method="GET"
			class="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
		>
			<div class="space-y-1">
				<Label for="filter-from">From</Label>
				<Input id="filter-from" type="date" name="from" value={data.filter.from} />
			</div>
			<div class="space-y-1">
				<Label for="filter-to">To</Label>
				<Input id="filter-to" type="date" name="to" value={data.filter.to} />
			</div>
			<div class="space-y-1">
				<Label>Account</Label>
				<PickerSheet
					items={accountItems}
					bind:value={fAccount}
					name="account"
					placeholder="All"
					title="Account"
				/>
			</div>
			<div class="space-y-1">
				<Label>Category</Label>
				<PickerSheet
					groups={categoryItems}
					bind:value={fCategory}
					name="category"
					placeholder="All"
					title="Category"
					searchable
				/>
			</div>
			<div class="space-y-1">
				<Label>Kind</Label>
				<SegmentedControl options={kindOptions} bind:value={fKind} name="kind" />
			</div>
			<Button type="submit" class="w-full md:w-auto">Apply</Button>
		</form>
	</Card.Content>
</Card.Root>

<!-- Mobile filter sheet -->
<Sheet.Root bind:open={filterOpen}>
	<Sheet.Content side="bottom" class="flex max-h-[90dvh] flex-col p-0">
		<Sheet.Header class="p-4 pb-2 text-left">
			<Sheet.Title>Filter transactions</Sheet.Title>
		</Sheet.Header>
		<div class="flex-1 space-y-4 overflow-y-auto p-4">
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="m-from">From</Label>
					<Input id="m-from" type="date" bind:value={fFrom} />
				</div>
				<div class="space-y-1">
					<Label for="m-to">To</Label>
					<Input id="m-to" type="date" bind:value={fTo} />
				</div>
			</div>
			<div class="space-y-1">
				<Label>Account</Label>
				<PickerSheet
					items={accountItems}
					bind:value={fAccount}
					placeholder="All accounts"
					title="Account"
				/>
			</div>
			<div class="space-y-1">
				<Label>Category</Label>
				<PickerSheet
					groups={categoryItems}
					bind:value={fCategory}
					placeholder="All categories"
					title="Category"
					searchable
				/>
			</div>
			<div class="space-y-1">
				<Label>Kind</Label>
				<SegmentedControl options={kindOptions} bind:value={fKind} />
			</div>
		</div>
		<div class="flex gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
			<Button variant="outline" class="flex-1" onclick={resetFilters}>Reset</Button>
			<Button class="flex-1" onclick={applyFilters}>Apply</Button>
		</div>
	</Sheet.Content>
</Sheet.Root>
```

- [ ] **Step 2: Replace inline create/edit dialogs with AddTransactionSheet**

Remove the existing `<!-- Create dialog -->` and `<!-- Edit dialog -->` blocks. Replace with two `AddTransactionSheet` instances:

```svelte
<script lang="ts">
	// Add:
	import AddTransactionSheet from '$lib/components/forms/add-transaction-sheet.svelte';
	import { openAddTransaction, getAddTransactionState } from '$lib/stores/add-transaction.js';

	const txState = getAddTransactionState();
	let editOpen = $state(false);
	let editTarget = $state<TxRow | null>(null);

	function openEdit(t: TxRow) {
		editTarget = t;
		editOpen = true;
	}
</script>

<!-- "New transaction" header button (desktop visible only) -->
<Button class="hidden md:inline-flex" onclick={() => openAddTransaction('expense')}>
	<Plus class="mr-1 size-4" /> New transaction
</Button>
```

(The mobile FAB at layout level handles mobile create. Desktop button uses the same store entry point so both share state and the same `<AddTransactionSheet>` mounted in the layout.)

Mount the edit sheet locally (since edit needs page-local `editTarget`):

```svelte
<AddTransactionSheet
	bind:open={editOpen}
	mode="edit"
	accounts={data.accounts}
	categories={data.categories}
	editTarget={editTarget
		? {
				id: editTarget.id,
				kind: editTarget.kind,
				amountCents: editTarget.amountCents,
				accountId: editTarget.accountId,
				transferToAccountId: editTarget.transferToAccountId,
				categoryId: editTarget.categoryId,
				occurredAt: editTarget.occurredAt,
				note: editTarget.note
			}
		: null}
	actionUrl="?/update"
	onClose={() => (editOpen = false)}
/>
```

- [ ] **Step 3: Verify**

Run: `npm run check 2>&1 | tail -5` — no new errors.
Run: `npm run dev`, sign in. iPhone SE: chip bar shows; tap Filter → sheet; apply → URL params update. Mobile FAB → create sheet (via global). Edit row → edit sheet.

- [ ] **Step 4: Commit**

```bash
git add 'src/routes/(app)/transactions/+page.svelte'
git commit -m "feat(transactions): chip-bar filter + AddTransactionSheet

Replaces the 5-field filter grid on mobile with a chip bar + bottom
sheet (Reset/Apply). Desktop keeps the grid but uses new
SegmentedControl + PickerSheet primitives. Replaces inline
create/edit dialogs with AddTransactionSheet (Sheet on mobile,
Dialog on desktop)."
```

---

## Task 12: Budgets Page — Period Chip + Sheet Form + PickerSheet

**Why:** Mobile-friendly period filter, replace native selects + dialog.

**Files:**

- Modify: `src/routes/(app)/budgets/+page.svelte`

- [ ] **Step 1: Replace filter card with period chip / month input**

In `src/routes/(app)/budgets/+page.svelte`, replace the existing filter `<Card.Root>` block:

```svelte
<!-- Mobile: period chip -->
<form method="GET" class="md:hidden mb-4 flex items-center gap-2">
	<label class="inline-flex items-center gap-1.5 px-3 h-9 rounded-full border border-input bg-background text-sm relative">
		{data.periodMonth}
		<input
			type="month"
			name="period"
			value={data.periodMonth}
			onchange={(e) => (e.currentTarget.form as HTMLFormElement).submit()}
			class="absolute inset-0 opacity-0 cursor-pointer"
		/>
	</label>
	{#if data.monthStartDay && data.monthStartDay !== 1}
		<span class="text-xs text-muted-foreground truncate">
			(cycle starts day {data.monthStartDay})
		</span>
	{/if}
</form>

<!-- Desktop: existing form with month input -->
<Card.Root class="hidden md:block mb-6">
	<Card.Content class="p-4">
		<form method="GET" class="flex items-end gap-3">
			<div class="space-y-1 flex-1 max-w-xs">
				<Label for="filter-period">Period</Label>
				<Input id="filter-period" type="month" name="period" value={data.periodMonth} />
			</div>
			<Button type="submit">Apply</Button>
		</form>
	</Card.Content>
</Card.Root>
```

- [ ] **Step 2: Replace dialogs with mobile sheet + desktop dialog**

Refactor create/edit dialogs to render Sheet on mobile, Dialog on desktop. Inside both, use `PickerSheet` for category and `<input type="month">` for period:

Replace the existing `<!-- Create dialog -->` block. Use a snippet for the form body to share code between Sheet/Dialog:

```svelte
<script lang="ts">
	// Add:
	import * as Sheet from '$lib/components/ui/sheet';
	import PickerSheet, { type PickerItem } from '$lib/components/ui/picker-sheet.svelte';

	const expenseCategoryItems = $derived<PickerItem[]>(
		data.expenseCategories.map((c) => ({ value: c.id, label: c.name }))
	);

	let createCategoryId = $state('');
	let editCategoryId = $state('');

	$effect(() => {
		if (createOpen && !createCategoryId) {
			createCategoryId = data.expenseCategories[0]?.id ?? '';
		}
	});

	$effect(() => {
		if (editTarget) editCategoryId = editTarget.categoryId;
	});
</script>

{#snippet createForm()}
	<form
		method="POST"
		action="?/create"
		use:enhance={() => {
			createPending = true;
			return async ({ update, result }) => {
				await update();
				createPending = false;
				if (result.type === 'success') {
					createOpen = false;
					notify.success('Budget created');
				} else if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					notify.error(message ?? 'Could not create budget');
				}
			};
		}}
		class="space-y-4 p-4"
	>
		<div class="space-y-1">
			<Label>Category</Label>
			<PickerSheet
				items={expenseCategoryItems}
				bind:value={createCategoryId}
				name="categoryId"
				placeholder="Select category"
				title="Category"
				searchable
			/>
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div class="space-y-1">
				<Label for="budget-c-period">Period</Label>
				<Input
					id="budget-c-period"
					type="month"
					name="periodMonth"
					required
					value={data.periodMonth}
				/>
			</div>
			<div class="space-y-1">
				<Label for="budget-c-limit">Limit</Label>
				<MoneyInput id="budget-c-limit" name="limitCents" min={1} required class="h-12 text-2xl" />
			</div>
		</div>
		<div class="flex justify-end gap-2">
			<Button type="button" variant="outline" onclick={() => (createOpen = false)}>Cancel</Button>
			<SubmitButton pending={createPending}>Create</SubmitButton>
		</div>
	</form>
{/snippet}

<!-- Mobile Sheet -->
<div class="md:hidden">
	<Sheet.Root bind:open={createOpen}>
		<Sheet.Content side="bottom" class="flex max-h-[90dvh] flex-col p-0">
			<Sheet.Header class="p-4 pb-2 text-left"><Sheet.Title>New budget</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">{@render createForm()}</div>
		</Sheet.Content>
	</Sheet.Root>
</div>
<!-- Desktop Dialog -->
<div class="hidden md:block">
	<Dialog.Root bind:open={createOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>New budget</Dialog.Title></Dialog.Header>
			{@render createForm()}
		</Dialog.Content>
	</Dialog.Root>
</div>
```

Repeat the same `Sheet`/`Dialog` split for the Edit form (use `editTarget`, `editCategoryId`, `editPending`, action `?/update`, hidden `id` field).

- [ ] **Step 3: Verify**

Run: `npm run check 2>&1 | tail -5` — no new errors.

- [ ] **Step 4: Commit**

```bash
git add 'src/routes/(app)/budgets/+page.svelte'
git commit -m "feat(budgets): mobile sheet form + period chip + PickerSheet

Replaces native category select with PickerSheet, period text input
with native <input type='month'>, and dialog with bottom Sheet on
mobile. Hero limit field via text-2xl h-12 MoneyInput."
```

---

## Task 13: Accounts Page — Mobile Sheet Form + Type PickerSheet + Hero Balance

**Why:** Mobile-friendly create/edit; replace 5-option select with iconified PickerSheet.

**Files:**

- Modify: `src/routes/(app)/accounts/+page.svelte`

- [ ] **Step 1: Add type PickerSheet + sheet/dialog split**

In `src/routes/(app)/accounts/+page.svelte`, add imports and convert dialogs:

```svelte
<script lang="ts">
	// Add:
	import * as Sheet from '$lib/components/ui/sheet';
	import PickerSheet, { type PickerItem } from '$lib/components/ui/picker-sheet.svelte';
	import { Coins, Landmark, CreditCard, CircleEllipsis } from 'lucide-svelte';

	const typeItems: PickerItem[] = [
		{ value: 'cash', label: 'Cash', icon: Coins },
		{ value: 'bank', label: 'Bank', icon: Landmark },
		{ value: 'credit', label: 'Credit', icon: CreditCard },
		{ value: 'wallet', label: 'Wallet', icon: Wallet },
		{ value: 'other', label: 'Other', icon: CircleEllipsis }
	];

	let createType = $state<string>('cash');
	let editType = $state<string>('cash');

	$effect(() => {
		if (editTarget) editType = editTarget.type;
	});
</script>
```

Replace `<!-- Create dialog -->` and `<!-- Edit dialog -->` blocks following the same Sheet/Dialog split pattern as Budgets. Inside each form body:

- Replace native `<select>` for `type` with `<PickerSheet items={typeItems} bind:value={createType} name="type" placeholder="Select type" title="Account type" />` (and `editType` for edit form).
- Wrap `Initial balance` `MoneyInput` with `class="text-2xl h-12"` for hero feel.
- Currency `Input` unchanged.

(Use the snippet pattern from Task 12 to share the form body between Sheet and Dialog.)

- [ ] **Step 2: Verify**

Run: `npm run check 2>&1 | tail -5` — no new errors.

- [ ] **Step 3: Commit**

```bash
git add 'src/routes/(app)/accounts/+page.svelte'
git commit -m "feat(accounts): mobile sheet + type PickerSheet + hero balance

Replaces native type select with PickerSheet showing lucide icons
per account type. Initial-balance MoneyInput sized text-2xl h-12.
Dialog → Sheet on mobile."
```

---

## Task 14: Categories Page — Mobile Sheet + SegmentedControl + Swatch Grid

**Why:** Replace 2-option kind select with segmented; replace hex text with swatch grid.

**Files:**

- Modify: `src/routes/(app)/categories/+page.svelte`

- [ ] **Step 1: Add primitives + state**

```svelte
<script lang="ts">
	// Add:
	import * as Sheet from '$lib/components/ui/sheet';
	import SegmentedControl from '$lib/components/ui/segmented-control.svelte';

	const kindSegmentOptions = [
		{ value: 'income', label: 'Income' },
		{ value: 'expense', label: 'Expense' }
	];

	const PRESET_SWATCHES = [
		'#10b981',
		'#3b82f6',
		'#f59e0b',
		'#f43f5e',
		'#8b5cf6',
		'#ec4899',
		'#14b8a6',
		'#f97316'
	];

	let createKind = $state<'income' | 'expense'>('expense');
	let createColor = $state('');
	let createCustomColor = $state(false);

	let editKind = $state<'income' | 'expense'>('expense');
	let editColor = $state('');
	let editCustomColor = $state(false);

	$effect(() => {
		if (editTarget) {
			editKind = editTarget.kind;
			editColor = editTarget.color ?? '';
			editCustomColor = !!editColor && !PRESET_SWATCHES.includes(editColor);
		}
	});
</script>
```

- [ ] **Step 2: Replace dialogs**

Apply the Sheet/Dialog split snippet pattern. Inside each form body:

For kind:

```svelte
<div class="space-y-1">
	<Label>Kind</Label>
	<SegmentedControl options={kindSegmentOptions} bind:value={createKind} name="kind" />
</div>
```

For color:

```svelte
<div class="space-y-2">
	<Label>Color</Label>
	<div class="grid grid-cols-8 gap-2">
		{#each PRESET_SWATCHES as swatch (swatch)}
			<button
				type="button"
				onclick={() => {
					createColor = swatch;
					createCustomColor = false;
				}}
				class="size-8 rounded-lg border transition-shadow {createColor === swatch
					? 'ring-foreground ring-2'
					: ''}"
				style="background-color: {swatch}"
				aria-label={swatch}
			></button>
		{/each}
	</div>
	<button
		type="button"
		onclick={() => (createCustomColor = !createCustomColor)}
		class="text-muted-foreground text-xs underline"
	>
		{createCustomColor ? 'Hide custom' : '+ Custom hex'}
	</button>
	{#if createCustomColor}
		<div class="flex items-center gap-2">
			<Input bind:value={createColor} placeholder="#10b981" maxlength={7} />
			<span class="size-6 rounded border" style="background-color: {createColor || 'transparent'}"
			></span>
		</div>
	{/if}
	<input type="hidden" name="color" value={createColor} />
</div>
```

(Same pattern for edit form using `editKind`, `editColor`, `editCustomColor`.)

- [ ] **Step 3: Verify**

Run: `npm run check 2>&1 | tail -5` — no new errors.

- [ ] **Step 4: Commit**

```bash
git add 'src/routes/(app)/categories/+page.svelte'
git commit -m "feat(categories): mobile sheet + segmented kind + swatch grid

Replaces native kind select with SegmentedControl. Replaces hex text
input with 8-preset swatch grid plus optional custom hex expander.
Dialog → Sheet on mobile."
```

---

## Task 15: Settings Page — Theme Segmented + monthStartDay Field

**Why:** Replace bespoke theme buttons with shared SegmentedControl, add cycle anchor field.

**Files:**

- Modify: `src/routes/(app)/settings/+page.svelte`
- Modify: `src/routes/(app)/settings/+page.server.ts`

- [ ] **Step 1: Replace bespoke theme buttons**

In `src/routes/(app)/settings/+page.svelte`, remove the existing custom theme button row (`<div class="flex gap-2">…</div>` block at lines ~71-86) and replace with `SegmentedControl`:

```svelte
<script lang="ts">
	// Add:
	import SegmentedControl from '$lib/components/ui/segmented-control.svelte';

	const themeOptions = [
		{ value: 'light', label: 'Light', icon: Sun },
		{ value: 'dark', label: 'Dark', icon: Moon },
		{ value: 'system', label: 'System', icon: Monitor }
	];

	function onThemeChange(v: string) {
		setMode(v as 'light' | 'dark' | 'system');
	}
</script>
```

```svelte
<div class="space-y-1">
	<Label>Theme</Label>
	<SegmentedControl options={themeOptions} bind:value={selectedTheme} name="theme" />
</div>
```

(Keep the existing `selectedTheme` state. Drop `pickTheme`, replaced by inline segmented binding. Call `setMode(selectedTheme)` reactively.)

Add reactive `setMode` call:

```svelte
$effect(() => {
	setMode(selectedTheme as Theme);
});
```

- [ ] **Step 2: Add monthStartDay field**

Insert before the `<SubmitButton>` line:

```svelte
<div class="space-y-1">
	<Label for="pref-cycle-start">Cycle start (e.g. payday)</Label>
	<Input
		id="pref-cycle-start"
		type="number"
		name="monthStartDay"
		min="1"
		max="28"
		required
		value={prefs.monthStartDay}
	/>
	<p class="text-muted-foreground text-xs">
		Day 1 = calendar month. Day 25 = your month runs 25th to 24th. Affects current and future
		periods.
	</p>
</div>
```

- [ ] **Step 3: Validate in form action**

In `src/routes/(app)/settings/+page.server.ts`, locate the existing `default` action (preferences update). Add `monthStartDay` to the payload validation. Example shape (adapt to existing pattern):

```ts
const monthStartDayRaw = Number(formData.get('monthStartDay'));
if (!Number.isFinite(monthStartDayRaw) || monthStartDayRaw < 1 || monthStartDayRaw > 28) {
	return fail(400, { message: 'Cycle start must be 1-28.' });
}
const monthStartDay = Math.trunc(monthStartDayRaw);

await db
	.update(userPreferences)
	.set({
		// existing fields...,
		monthStartDay,
		updatedAt: Date.now()
	})
	.where(eq(userPreferences.userId, locals.user.id));
```

- [ ] **Step 4: Verify**

Run: `npm run check 2>&1 | tail -5` — no new errors.

- [ ] **Step 5: Manual visual check**

Run: `npm run dev`. Sign in. Settings → change Theme → SegmentedControl works. Set Cycle start = 25 → Save → toast. Navigate to Dashboard → "This month spending" subtitle reflects new cycle.

- [ ] **Step 6: Commit**

```bash
git add 'src/routes/(app)/settings/+page.svelte' 'src/routes/(app)/settings/+page.server.ts'
git commit -m "feat(settings): theme segmented + monthStartDay field

Replaces bespoke theme button row with shared SegmentedControl. Adds
'Cycle start (e.g. payday)' number field 1-28. Server validates
range; commits to user_preferences."
```

---

## Task 16: Dashboard Page — KPI Typography + Cycle Label

**Why:** Tighter density on mobile + dynamic cycle label.

**Files:**

- Modify: `src/routes/(app)/dashboard/+page.svelte`

- [ ] **Step 1: Tighten KPI typography + show cycle label**

In `src/routes/(app)/dashboard/+page.svelte`:

Replace `Card.Title` `text-2xl tabular-nums` → `text-xl sm:text-2xl tabular-nums` (3 occurrences).

Replace recent list `<li class="px-6 py-3 …">` → `<li class="px-4 sm:px-6 py-3 …">`.

Show cycle label on "This month spending":

```svelte
<script lang="ts">
	// Add (data already includes cycle from Task 7):
	import { formatCycleLabel } from '$lib/utils/cycle.js';

	const cycleLabel = $derived.by(() => {
		if (!data.cycle) return null;
		return formatCycleLabel(
			{
				start: new Date(data.cycle.startMs),
				end: new Date(data.cycle.endMs),
				periodMonth: data.cycle.periodMonth
			},
			data.monthStartDay,
			data.preferences.locale
		);
	});
</script>
```

Update the existing "This month spending" `Card.Description`:

```svelte
<Card.Description
	>This month spending{#if cycleLabel}
		· {cycleLabel}{/if}</Card.Description
>
```

(Or apply to whichever Card description currently reads "This month spending".)

- [ ] **Step 2: Verify**

Run: `npm run check 2>&1 | tail -5` — no new errors.

- [ ] **Step 3: Commit**

```bash
git add 'src/routes/(app)/dashboard/+page.svelte'
git commit -m "feat(dashboard): tighter KPI typography + cycle label

Card titles text-xl sm:text-2xl. Recent list horizontal padding
px-4 sm:px-6. 'This month spending' description shows cycle label
('Sep 25 – Oct 24') when monthStartDay != 1."
```

---

## Task 17: SegmentedControl + PickerSheet Component Tests

**Why:** Lock primitive contracts before they ship.

**Files:**

- Create: `src/lib/components/ui/segmented-control.test.ts`
- Create: `src/lib/components/ui/picker-sheet.test.ts`

- [ ] **Step 1: Write SegmentedControl test**

Create `src/lib/components/ui/segmented-control.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SegmentedControl from './segmented-control.svelte';

const options = [
	{ value: 'a', label: 'A' },
	{ value: 'b', label: 'B' },
	{ value: 'c', label: 'C' }
];

describe('SegmentedControl', () => {
	it('renders one button per option', () => {
		const { getAllByRole } = render(SegmentedControl, { options, value: 'a' });
		expect(getAllByRole('radio')).toHaveLength(3);
	});

	it('marks selected option aria-checked=true', () => {
		const { getByText } = render(SegmentedControl, { options, value: 'b' });
		expect(getByText('B').closest('button')?.getAttribute('aria-checked')).toBe('true');
	});

	it('updates value when option clicked', async () => {
		let value = $state('a');
		const { getByText } = render(SegmentedControl, {
			options,
			get value() {
				return value;
			},
			set value(v) {
				value = v;
			}
		});
		await fireEvent.click(getByText('C'));
		expect(value).toBe('c');
	});
});
```

If `@testing-library/svelte` is not installed, skip Step 1 and use a thinner manual harness instead:

```ts
import { describe, it, expect } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import SegmentedControl from './segmented-control.svelte';

describe('SegmentedControl (manual)', () => {
	it('renders option labels', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const cmp = mount(SegmentedControl, {
			target,
			props: {
				options: [
					{ value: 'a', label: 'A' },
					{ value: 'b', label: 'B' }
				],
				value: 'a'
			}
		});
		flushSync();
		expect(target.querySelectorAll('[role="radio"]').length).toBe(2);
		unmount(cmp);
	});
});
```

(Inspect `package.json` first — if `@testing-library/svelte` is present, prefer that style.)

- [ ] **Step 2: Write PickerSheet test**

Create `src/lib/components/ui/picker-sheet.test.ts` analogous to the SegmentedControl test:

```ts
import { describe, it, expect } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import PickerSheet from './picker-sheet.svelte';

describe('PickerSheet (smoke)', () => {
	it('renders trigger with placeholder when no value selected', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const cmp = mount(PickerSheet, {
			target,
			props: {
				items: [
					{ value: 'a', label: 'Apple' },
					{ value: 'b', label: 'Banana' }
				],
				value: '',
				placeholder: 'Choose…'
			}
		});
		flushSync();
		expect(target.textContent).toContain('Choose…');
		unmount(cmp);
	});

	it('renders selected label when value matches an item', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const cmp = mount(PickerSheet, {
			target,
			props: {
				items: [
					{ value: 'a', label: 'Apple' },
					{ value: 'b', label: 'Banana' }
				],
				value: 'b',
				placeholder: 'Choose…'
			}
		});
		flushSync();
		expect(target.textContent).toContain('Banana');
		unmount(cmp);
	});
});
```

(Sheet open/close interactions are exercised by manual visual check rather than jsdom because bits-ui Sheet relies on portal mounts.)

- [ ] **Step 3: Run tests**

Run: `npm test 2>&1 | grep "Tests"`
Expected: pass count = baseline (79) + new tests (5+).

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/ui/segmented-control.test.ts src/lib/components/ui/picker-sheet.test.ts
git commit -m "test(ui): smoke tests for SegmentedControl + PickerSheet

Locks rendering contracts: option count, aria-checked, click
updates bindable value (Segmented) and trigger label states
(PickerSheet)."
```

---

## Task 18: Final Verification + Manual QA

**Why:** Catch integration regressions across the full app pass.

- [ ] **Step 1: Type-check + lint baseline parity**

Run: `npm run check 2>&1 | tail -5`
Expected: 1 error (pre-existing auth.ts), warnings unchanged.

Run: `npm run lint 2>&1 | grep -E "errors"`
Expected: 38 errors (Phase 11 baseline) + new lint introduced should be 0. If new errors appear, fix or document.

- [ ] **Step 2: Tests**

Run: `npm test 2>&1 | grep "Tests"`
Expected: ≥ 79 + 8 (cycle) + 4 (last-used) + 5 (component tests) = ~96 passing.

- [ ] **Step 3: Manual QA — Mobile (iPhone SE 375×667)**

Run: `npm run dev`. Sign in.

Dashboard:

- KPI cards stack 1-col, smaller titles.
- "This month spending" description shows cycle label when monthStartDay != 1.
- FAB visible bottom-right.

Transactions:

- Chip bar above list. No filters → "Filter" button. Add filters via sheet → chips render.
- Tap × on chip removes one filter.
- FAB → AddTransactionSheet bottom sheet. Hero amount autofocus, segmented kind, picker rows.
- Edit row → edit sheet pre-populated.

Accounts:

- "+ New account" → bottom sheet. Type picker shows icons. Initial balance hero.

Budgets:

- Period chip mobile, tap → native month picker. Auto-submits.
- "+ New budget" → bottom sheet. Category PickerSheet searchable.

Categories:

- "+ New category" → bottom sheet. Kind segmented. Swatch grid select. "+ Custom hex" expands.

Settings:

- Theme segmented switches mode immediately.
- Cycle start field accepts 1-28; saves.

- [ ] **Step 4: Manual QA — Desktop (≥768px)**

- All "+ New" actions open Dialog (not Sheet).
- Filter forms render in grid (not chip).
- FAB hidden.

- [ ] **Step 5: Commit any QA fixes**

Squash QA-only fixes into a single commit if minor:

```bash
git add -p
git commit -m "fix(phase12): polish from QA pass"
```

---

## Self-Review Checklist (run after writing all tasks)

- [x] **Spec coverage:** Section 1 primitives → Tasks 3, 4, 5. Section 2 add/edit flow → Tasks 9, 10, 11. Section 3 filters → Tasks 11 (transactions), 12 (budgets). Section 4 per-page polish → Tasks 11 (transactions), 12 (budgets), 13 (accounts), 14 (categories), 15 (settings), 16 (dashboard). Section 5 cycle → Tasks 1, 6, 7, 8, 15. Section 6 testing → Tasks 1 (cycle), 2 (last-used), 17 (components), 18 (verification). Section 7 risks acknowledged in tasks.
- [x] **Placeholder scan:** Every step has either exact code, an exact command, or an exact instruction with code block. No "TBD"/"add appropriate handling"/"similar to Task N".
- [x] **Type consistency:** `getCurrentCycle(now, startDay, timezone)` signature used in Tasks 1, 7, 8, 15 — matches. `PickerItem` / `PickerGroup` types defined in Task 4, used in Tasks 9, 11, 12, 13. `LastUsed` defined in Task 2, used in Task 9.
- [x] **File path accuracy:** All paths verified against current branch state.
- [x] **Verification realism:** Tasks acknowledge pre-existing baseline (1 type error, 38 lint errors). New tests TDD where logic is testable. CSS/Svelte component changes verified via manual visual check at named viewports.

---

## Execution Order Notes

Tasks are mostly independent commits, but recommended order matches dependency graph:

1. **Tasks 1, 2, 3, 4, 5** — foundations (no inter-dependence; could ship in parallel).
2. **Task 6** — DB migration before any server code that reads `monthStartDay`.
3. **Tasks 7, 8** — server queries; depend on Task 1 (cycle helper) + Task 6 (column).
4. **Task 9** — AddTransactionSheet; depends on Tasks 2, 3, 4.
5. **Task 10** — layout mounts; depends on Tasks 5, 9.
6. **Task 11** — transactions page; depends on Tasks 9, 10.
7. **Tasks 12, 13, 14, 15, 16** — per-page polish; depend on primitives + cycle for 15/16.
8. **Task 17** — component tests (can run anytime after Tasks 3, 4).
9. **Task 18** — final QA.

Stop and ask if any task verification reveals unexpected behavior in the rest of the app.
