# Mavlo External API v1

HTTP/JSON API for reading and writing your Mavlo finance data (transactions, accounts, categories) from outside the app. Designed to be consumed by scripts, automations, and AI agents.

> **For AI agents:** This document is the complete contract. Everything you need — auth, conventions, every endpoint, every field, every error — is below. No other docs required.

---

## Base URL

```
https://<your-mavlo-domain>/api/v1
```

Local dev: `http://localhost:5173/api/v1`

All endpoints live under `/api/v1`. All requests and responses are JSON (`Content-Type: application/json`).

---

## Authentication

Every endpoint requires a per-user API key sent as a Bearer token:

```
Authorization: Bearer mavlo_sk_<random>
```

- The key scopes every request to the owning user. You only ever see/modify your own data.
- Missing, malformed, or revoked key → `401 unauthorized`.
- Keys never expire but can be revoked at any time.

### Getting a key

Keys are created in the app UI (session-authenticated, **not** via this API):

1. Sign in to Mavlo.
2. Go to **Settings → API Keys**.
3. Click **Generate**, give it a name (max 100 chars).
4. The full key (`mavlo_sk_...`) is shown **exactly once** — copy it immediately. It is stored only as a SHA-256 hash and can never be retrieved again.
5. Revoke a key anytime from the same page; revoked keys are rejected instantly.

---

## Conventions

| Concern | Rule |
|---|---|
| **Money** | Always **integer cents**. Never floats. `amountCents: 1000` = 10.00 in the account's currency. |
| **Timestamps** | **Epoch milliseconds** (integer). e.g. `occurredAt: 1718496000000`. Applies to `occurredAt`, `createdAt`, `updatedAt`, filters. |
| **IDs** | Opaque strings (cuid2). Pass them back verbatim. |
| **Currency** | ISO-ish string on the account (e.g. `"IDR"`, `"USD"`). Set per account; amounts are in that account's currency. |
| **Unknown fields** | Ignored on input. |

---

## Response envelope

**Single object** (GET one, POST create, PATCH update):
```json
{ "data": { ... } }
```

**List** (GET collection):
```json
{ "data": [ { ... }, { ... } ], "nextCursor": null }
```
`nextCursor` is always `null` in v1 (no pagination yet — lists return all matching rows).

**Delete**: `204 No Content`, empty body.

**Error**:
```json
{ "error": { "code": "validation", "message": "Amount must be positive" } }
```

### Status codes & error codes

| HTTP | `code` | When |
|---|---|---|
| 200 | — | OK (get/list/update) |
| 201 | — | Created (POST) |
| 204 | — | Deleted (no body) |
| 400 | `validation` | Body/query failed validation. `message` = first problem. |
| 401 | `unauthorized` | Missing / malformed / revoked key |
| 404 | `not_found` | Resource missing or owned by another user |
| 500 | `server` | Unexpected server error |

---

## Resource: Transactions

### Object shape (response)
```json
{
  "id": "txn_abc",
  "userId": "usr_xyz",
  "accountId": "acc_1",
  "categoryId": "cat_1",
  "amountCents": 1000,
  "kind": "expense",
  "note": "Coffee",
  "occurredAt": 1718496000000,
  "transferToAccountId": null,
  "debtId": null,
  "isSeed": false,
  "createdAt": 1718496000000,
  "updatedAt": 1718496000000
}
```

### Fields (create / update body)

| Field | Type | Required | Notes |
|---|---|---|---|
| `accountId` | string | **yes** | Source account. |
| `amountCents` | int > 0 | **yes** | Positive integer cents. |
| `kind` | enum | **yes** | `income` \| `expense` \| `transfer` |
| `occurredAt` | int > 0 | **yes** | Epoch ms. |
| `categoryId` | string | no | Omit or `""` for none. |
| `transferToAccountId` | string | conditional | **Required when `kind=transfer`**, must differ from `accountId`. Ignored (stripped) for income/expense. |
| `debtId` | string | no | Link to a debt. |
| `note` | string | no | Max 200 chars. |

### Endpoints

| Method | Path | Action |
|---|---|---|
| GET | `/transactions` | List |
| POST | `/transactions` | Create → 201 |
| GET | `/transactions/{id}` | Get one |
| PATCH | `/transactions/{id}` | Update |
| DELETE | `/transactions/{id}` | Delete → 204 |

**List filters** (query string, all optional):

| Param | Type | Meaning |
|---|---|---|
| `fromMs` | int | Only `occurredAt >= fromMs` |
| `toMs` | int | Only `occurredAt <= toMs` |
| `accountId` | string | Filter by account |
| `categoryId` | string | Filter by category |
| `kind` | enum | `income` \| `expense` \| `transfer` |

