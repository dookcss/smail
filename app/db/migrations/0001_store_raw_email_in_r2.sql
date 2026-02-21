ALTER TABLE `emails` ADD `raw_email_r2_key` text;
--> statement-breakpoint
ALTER TABLE `emails` ADD `raw_email_r2_bucket` text;
--> statement-breakpoint
ALTER TABLE `emails` ADD `raw_email_upload_status` text NOT NULL DEFAULT 'pending';