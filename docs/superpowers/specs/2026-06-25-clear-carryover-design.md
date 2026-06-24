# Clear Carryover Feature Design

**Date:** 2026-06-25  
**Status:** Approved  

## Overview

User dapat mereset `carryoverDeficitCents` dari sebuah budget ke 0 untuk bulan berjalan. Carryover adalah defisit dari bulan lalu yang otomatis dibawa ke bulan ini. Reset ini hanya berlaku untuk period bulan ini — tidak mempengaruhi transaksi atau logika carryover bulan depan.

## Backend

### Repository

Tambah fungsi baru di `src/lib/server/repositories/budgets.ts`:

```ts
export async function clearBudgetCarryover(db: Db, userId: string, id: string) {
  const [row] = await db
    .update(budgets)
    .set({ carryoverDeficitCents: 0, carryoverFromPeriod: null, updatedAt: Date.now() })
    .where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
    .returning();
  return row ?? null;
}
```

### Server Action

Tambah action `clearCarryover` di `src/routes/(app)/budgets/+page.server.ts`:

- Input: `id` (budget id), validasi pakai `budgetIdSchema` yang sudah ada
- Panggil `clearBudgetCarryover(db, userId, id)`
- Return 404 kalau budget tidak ditemukan
- Purge user cache setelah sukses (pakai `purgeUserCaches` yang sudah ada)
- Return `{ success: true, action: 'clearCarryover' }`

## UI

### List Page (`/budgets`)

- Chip "⤴ carryover deficit Rp X" yang sudah ada (line ~542) ditambah tombol `X` kecil di sebelah kanannya
- Tombol trigger `AlertDialog` konfirmasi, set state `clearCarryoverTarget` ke budget yang bersangkutan
- Satu `AlertDialog` shared di bawah, dikontrol oleh state `clearCarryoverTarget`

### Detail Page (`/budgets/[id]`)

- Sama: chip carryover (line ~387) ditambah tombol `X` kecil
- Trigger `AlertDialog` yang sama

### AlertDialog Konfirmasi

- Komponen: `$lib/components/ui/alert-dialog` (sudah ada)
- Judul: "Hapus Carryover?"
- Body: "Defisit **Rp X** dari period **YYYY-MM** tidak akan diperhitungkan di bulan ini. Transaksi tidak terpengaruh."
- Tombol: Cancel + "Hapus Carryover" (destructive variant)
- Submit form `action="?/clearCarryover"` dengan hidden input `id`

## Data Flow

```
User tap X di chip carryover
  → set clearCarryoverTarget = budget
  → AlertDialog terbuka
User confirm
  → form submit POST ?/clearCarryover {id}
  → server: validasi, clearBudgetCarryover(), purgeCache()
  → invalidateAll() / page reload
  → chip carryover hilang (carryoverDeficitCents = 0)
```

## Constraints

- Hanya reset untuk bulan ini (update DB row budget yang sudah ada)
- Tidak ada undo
- Tidak mempengaruhi cara carryover dihitung untuk bulan depan
- Tombol X hanya muncul kalau `carryoverDeficitCents > 0`
