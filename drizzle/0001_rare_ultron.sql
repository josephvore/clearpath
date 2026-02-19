CREATE TABLE `bookmarks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`programId` int NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookmarks_id` PRIMARY KEY(`id`),
	CONSTRAINT `bm_user_program_idx` UNIQUE(`userId`,`programId`)
);
--> statement-breakpoint
ALTER TABLE `bookmarks` ADD CONSTRAINT `bookmarks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookmarks` ADD CONSTRAINT `bookmarks_programId_programs_id_fk` FOREIGN KEY (`programId`) REFERENCES `programs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `bm_user_idx` ON `bookmarks` (`userId`);--> statement-breakpoint
CREATE INDEX `bm_program_idx` ON `bookmarks` (`programId`);