# Phase 10 Implementation Plan (Stretch)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Final mobile-feel polish. Bottom-sheet dialogs on mobile (swipe-to-dismiss feel). Pull-to-refresh on dashboard. Skeleton loaders during navigation.

**Architecture:** Reuse the existing shadcn-svelte `Sheet` (already installed in P7T1) for mobile-side dialogs, keeping `Dialog` for desktop. A `<ResponsiveDialog>` wrapper picks the right component by breakpoint. Pull-to-refresh via a small custom action. Skeleton loaders via shadcn `Skeleton` already installed.

**Conventions:**

- `<NEW_REPO>` = `/Users/candratama/Project/WebDev/mavlo`
- Branch: `main` (greenfield, branch strategy A)

---

## Task 1: ResponsiveDialog Wrapper (Sheet on Mobile, Dialog on Desktop)

**Files:**

- Create: `<NEW_REPO>/src/lib/components/forms/responsive-dialog.svelte`

A thin wrapper that exposes the same API as `Dialog.Root + Dialog.Content + Dialog.Header + Dialog.Title + Dialog.Footer` but renders `Sheet.Root + Sheet.Content side="bottom"` etc. when `<md`.

The shadcn-svelte `Sheet` already supports `side="bottom"` which gives a slide-up panel — perfect for mobile dialogs. On desktop (≥md), use `Dialog`.

Approach (simplest): expose a single component with snippet props for content. Two layouts inside; CSS hides one based on breakpoint.

Actually simpler: don't try to share state between Sheet + Dialog (state syncing is painful). Instead, render BOTH simultaneously and use Tailwind responsive classes to hide the wrong one. Same `bind:open` works on both because the parent component owns the state.

- [ ] **Step 1: Create `src/lib/components/forms/responsive-dialog.svelte`**

```svelte
<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Sheet from '$lib/components/ui/sheet';
	import type { Snippet } from 'svelte';

	type Props = {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		title: string;
		description?: string;
		body: Snippet;
		footer?: Snippet;
		class?: string;
	};

	let {
		open = $bindable(),
		onOpenChange,
		title,
		description,
		body,
		footer,
		class: className = ''
	}: Props = $props();
</script>

<!-- Mobile: bottom sheet -->
<div class="md:hidden">
	<Sheet.Root bind:open>
		<Sheet.Content
			side="bottom"
			class="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] {className}"
		>
			<Sheet.Header class="text-left">
				<Sheet.Title>{title}</Sheet.Title>
				{#if description}<Sheet.Description>{description}</Sheet.Description>{/if}
			</Sheet.Header>
			{@render body()}
			{#if footer}
				<Sheet.Footer class="mt-4 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					{@render footer()}
				</Sheet.Footer>
			{/if}
		</Sheet.Content>
	</Sheet.Root>
</div>

<!-- Desktop: dialog -->
<div class="hidden md:block">
	<Dialog.Root bind:open>
		<Dialog.Content class={className}>
			<Dialog.Header>
				<Dialog.Title>{title}</Dialog.Title>
				{#if description}<Dialog.Description>{description}</Dialog.Description>{/if}
			</Dialog.Header>
			{@render body()}
			{#if footer}
				<Dialog.Footer>
					{@render footer()}
				</Dialog.Footer>
			{/if}
		</Dialog.Content>
	</Dialog.Root>
</div>
```

The `bind:open` works on both because Svelte propagates state. The wrapper components are siblings — only one shows at a time via CSS.

- [ ] **Step 2: Refactor accounts/categories/transactions/budgets dialogs**

For each page that uses `<Dialog.Root bind:open={createOpen}>...<Dialog.Content>...<Dialog.Header><Dialog.Title>X</Dialog.Title></Dialog.Header>...<Dialog.Footer>...</Dialog.Footer></Dialog.Content></Dialog.Root>`, refactor to:

```svelte
<ResponsiveDialog
	bind:open={createOpen}
	onOpenChange={(o) => (createOpen = o)}
	title="New account"
	description="Add a new financial account to track."
>
	{#snippet body()}
		<form ... class="mt-4 space-y-4">
			<!-- existing form fields -->
		</form>
	{/snippet}
	{#snippet footer()}
		<Button type="button" variant="outline" onclick={() => (createOpen = false)}>Cancel</Button>
		<SubmitButton pending={createPending}>Create</SubmitButton>
	{/snippet}
</ResponsiveDialog>
```

Wait — the form needs to wrap both body content AND submit button. Restructure: put the entire form inside `body` snippet, and have the SubmitButton inside the form. Drop the `footer` snippet OR move only Cancel + Submit into footer (which then needs `form="form-id"` attribute on the SubmitButton to associate with the form). Simpler: keep everything inside `body` snippet, render the existing form layout as-is.

Updated pattern:

