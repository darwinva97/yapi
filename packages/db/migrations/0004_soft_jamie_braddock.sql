DROP TABLE `phone_codes`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`handle` text NOT NULL,
	`email` text,
	`phone` text,
	`firebase_uid` text,
	`color` text NOT NULL,
	`auth_provider` text DEFAULT 'firebase' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "name", "handle", "email", "phone", "firebase_uid", "color", "auth_provider", "created_at") SELECT "id", "name", "handle", "email", "phone", "firebase_uid", "color", "auth_provider", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_handle_unique` ON `users` (`handle`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_firebase_uid_unique` ON `users` (`firebase_uid`);