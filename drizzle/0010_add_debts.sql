CREATE TABLE `debts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`lender` text,
	`principal_cents` integer NOT NULL,
	`current_balance_cents` integer NOT NULL,
	`interest_rate_pct` integer DEFAULT 0 NOT NULL,
	`minimum_payment_cents` integer DEFAULT 0 NOT NULL,
	`due_day` integer,
	`start_date` integer NOT NULL,
	`maturity_date` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`account_id` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `debts_user_idx` ON `debts` (`user_id`);--> statement-breakpoint
CREATE INDEX `debts_user_status_idx` ON `debts` (`user_id`,`status`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `debt_id` text REFERENCES debts(id);--> statement-breakpoint
CREATE INDEX `tx_debt_idx` ON `transactions` (`debt_id`);