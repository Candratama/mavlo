# Phase 9 Implementation Plan (UI/UX Polish)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Add the small touches that make the app feel finished. Toasts on form actions. Pending state on submits. Dark mode toggle wired to user preferences. Empty states with CTAs everywhere. Mavlo wordmark/icon consistency.

**Architecture:** `svelte-sonner` already installed (Phase 1 polish). `mode-watcher` already installed; just expose a toggle in /settings. Pending state via SvelteKit's `submitting` from `enhance` callback.

**Conventions:**

- `<NEW_REPO>` = `/Users/candratama/Project/WebDev/mavlo`
- Branch: `main` (greenfield, branch strategy A)

---

## Task 1: Sonner Toaster Mount + Helpers

**Files:**

- Modify: `<NEW_REPO>/src/routes/+layout.svelte` (mount `<Toaster>`)
- Create: `<NEW_REPO>/src/lib/utils/toast.ts` (typed helpers)

- [ ] **Step 1: Mount the Toaster**

In `src/routes/+layout.svelte`, import and render `Toaster` from shadcn-svelte's sonner:

```svelte
<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner';
	import InstallPrompt from '$lib/components/pwa/install-prompt.svelte';

	let { children } = $props();
</script>

<ModeWatcher defaultMode="light" />

{@render children()}

<Toaster richColors position="top-center" closeButton />
<InstallPrompt />
```

Position `top-center` works well on mobile (away from bottom tab bar).

- [ ] **Step 2: Helper module `src/lib/utils/toast.ts`**

```typescript
import { toast } from 'svelte-sonner';

export const notify = {
	success: (message: string) => toast.success(message),
	error: (message: string) => toast.error(message),
	info: (message: string) => toast(message)
};
```

Tiny wrapper so callers don't import `svelte-sonner` directly — easier to swap library later.

- [ ] **Step 3: Type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/(lib/utils/toast|routes/\\+layout)" || echo "no errors"
git add src/lib/utils/toast.ts "src/routes/+layout.svelte"
git commit -m "feat(toast): mount Toaster + notify helper"
```

---

## Task 2: Wire Toasts Into Form Actions

**Files:**

- Modify each `(app)/<resource>/+page.svelte` that submits forms

Pattern: in the page's enhance callback, on `result.type === 'success'`, fire a success toast. On `result.type === 'failure'`, fire error toast with the message.

Example for accounts page:

```svelte
<script lang="ts">
	import { notify } from '$lib/utils/toast.js';
	// ... existing imports ...
</script>

<!-- existing create dialog -->
<form
	method="POST"
	action="?/create"
	use:enhance={() => async ({ update, result }) => {
		await update();
		if (result.type === 'success') {
			createOpen = false;
			notify.success('Account created');
		} else if (result.type === 'failure') {
			notify.error((result.data as { message?: string } | undefined)?.message ?? 'Could not create account');
		}
	}}
	class="space-y-4"
>
```

- [ ] **Step 1: Wire toasts in accounts** — create / update / archive / unarchive actions. Messages: "Account created" / "Account updated" / "Archived" / "Unarchived".

Note: archive/unarchive forms don't have an enhance callback currently — they just `use:enhance` with no callback. To toast them, change to a callback variant. Alternatively, add a simple page-level effect that fires toast based on `form` prop changes.

Cleaner approach: each row's archive/unarchive form gets the same callback pattern. Pattern:

```svelte
<form
	method="POST"
	action="?/{account.archived ? 'unarchive' : 'archive'}"
	use:enhance={() => async ({ update, result }) => {
		await update();
		if (result.type === 'success') notify.success(account.archived ? 'Unarchived' : 'Archived');
		else if (result.type === 'failure') notify.error('Action failed');
	}}