### Examples

Create an expense:
```bash
curl -X POST https://<domain>/api/v1/transactions \
  -H "Authorization: Bearer mavlo_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"accountId":"acc_1","amountCents":1500,"kind":"expense","categoryId":"cat_food","occurredAt":1718496000000,"note":"Lunch"}'
```

Create a transfer:
```bash
curl -X POST https://<domain>/api/v1/transactions \
  -H "Authorization: Bearer mavlo_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"accountId":"acc_1","transferToAccountId":"acc_2","amountCents":50000,"kind":"transfer","occurredAt":1718496000000}'
```

List this month's income for one account:
```bash
curl "https://<domain>/api/v1/transactions?kind=income&accountId=acc_1&fromMs=1717200000000&toMs=1719791999000" \
  -H "Authorization: Bearer mavlo_sk_..."
```

---

## Resource: Accounts

### Object shape (response)
```json
{
  "id": "acc_1",
  "userId": "usr_xyz",
  "name": "Main Bank",
  "type": "bank",
  "currency": "IDR",
  "initialBalanceCents": 0,
  "currentBalanceCents": 125000,
  "color": "#3b82f6",
  "icon": null,
  "archived": false,
  "createdAt": 1718496000000,
  "updatedAt": 1718496000000
}
```

`currentBalanceCents` (response-only, integer cents) is the **live balance**: `initialBalanceCents` + incoming income/transfers − outgoing expense/transfers, in the account's currency. Read-only — never sent on create/update. Sum it across the list to get total net worth.

### Fields (create / update body)

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | **yes** | 1–80 chars. |
| `type` | enum | **yes** | `cash` \| `bank` \| `credit` \| `wallet` \| `savings` \| `other` |
| `currency` | string | no | Max 8 chars. Default `"IDR"`. |
| `initialBalanceCents` | int | no | Default `0`. Can be negative. |
| `color` | string | no | `#RRGGBB` hex. |
| `icon` | string | no | Max 60 chars. |

### Endpoints

| Method | Path | Action |
|---|---|---|
| GET | `/accounts` | List |
| POST | `/accounts` | Create → 201 |
| GET | `/accounts/{id}` | Get one |
| PATCH | `/accounts/{id}` | Update |
| DELETE | `/accounts/{id}` | Delete → 204 |

**List filter:** `?includeArchived=true` to include archived accounts (default: active only).

### Example
```bash
curl -X POST https://<domain>/api/v1/accounts \
  -H "Authorization: Bearer mavlo_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Cash Wallet","type":"cash","currency":"IDR","initialBalanceCents":250000}'
```

---

## Resource: Categories

### Object shape (response)
```json
{
  "id": "cat_food",
  "userId": "usr_xyz",
  "name": "Food",
  "kind": "expense",
  "expenseType": "variable",
  "color": "#ef4444",
  "icon": null,
  "archived": false,
  "sortOrder": 0,
  "createdAt": 1718496000000,
  "updatedAt": 1718496000000
}
```

### Fields (create / update body)

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | **yes** | 1–60 chars. |
| `kind` | enum | **yes** | `income` \| `expense` |
| `expenseType` | enum | no | `fixed` \| `variable`. Default `variable`. |
| `color` | string | no | `#RRGGBB` hex. |
| `icon` | string | no | Max 60 chars. |

### Endpoints

| Method | Path | Action |
|---|---|---|
| GET | `/categories` | List |
| POST | `/categories` | Create → 201 |
| GET | `/categories/{id}` | Get one |
| PATCH | `/categories/{id}` | Update |
| DELETE | `/categories/{id}` | Delete → 204 |

**List filter:** `?includeArchived=true` (default: active only).

### Example
```bash
curl -X POST https://<domain>/api/v1/categories \
  -H "Authorization: Bearer mavlo_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Salary","kind":"income"}'
```

---

## Notes for agents

- **Always send `Content-Type: application/json`** on POST/PATCH or the body won't parse.
- **PATCH replaces the whole resource** with the validated body (same required fields as create). Send the full object, not a partial diff.
- On `400`, read `error.message` — it names the first failing field/rule.
- A `404` can mean the resource doesn't exist *or* belongs to another user; the API never reveals which.
- To record money correctly: multiply major units by 100. 10.50 → `1050`.
- To build a date filter: convert dates to epoch milliseconds (`Date.parse(...)` or `new Date(...).getTime()`).
