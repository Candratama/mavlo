ALTER TABLE `categories` ADD `system_key` text;--> statement-breakpoint
UPDATE `categories` SET `system_key` = 'debt_payment' WHERE `system_key` IS NULL AND `name` = 'Debt Payment' AND `kind` = 'expense';--> statement-breakpoint
UPDATE `categories` SET `system_key` = 'money_lent_out' WHERE `system_key` IS NULL AND `name` = 'Money Lent Out' AND `kind` = 'expense';--> statement-breakpoint
UPDATE `categories` SET `system_key` = 'loan_collected' WHERE `system_key` IS NULL AND `name` = 'Loan Collected' AND `kind` = 'income';--> statement-breakpoint
UPDATE `categories` SET `system_key` = 'loan_proceeds' WHERE `system_key` IS NULL AND `name` = 'Loan Proceeds' AND `kind` = 'income';--> statement-breakpoint
UPDATE `categories` SET `system_key` = 'adjustment_income' WHERE `system_key` IS NULL AND `name` = 'Balance Adjustment' AND `kind` = 'income';--> statement-breakpoint
UPDATE `categories` SET `system_key` = 'adjustment_expense' WHERE `system_key` IS NULL AND `name` = 'Balance Adjustment' AND `kind` = 'expense';