>
```

- [ ] **Step 2: Wire toasts in categories** — same pattern.

- [ ] **Step 3: Wire toasts in transactions** — create / update / delete. Messages: "Transaction created" / "Transaction updated" / "Transaction deleted".

- [ ] **Step 4: Wire toasts in budgets** — create / update / delete. Messages: "Budget created" / "Budget updated" / "Budget deleted".

- [ ] **Step 5: Wire toasts in settings** — preferences save. Drop the existing inline `{#if form?.success}<p>Saved.</p>` (toast replaces it). Avatar upload form also fires toast on success.

- [ ] **Step 6: Type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/routes/\\(app\\)" || echo "no errors"
git add "src/routes/(app)/"
git commit -m "feat(toast): success/error notifications across all form actions"
```

---

## Task 3: Form Pending State (Disabled + Spinner)

**Files:**

- Modify each form's submit button across the app

Pattern: track `submitting` state via the `enhance` callback, disable the submit button + show a spinner while the request is in flight.

Cleanest: add a tiny `<SubmitButton>` component that wraps the existing `<Button>` with built-in pending logic.

- [ ] **Step 1: Create `src/lib/components/forms/submit-button.svelte`**

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Loader2 } from 'lucide-svelte';

	type Props = {
		pending?: boolean;
		variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
		size?: 'default' | 'sm' | 'lg' | 'icon';
		class?: string;
		children?: import('svelte').Snippet;
	};

	let {
		pending = false,
		variant = 'default',
		size = 'default',
		class: className = '',
		children
	}: Props = $props();
</script>

<Button type="submit" {variant} {size} disabled={pending} class={className}>
	{#if pending}
		<Loader2 class="size-4 animate-spin" />
	{/if}
	{@render children?.()}
</Button>
```

- [ ] **Step 2: Wire into each create/edit/delete form**

For each form using `use:enhance={...}` with a submit button:

1. Add `let pending = $state(false);` in the component script.
2. Update enhance callback to set `pending = true` on start, `pending = false` after `update()`:

```svelte
use:enhance={() => {
	pending = true;
	return async ({ update, result }) => {
		await update();
		pending = false;
		// ... toast logic
	};
}}
```

3. Replace the existing `<Button type="submit">` with `<SubmitButton {pending}>Create</SubmitButton>`.

The pending tracking is per-form: each dialog gets its own `let createPending = $state(false)` / `let editPending = $state(false)`.

- [ ] **Step 3: Apply to all forms**

Pages to update (create + edit + per-row archive/delete forms): accounts, categories, transactions, budgets, settings, sign-in, sign-up, forgot-password, reset-password.

For row-action forms (archive/unarchive/delete) inside dropdown menus — the trigger is a button inside the dropdown. Pending state for these is brief; either skip or use a simple `disabled` flag while in-flight.

For auth forms (sign-in, sign-up, etc.), the same pattern applies. These don't have toast (they redirect on success), but pending state still helps.

- [ ] **Step 4: Type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/(lib/components/forms|routes)" || echo "no errors"
git add src/lib/components/forms "src/routes/(app)/" "src/routes/(auth)/"
git commit -m "feat(forms): pending state with spinner on form submits"
```

---

## Task 4: Dark Mode Toggle in Settings

**Files:**

- Modify: `<NEW_REPO>/src/routes/(app)/settings/+page.svelte`
- Modify: `<NEW_REPO>/src/routes/+layout.svelte` (read `data.preferences.theme` for ModeWatcher default)

The `theme` field already exists in `user_preferences` and the settings page already lets users edit it. But `ModeWatcher` is hardcoded `defaultMode="light"`. Wire it to the user's saved preference and add a quick toggle in the settings page (in addition to the existing select).

- [ ] **Step 1: Layout reads preferences via parent data**

Edit `src/routes/+layout.svelte`. The root `+layout` doesn't currently load any data. To pass preferences down, we'd need a root `+layout.server.ts`. But the (app) group already has `+layout.server.ts` that returns preferences. Cleanest path:

- Don't change root layout's ModeWatcher — keep `defaultMode="light"`.
- Inside `(app)/+layout.svelte`, after pulling in `data.preferences`, use `mode-watcher`'s `setMode` API on mount to apply the saved theme:

```svelte
<script lang="ts">
	import { setMode, mode } from 'mode-watcher';
	import { onMount } from 'svelte';

	// ... existing imports ...
	let { children, data } = $props();

	$effect(() => {
		if (data.preferences?.theme) {
			setMode(data.preferences.theme);
		}
	});
</script>
```

This re-applies the user's preferred theme whenever the layout's preferences data updates.

- [ ] **Step 2: Add a quick toggle row in settings page**

In `src/routes/(app)/settings/+page.svelte`, above the existing `<select>` for theme (or replacing it), add a 3-button toggle group that immediately calls `setMode` on click AND submits the change to the server:

```svelte
<script lang="ts">
	import { setMode } from 'mode-watcher';
	import { Sun, Moon, Monitor } from 'lucide-svelte';
	// ... existing imports ...

	const themes = [
		{ value: 'light', label: 'Light', icon: Sun },
		{ value: 'dark', label: 'Dark', icon: Moon },
		{ value: 'system', label: 'System', icon: Monitor }
	] as const;

	let selectedTheme = $state(prefs.theme);

	function pickTheme(value: 'light' | 'dark' | 'system') {
		selectedTheme = value;
		setMode(value);
	}
</script>
```

In the form, replace the existing `<select id="pref-theme">` with:

```svelte
<div class="space-y-1">
	<Label>Theme</Label>
	<div class="flex gap-2">
		{#each themes as t}
			<button
				type="button"
				onclick={() => pickTheme(t.value)}
				class="flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors {selectedTheme ===
				t.value
					? 'border-primary bg-primary/10 text-foreground'
					: 'border-input bg-background text-muted-foreground hover:text-foreground'}"
			>
				<t.icon class="size-4" />
				{t.label}
			</button>
		{/each}
	</div>
	<input type="hidden" name="theme" value={selectedTheme} />
</div>
```

The `<input type="hidden" name="theme">` ensures the form submit picks up the chosen value (since we replaced the `<select name="theme">`).

- [ ] **Step 3: Type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/routes/\\(app\\)/(\\+layout|settings)" || echo "no errors"
git add "src/routes/(app)/+layout.svelte" "src/routes/(app)/settings/+page.svelte"
git commit -m "feat(theme): apply saved theme on app load + segmented toggle in settings"
```

---

## Task 5: Empty States Audit

**Files:**

- Modify: any pages where the empty state is missing or terse

Check each list/grid page. For each, ensure when zero items render:

- Icon (lucide) representing the resource
- Heading like "No transactions yet"
- Subtext explaining what to do
- Primary CTA button

Existing pages already have inline empty states (P3T5 etc.); just upgrade them.

- [ ] **Step 1: Create `src/lib/components/empty-state.svelte`** — reusable

```svelte
<script lang="ts">
	import type { Component } from 'svelte';

	type Props = {
		icon: Component;
		title: string;
		description?: string;
		children?: import('svelte').Snippet;
	};

	let { icon: Icon, title, description, children }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
	<div class="bg-muted rounded-full p-3">
		<Icon class="text-muted-foreground size-6" />
	</div>
	<div class="space-y-1">
		<h3 class="text-sm font-medium">{title}</h3>
		{#if description}
			<p class="text-muted-foreground max-w-sm text-xs">{description}</p>
		{/if}
	</div>
	{#if children}
		<div class="mt-1">
			{@render children()}
		</div>
	{/if}
</div>
```

- [ ] **Step 2: Use in accounts/categories/transactions/budgets pages**

Replace the existing inline empty states with `<EmptyState icon={Wallet} title="No accounts yet" description="Add your first account to start tracking finances."><Button onclick={() => createOpen = true}>Add account</Button></EmptyState>`.

This applies to:

- accounts: icon `Wallet`
- categories: icon `Tag`
- transactions: icon `ArrowLeftRight`, description includes the active filter range
- budgets: icon `PiggyBank`

For dashboard's "Recent transactions" empty state (when `data.recent.length === 0`), use the same component with description "Add a transaction to see it here."

- [ ] **Step 3: Type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/(lib/components|routes/\\(app\\))" || echo "no errors"
git add src/lib/components/empty-state.svelte "src/routes/(app)/"
git commit -m "feat(empty): unified EmptyState component across list pages"
```

---

## Task 6: Build + Smoke + Deploy

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
curl -sI http://localhost:4173/dashboard | head -3
kill $PREVIEW_PID 2>/dev/null
sleep 2
```

- [ ] **Step 3: Deploy**

```bash
cd /Users/candratama/Project/WebDev/mavlo
./node_modules/.bin/wrangler deploy 2>&1 | tail -8
```

Capture new Version ID.

- [ ] **Step 4: Manual e2e (user-run)**

Sign in. Verify:

- Toast appears on every successful action (create/update/delete/archive)
- Submit buttons show spinner + disabled while submitting
- /settings: theme buttons immediately swap light/dark; reload preserves choice
- /accounts (when empty): nice empty state with icon + CTA
- /transactions (filtered to a range with no data): empty state shows the range

---

## Phase 9 Done When

- [ ] Toaster mounted; all form actions toast on success/failure
- [ ] Submit buttons show pending state
- [ ] Theme persists across reloads; segmented toggle works
- [ ] Empty states unified across list pages
- [ ] Tests pass; build clean; deployed
