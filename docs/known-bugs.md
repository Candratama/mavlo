# Known Bugs (Backlog)

Ditemukan saat audit filter 2026-07-29, di luar scope perbaikan filter.

**Update 2026-07-29: semua 15 issue di bawah sudah diperbaiki.** Detail fix per item ditandai ✅. Nomor baris mengacu ke kondisi saat dokumen ini ditulis (sebelum fix).

## Tinggi

### 1. ✅ "Record payment" di detail debt arah `lent` tidak pernah mengurangi balance

- **Lokasi:** `src/routes/(app)/debts/[id]/+page.svelte:163` (`defaultKind: 'expense'`)
- **Gejala:** Tombol "Record payment" di halaman detail selalu membuat transaksi `expense`, apa pun arah debt-nya. Untuk debt `lent` (piutang), `txReducesDebtBalance('lent', 'expense')` mengembalikan `false`, jadi `applyDebtPayment` no-op dan piutang tidak pernah berkurang.
- **Fix:** `defaultKind` kini mengikuti `debt.direction` (`lent` → `income`), label tombol menjadi "Collect" untuk debt lent — konsisten dengan halaman daftar debts.

### 2. ✅ Stat Income/Expense di detail akun tidak konsisten dengan kartu di daftar akun

- **Lokasi:** `src/routes/(app)/accounts/[id]/+page.svelte:59-67`
- **Gejala:** Transfer tidak dihitung dan rentangnya all-time, sehingga angka detail berbeda dari kartu `/accounts` (yang memakai `computeAccountPeriodSummary` per cycle).
- **Fix:** Detail akun kini memakai `account.periodIncomeCents`/`periodExpenseCents` dari layout loader — sumber data yang sama persis dengan kartu daftar (cycle berjalan, transfer dihitung sesuai arah).

## Sedang

### 3. ✅ Riwayat pembayaran debt selalu bertanda minus dan tanpa filter kind

- **Lokasi:** `src/routes/(app)/debts/[id]/+page.svelte:79` (filter) dan `:292-293` (render)
- **Fix:** Tanda dan warna kini mengikuti `tx.kind` — income hijau `+`, expense merah `−`.

### 4. ✅ Net harian di detail akun mengabaikan transfer

- **Lokasi:** `src/routes/(app)/accounts/[id]/+page.svelte:96-97` (dan tanda di baris amount ~L261)
- **Fix:** `netCents` kini menghitung transfer (`-amount` bila keluar, `+amount` bila masuk), transfer keluar tampil bertanda `−`, dan leg transfer diformat dengan currency akun halaman.

### 5. ✅ Edit transaksi dari akun terarsip diam-diam memindahkan transaksi ke akun lain

- **Lokasi:** `src/routes/(app)/accounts/[id]/+page.svelte:331`
- **Fix:** Sheet edit kini menerima `data.allAccounts` sehingga akun terarsip tetap dikenali dan `accountId` tidak di-reset ke akun pertama.

### 6. ✅ Total Balance di /accounts menjumlahkan mata uang campuran

- **Lokasi:** `src/routes/(app)/accounts/+page.svelte:101-102`
- **Fix:** Total kini dikelompokkan per currency — currency dominan tampil besar, sisanya sebagai baris kecil, plus indikator "mixed currencies". Detail debt (`debts/[id]`) kini konsisten memakai `IDR` seperti `/debts`, bukan currency akun pertama.

### 7. ✅ Reorder kategori menghasilkan `sortOrder` yang bentrok

- **Lokasi:** `src/routes/(app)/categories/+page.svelte:108+` (persistOrder) dan `src/lib/server/repositories/categories.ts:87-99` (reorderCategories)
- **Fix:** `reorderCategories` kini me-renumber seluruh kategori user: offset per kind (expense 0.., income 100000..) agar picker gabungan tidak bentrok, kategori yang tidak dikirim (terarsip / kind lain) ditempatkan setelahnya dengan urutan relatif tetap. `persistOrder` kini `invalidateAll()` setelah sukses agar `data` sinkron.

