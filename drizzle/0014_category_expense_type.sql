ALTER TABLE categories ADD COLUMN expense_type text NOT NULL DEFAULT 'variable';

UPDATE categories
SET expense_type = 'fixed'
WHERE kind = 'expense'
  AND name IN ('Home Rent', 'Internet', 'Electricity', 'Monthly Service', 'Debt Payment');