```svelte
<ResponsiveDialog
	bind:open={createOpen}
	onOpenChange={(o) => (createOpen = o)}
	title="New account"
	description="Add a new financial account to track."
>
	{#snippet body()}
		<form
			method="POST"
			action="?/create"
			use:enhance={...}
			class="space-y-4 mt-4"
		>
			<!-- existing form fields and buttons -->
			<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-2">
				<Button type="button" variant="outline" onclick={() => (createOpen = false)}>Cancel</Button>
				<SubmitButton pending={createPending}>Create</SubmitButton>
			</div>
		</form>
	{/snippet}
</ResponsiveDialog>
```

Drop the `footer` snippet entirely; submit/cancel live inside the form for proper submit binding.

- [ ] **Step 3: Update each page** — accounts, categories, transactions, budgets. Same pattern. Each page has 2 dialogs (create + edit).

- [ ] **Step 4: Type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/(lib/components/forms/responsive|routes/\(app\))" || echo "no errors"
git add src/lib/components/forms/responsive-dialog.svelte "src/routes/(app)/"
git commit -m "feat(mobile): bottom sheet on mobile / dialog on desktop"
```

---

## Task 2: Pull-to-Refresh Action

**Files:**

- Create: `<NEW_REPO>/src/lib/actions/pull-to-refresh.ts`
- Modify: `<NEW_REPO>/src/routes/(app)/dashboard/+page.svelte`

A small Svelte action: attach to a scrollable element. When user pulls down past a threshold from scrollTop=0, fire a callback. Only activates on touch devices.

Lightweight implementation: track touchstart/touchmove on the wrapping element, calculate pull delta, show a small indicator at top, call `invalidateAll()` on release if past threshold.

- [ ] **Step 1: Create `src/lib/actions/pull-to-refresh.ts`**

```typescript
import { invalidateAll } from '$app/navigation';

type Options = {
	threshold?: number;
	enabled?: boolean;
};

const DEFAULT_THRESHOLD = 80;

export function setupPullToRefresh(target: HTMLElement, opts: Options = {}): () => void {
	if (typeof window === 'undefined') return () => undefined;
	if (!('ontouchstart' in window)) return () => undefined;

	const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
	let startY = 0;
	let pulling = false;
	let pullDistance = 0;
	let indicator: HTMLDivElement | null = null;

	const ensureIndicator = (): HTMLDivElement => {
		if (indicator) return indicator;
		const div = document.createElement('div');
		div.style.cssText =
			'position:fixed;top:0;left:50%;transform:translate(-50%,-100%);background:hsl(var(--primary));color:hsl(var(--primary-foreground));padding:0.5rem 1rem;border-radius:0 0 0.5rem 0.5rem;font-size:0.75rem;z-index:60;transition:transform 0.2s';
		div.textContent = 'Pull to refresh';
		document.body.appendChild(div);
		indicator = div;
		return div;
	};

	const onTouchStart = (e: TouchEvent) => {
		if (window.scrollY > 0) return;
		startY = e.touches[0].clientY;
		pulling = true;
		pullDistance = 0;
	};

	const onTouchMove = (e: TouchEvent) => {
		if (!pulling) return;
		pullDistance = e.touches[0].clientY - startY;
		if (pullDistance <= 0) return;
		const ind = ensureIndicator();
		const offset = Math.min(pullDistance, threshold * 1.5);
		ind.style.transform = `translate(-50%, ${offset - 40}px)`;
		ind.textContent = pullDistance >= threshold ? 'Release to refresh' : 'Pull to refresh';
	};

	const onTouchEnd = async () => {
		if (!pulling) return;
		pulling = false;
		const should = pullDistance >= threshold;
		if (indicator) {
			indicator.style.transform = 'translate(-50%, -100%)';
			setTimeout(() => {
				if (indicator) {
					indicator.remove();
					indicator = null;
				}
			}, 220);
		}
		pullDistance = 0;
		if (should) {
			await invalidateAll();
		}
	};

	target.addEventListener('touchstart', onTouchStart, { passive: true });
	target.addEventListener('touchmove', onTouchMove, { passive: true });
	target.addEventListener('touchend', onTouchEnd);

	return () => {
		target.removeEventListener('touchstart', onTouchStart);
		target.removeEventListener('touchmove', onTouchMove);
		target.removeEventListener('touchend', onTouchEnd);
		if (indicator) {
			indicator.remove();
			indicator = null;
		}
	};
}
```

- [ ] **Step 2: Wire on dashboard**

Edit `src/routes/(app)/dashboard/+page.svelte`:

```svelte
<script lang="ts">
	import { setupPullToRefresh } from '$lib/actions/pull-to-refresh';
	// ... existing imports ...

	let mounted = $state(false);

	$effect(() => {
		if (typeof window === 'undefined') return;
		mounted = true;
		const cleanup = setupPullToRefresh(document.body, { threshold: 80 });
		return cleanup;
	});
