CREATE TABLE `channel_integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`url` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `channel_integrations_channel_idx` ON `channel_integrations` (`channel_id`);