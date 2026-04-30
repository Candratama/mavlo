ALTER TABLE `users` ADD `is_demo` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE INDEX `users_is_demo_idx` ON `users` (`is_demo`);
