# Mavlo External API v1 — Design

**Date:** 2026-06-16
**Status:** Approved (design), pending implementation plan

## Goal

Expose an externally-accessible HTTP/JSON API so users can read and write their
core Mavlo data (transactions, accounts, categories) from outside the app —
scripts, automations, third-party integrations. Authentication is per-user API
keys. Full read + write (CRUD).

## Scope

**In scope (v1):**

- Per-user API key authentication (Bearer token).
- Self-serve API key management UI (create / list / revoke) in app settings.
- CRUD endpoints for: transactions, accounts, categories.

**Out of scope (v1):**

- Budgets, debts, user-preferences endpoints.
- OAuth2 / better-auth bearer tokens / third-party delegated auth.
- Rate limiting (note below — add later if abused).
- Webhooks.
- Pagination beyond simple cursor.

## 1. Authentication — API keys

### New table `api_keys`

| column       | type                 | notes                                              |
| ------------ | -------------------- | -------------------------------------------------- |
| `id`         | text PK (cuid2)      |                                                    |
| `userId`     | text → `users.id`    | owner; FK, indexed                                 |
| `name`       | text                 | user-supplied label, e.g. "Zapier"                 |
| `keyHash`    | text                 | SHA-256 hash of the full key — **plaintext never stored** |
| `prefix`     | text                 | leading display chars, e.g. `mavlo_sk_a1b2` (for list UI) |
| `lastUsedAt` | integer (ms), null   | updated on each authenticated request              |
| `createdAt`  | integer (ms)         |                                                    |
| `revokedAt`  | integer (ms), null   | soft-disable; non-null = key rejected              |

Index on `keyHash` (lookup), index on `userId` (list).

### Key format & lifecycle

- Format: `mavlo_sk_<base64url(32 random bytes)>`. Generated via `crypto.getRandomValues`.
- Returned in **plaintext exactly once** at creation. Never retrievable again.
- Stored as SHA-256 hash (via `crypto.subtle.digest`).
- `prefix` = first ~16 chars of the plaintext key, stored for display so users can
  recognize a key in the list.

### Request authentication

- Client sends `Authorization: Bearer mavlo_sk_…`.
- Server (`authenticate.ts`):
  1. Extract bearer token; 401 if missing/malformed.
  2. SHA-256 the token.
  3. Look up `api_keys` row by `keyHash`.
  4. 401 if not found or `revokedAt` is non-null.
  5. Touch `lastUsedAt` (best-effort, non-blocking).
  6. Return `userId`.
- Use constant-time comparison where comparing secrets (reuse pattern from
  `src/routes/api/cron/cleanup-demo/+server.ts`). Hash lookup is by indexed
  column; the equality check on the candidate hash is constant-time.

## 2. Endpoints

Base path: `/api/v1/`. All endpoints require `Authorization: Bearer`. JSON in/out.

Auth helper: `src/lib/server/api/authenticate.ts` — extract bearer → hash →
lookup → return `userId` or throw a 401 response.

| Method + path                  | Action | Repo function        |
| ------------------------------ | ------ | -------------------- |
| `GET /api/v1/transactions`     | list (filters: `from`, `to`, `accountId`, `kind`, `limit`, `cursor`) | `listTransactions`  |
| `POST /api/v1/transactions`    | create | `createTransaction`  |
| `GET /api/v1/transactions/[id]`| get    | `getTransaction`     |
| `PATCH /api/v1/transactions/[id]` | update | `updateTransaction` |
| `DELETE /api/v1/transactions/[id]` | delete | `deleteTransaction` |
| `GET /api/v1/accounts`         | list   | `listAccounts`       |
| `POST /api/v1/accounts`        | create | `createAccount`      |
| `GET /api/v1/accounts/[id]`    | get    | `getAccount`         |
| `PATCH /api/v1/accounts/[id]`  | update | `updateAccount`      |
| `DELETE /api/v1/accounts/[id]` | delete | `deleteAccount`      |
| `GET /api/v1/categories`       | list   | `listCategories`     |
| `POST /api/v1/categories`      | create | `createCategory`     |
| `GET /api/v1/categories/[id]`  | get    | `getCategory`        |
| `PATCH /api/v1/categories/[id]`| update | `updateCategory`     |
| `DELETE /api/v1/categories/[id]` | delete | `deleteCategory`   |

