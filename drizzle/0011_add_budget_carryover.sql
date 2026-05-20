ALTER TABLE `budgets` ADD `carryover_deficit_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `budgets` ADD `carryover_from_period` text;