</script>
```

The action attaches to `document.body` so it works across the dashboard scroll area.

- [ ] **Step 3: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/(lib/actions/pull|routes/\(app\)/dashboard)" || echo "no errors"
git add src/lib/actions/pull-to-refresh.ts "src/routes/(app)/dashboard/+page.svelte"
git commit -m "feat(mobile): pull-to-refresh on dashboard"
```

---

## Task 3: Skeleton Loaders for Route Transitions

**Files:**

- Create: `<NEW_REPO>/src/lib/components/skeletons/dashboard-skeleton.svelte`
- Create: `<NEW_REPO>/src/lib/components/skeletons/list-skeleton.svelte`
- Create: `<NEW_REPO>/src/lib/components/skeletons/+page-skeleton.svelte`

Skeletons render while `navigating` from SvelteKit's store is set. The `(app)/+layout.svelte` can show a skeleton overlay during transitions.

Strategy: simpler approach — use `<Skeleton>` boxes (already installed via shadcn-svelte) inside a router-loading indicator at the top of the layout content.

- [ ] **Step 1: Create `src/lib/components/route-loading-bar.svelte`**

A thin progress bar at the top of the screen during navigation, using the `navigating` store from `$app/state`.

```svelte
<script lang="ts">
	import { navigating } from '$app/state';
</script>

{#if navigating.to}
	<div class="fixed top-0 right-0 left-0 z-50 h-0.5 overflow-hidden bg-transparent">
		<div class="bg-primary animate-loading-bar h-full"></div>
	</div>
{/if}

<style>
	@keyframes loading-bar {
		0% {
			transform: translateX(-100%);
		}
		50% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(100%);
		}
	}
	.animate-loading-bar {
		animation: loading-bar 1.4s linear infinite;
	}
</style>
```

- [ ] **Step 2: Mount in root layout**

`src/routes/+layout.svelte`:

```svelte
<script lang="ts">
	import RouteLoadingBar from '$lib/components/route-loading-bar.svelte';
	// ... existing imports ...
</script>

<!-- inside body, before children -->
<RouteLoadingBar />
```

- [ ] **Step 3: Optionally add per-page skeleton fallbacks**

For the dashboard's "Recent transactions" Card, while data loads (only happens on initial paint), show a skeleton list:

```svelte
<Card.Content class="p-0">
	{#if data.recent.length === 0}
		<EmptyState ... />
	{:else}
		<ul class="divide-y">
			<!-- existing list -->
		</ul>
	{/if}
</Card.Content>
```

Already covered by SSR — Svelte's existing flow handles this via `data` props from `+page.server.ts`. No skeleton needed for fully-loaded data, just for the _transition between pages_.

So Step 3 reduces to: only the loading bar (Step 1+2). No per-page skeletons. SvelteKit's SSR pre-renders the data, so client-side navigation only blocks for the duration of the load function on the server side.

- [ ] **Step 4: Type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/(lib/components/route-loading|routes/\\+layout)" || echo "no errors"
git add src/lib/components/route-loading-bar.svelte "src/routes/+layout.svelte"
git commit -m "feat(loading): top progress bar during navigation"
```

---

## Task 4: Build + Smoke + Deploy

- [ ] **Step 1: Build**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run build 2>&1 | tail -8
```

- [ ] **Step 2: Local preview**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run preview > /tmp/mavlo-preview.log 2>&1 &
PREVIEW_PID=$!
sleep 8
curl -s http://localhost:4173/api/health
kill $PREVIEW_PID 2>/dev/null
sleep 2
```

- [ ] **Step 3: Deploy**

```bash
cd /Users/candratama/Project/WebDev/mavlo
./node_modules/.bin/wrangler deploy 2>&1 | tail -8
```

- [ ] **Step 4: Manual e2e**

User on mobile:

- Open create dialog on /accounts → it slides up from the bottom (sheet) instead of centered modal
- Pull down on /dashboard → indicator shows; release past threshold triggers refresh
- Navigate between pages → top progress bar pulses

User on desktop:

- Open create dialog → centered modal as before (Dialog, not Sheet)

- [ ] **Step 5: NO commit** (verification only).

---

## Phase 10 Done When

- [ ] ResponsiveDialog renders Sheet bottom on mobile, Dialog on desktop
- [ ] Pull-to-refresh on dashboard fires invalidateAll on release
- [ ] Top loading bar appears during navigation
- [ ] Build clean; deployed; tested on phone

## Out of Scope

- Custom drag-to-dismiss for sheet
- Haptic feedback (no Web API)
- Per-page skeleton placeholders (SSR makes them mostly redundant)
- Pull-to-refresh on other list pages (dashboard is enough; user can repeat the pattern manually if useful)