### 8. ✅ Chart dashboard mati permanen setelah sekali gagal load

- **Lokasi:** `src/routes/(app)/dashboard/+page.svelte:10-24` dan `:108`
- **Fix:** `chartLoadPromise` di-reset ke `null` saat reject (mount berikutnya retry), rejection ditangkap di `onMount` (tidak ada unhandled rejection), dan tab mobile hanya merender chart miliknya (`chartTab === 'trend'` untuk fallback trend).

## Rendah

### 9. ✅ Deteksi telat bayar debt memakai hari kalender UTC, bukan cycle & timezone user

- **Lokasi:** `src/routes/(app)/+layout.server.ts:181-185`
- **Fix:** Kini memakai `getZonedYearMonthDay(new Date(), timezone)` dari `src/lib/utils/cycle.ts`. Bonus: cek "sudah bayar di cycle ini" kini mengikuti arah debt (`lent` → `income`), jadi debt lent yang sudah ditagih tidak salah ditandai `in_arrears`.

### 10. ✅ Interest tidak accrue selama debt berstatus `in_arrears`

- **Lokasi:** `src/routes/(app)/+layout.server.ts:157-163`
- **Fix:** Filter accrual kini mengikutkan `in_arrears` selain `active`.

### 11. ✅ Snowball bisa memilih debt balance 0 sebagai "Pay first"

- **Lokasi:** `src/lib/utils/debt.ts:51` (`prioritizedDebtIds`)
- **Fix:** Debt dengan balance ≤ 0 kini selalu diurutkan paling belakang, dan `topPriorityDebtId` di halaman debts hanya diberikan bila balance-nya > 0.

### 12. ✅ Deep-link `?edit=` dari detail akun terarsip kehilangan konteks `archived=1`

- **Lokasi:** `src/routes/(app)/accounts/+page.svelte:119-126` dan link pensil di `accounts/[id]/+page.svelte`
- **Fix:** Link pensil menyertakan `&archived=1` untuk akun terarsip, dan `editId` yang tidak resolve kini menampilkan notifikasi "Account not found".

### 13. ✅ Progress cycle di dashboard beku

- **Lokasi:** `src/routes/(app)/dashboard/+page.svelte:58-63`
- **Fix:** `now` kini `$state` yang di-update tiap 60 detik via interval dan saat `visibilitychange` (tab kembali visible).

### 14. ✅ Fallback locale label cycle berbeda antara client dan server

- **Lokasi:** `src/routes/(app)/dashboard/+page.svelte:45-56`
- **Fix:** Dashboard kini memakai `data.periodLabel` yang sudah diformat server (fallback `id-ID` konsisten).

### 15. ✅ Banner saran debt-budget masih match nama persis

- **Lokasi:** `src/routes/(app)/budgets/+page.svelte:104-106`
- **Fix:** Kategori sistem kini ditandai kolom `system_key` di DB (migrasi `0016_add_category_system_key.sql`, backfill by name untuk row lama). Semua fungsi `ensure*Category` (Debt Payment, Money Lent Out, Loan Collected, Loan Proceeds, Balance Adjustment) resolve by key **dan kind** — dengan adopsi otomatis row legacy by name — sehingga rename tidak membuat duplikat dan kategori yang kind-nya diubah user tidak dipakai ulang untuk fitur yang salah kind. Key dibagikan lewat `$lib/utils/system-categories.ts` (client-safe). Konsumen by-name lain ikut dimigrasi: banner budgets, auto-kategori debt di `add-transaction-sheet.svelte`, dan exclusion income di `computeFinancialHealth` (`dashboard-stats.ts`) — semuanya systemKey-first dengan fallback nama. Catatan: `.gitignore` juga diperbaiki (`!drizzle/*.sql`) karena rule `*.sql` sempat menelan file migrasi (0014 pernah hilang dengan cara ini; 0014 dan 0016 sekarang ikut ter-commit).
