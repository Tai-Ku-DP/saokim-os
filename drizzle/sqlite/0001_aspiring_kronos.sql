ALTER TABLE `checklist_item` ADD `file_id` text REFERENCES file_asset(id);--> statement-breakpoint
ALTER TABLE `checklist_item` ADD `submitted_at` integer;