All repo functions already take `(db, userId, …)` and are user-scoped, so the
API handlers pass the `userId` resolved from the API key and reuse the same
business logic the form actions use. **No business-logic duplication.**

### SvelteKit route files

- `src/routes/api/v1/transactions/+server.ts` — `GET` + `POST`
- `src/routes/api/v1/transactions/[id]/+server.ts` — `GET` + `PATCH` + `DELETE`
- `src/routes/api/v1/accounts/+server.ts` — `GET` + `POST`
- `src/routes/api/v1/accounts/[id]/+server.ts` — `GET` + `PATCH` + `DELETE`
- `src/routes/api/v1/categories/+server.ts` — `GET` + `POST`
- `src/routes/api/v1/categories/[id]/+server.ts` — `GET` + `PATCH` + `DELETE`

### Validation

- One zod schema per request body, derived from the existing repo input types
  (`TransactionCreateInput`, `AccountUpdateInput`, etc.).
- Parse failure → 400 with a `validation` error envelope listing issues.

## 3. Responses & errors

Consistent JSON envelope:

- Success (single): `{ "data": <object> }`
- Success (list): `{ "data": [ … ], "nextCursor": "…" | null }`
- Error: `{ "error": { "code": "<code>", "message": "…" } }`
  - codes: `unauthorized`, `not_found`, `validation`, `server`

Conventions:

- Money values stay as **integer cents** (matching internal storage) — no floats.
  Documented explicitly.
- Status codes: `200` ok · `201` created · `204` delete (no body) · `400`
  validation · `401` missing/invalid/revoked key · `404` not found · `500` server.

## 4. Key management (in-app, session-authed)

These are normal app pages/actions authed by the existing better-auth **session
cookie** — NOT by API key.

- Page: `src/routes/(app)/settings/api-keys/+page.svelte`
  - List existing keys: name, prefix, `lastUsedAt`, `createdAt`.
  - "Generate key" dialog (name input) → shows plaintext key once (copy-to-clipboard,
    warn it won't be shown again).
  - Revoke button per key.
- Actions: `src/routes/(app)/settings/api-keys/+page.server.ts`
  - `?/create` — generate, hash, store; return plaintext once (flash / one-time render).
  - `?/revoke` — set `revokedAt`.
- Repo: `src/lib/server/repositories/api-keys.ts`
  - `listApiKeys(db, userId)`
  - `createApiKey(db, userId, name)` → `{ row, plaintext }`
  - `revokeApiKey(db, userId, id)`
  - `authenticateApiKey(db, plaintextKey)` → `userId | null` (used by `authenticate.ts`)

## 5. Rate limiting

Skipped in v1 (YAGNI). Add later if abused. Likely approach: per-key counter in
KV or D1 with a sliding window.

## 6. Testing

- **Unit:**
  - `api-keys.ts` repo — create (gen + hash + plaintext-once), lookup by hash,
    revoke, reject revoked.
  - `authenticate.ts` — valid key, invalid key, revoked key, missing/malformed bearer.
- **Integration:** each endpoint — happy path + 401 (no/invalid key) + 404 (other
  user's resource or missing) + 400 (validation). Reuse existing
  `test-fixtures.ts` and the in-memory D1 pattern from the repository tests.
- Cross-user isolation test: key for user A cannot read/write user B's rows
  (guaranteed by userId-scoped repos, but assert it).

## Open questions

None outstanding. Design approved 2026-06-16.
