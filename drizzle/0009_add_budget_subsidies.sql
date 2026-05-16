CREATE TABLE `budget_subsidies` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`period_month` text NOT NULL,
	`from_budget_id` text NOT NULL,
	`to_budget_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_budget_id`) REFERENCES `budgets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_budget_id`) REFERENCES `budgets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `subsidies_user_period_idx` ON `budget_subsidies` (`user_id`,`period_month`);--> statement-breakpoint
CREATE INDEX `subsidies_from_idx` ON `budget_subsidies` (`from_budget_id`);--> statement-breakpoint
CREATE INDEX `subsidies_to_idx` ON `budget_subsidies` (`to_budget_id`);