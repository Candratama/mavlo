# Financial Health Card Design

## Goal

Add a dashboard card that explains monthly financial health using the active finance cycle. The card should separate real income from non-operating inflows so users do not mistake loans or balance adjustments for earnings.

## Scope

V1 adds one dashboard section: Financial Health. It is rule-based, not AI-generated.

Included:
- Use active cycle boundaries with half-open range: `start <= occurred_at < end`.
- Add expense classification to categories: `fixed` or `variable`.
- Gross income: all income transactions in cycle.
- Excluded income: categories named `Loan Proceeds` and `Balance Adjustment`.
- Real income: gross income minus excluded income.
- Expense: all expense transactions in cycle.
- Fixed expense total and variable expense total.
- Real net: real income minus expense.
- Top expense leaks: top 3 variable expense categories by amount, falling back to all expense categories only when no variable categories exist.
- Status: healthy, warning, or danger.
- Advice text explaining key issue and next action.

Excluded:
- AI advice generation.
- New budget editing flow.
- Debt payoff planning.
- Data cleanup automation.
- More granular labels like `saving`, `debt`, `essential`, `discretionary`, or recurring schedule detection.

## User Experience

Dashboard shows a card with:
- Status label.
- Real income.
- Expense.
- Real net.
- Fixed expense total.
- Variable expense total.
- Excluded income total.
- Top 3 variable expense categories.
- Short advice sentence.

Category create/edit forms let users mark expense categories as fixed or variable. Income categories do not show this control.

Example copy:

> Real income Rp18,55jt. Expense Rp20,45jt. Defisit riil Rp1,90jt. Pinjaman Rp1,15jt tidak dihitung sebagai income. Kurangi Food & Beverage, Other, atau subscription bulan depan.

## Status Rules

- `danger`: real net < 0.
- `warning`: real net >= 0 and real net < 10% of real income.
- `healthy`: real net >= 10% of real income.

If real income is zero, status is `danger` when expense > 0, otherwise `warning`.

## Category Classification

Expense categories get a required `expense_type` value:
- `fixed`: required or recurring expenses that are hard to reduce within the month, such as rent, internet, electricity, debt payment, and recurring subscriptions.
- `variable`: controllable expenses that can be reduced during the month, such as food, transport, shopping, gifts, travel, and other discretionary spending.

Existing expense categories are backfilled with a practical default:
- fixed: Home Rent, Internet, Electricity, Monthly Service, Debt Payment.
- variable: all other expense categories.

Users can edit this classification later from the category edit form.

## Data Flow

A schema migration adds `expense_type` to categories. Server load for dashboard calculates health metrics from transactions in the active cycle and category classifications. UI receives a plain object and renders the card. Formatting uses existing locale/currency preference.

## Testing

Unit tests cover:
- Half-open cycle boundary excludes next salary date.
- Loan proceeds excluded from real income.
- Balance adjustment excluded from real income.
- Fixed and variable expense totals split by category classification.
- Status rule outputs danger/warning/healthy.
- Top leak categories prefer variable expenses and order by amount.

Manual check:
- Dashboard renders card for Wahyu cycle 25 Apr <= tx < 25 May.
- Real income excludes Loan Proceeds and Balance Adjustment.
- Category form can set fixed or variable for expense categories.
