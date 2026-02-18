CREATE TABLE `assertions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('organization','facility','program') NOT NULL,
	`entityId` int NOT NULL,
	`fieldPath` varchar(200) NOT NULL,
	`valueJson` json,
	`confidence` float NOT NULL DEFAULT 0.5,
	`method` enum('rule','llm','human') NOT NULL DEFAULT 'llm',
	`sourceId` int,
	`sourceExcerpt` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assertions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `facilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int,
	`name` varchar(500) NOT NULL,
	`facilityType` enum('hospital','clinic','residential','detox_center','telehealth_only','unknown') NOT NULL DEFAULT 'unknown',
	`addressLine1` varchar(500),
	`addressLine2` varchar(500),
	`city` varchar(200),
	`state` varchar(100),
	`postalCode` varchar(20),
	`country` varchar(100) DEFAULT 'US',
	`lat` decimal(10,7),
	`lng` decimal(10,7),
	`phoneIntake` varchar(50),
	`emailIntake` varchar(320),
	`agesServedMin` int,
	`agesServedMax` int,
	`languages` json,
	`description` text,
	`imageUrl` varchar(1000),
	`status` enum('active','closed','unknown') NOT NULL DEFAULT 'unknown',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastVerifiedAt` timestamp,
	CONSTRAINT `facilities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ingestion_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobType` enum('ingest_seed_url','crawl_domain','recrawl_entity','refresh_stale') NOT NULL,
	`payload` json,
	`jobStatus` enum('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 3,
	`errorMessage` text,
	`result` json,
	`createdBy` int,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ingestion_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(500) NOT NULL,
	`websiteDomain` varchar(500),
	`phoneMain` varchar(50),
	`ownershipType` varchar(100),
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastVerifiedAt` timestamp,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `program_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`programId` int NOT NULL,
	`tagId` int NOT NULL,
	`confidence` float NOT NULL DEFAULT 0.5,
	CONSTRAINT `program_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `pt_prog_tag_idx` UNIQUE(`programId`,`tagId`)
);
--> statement-breakpoint
CREATE TABLE `programs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int,
	`facilityId` int,
	`name` varchar(500) NOT NULL,
	`levelOfCare` enum('crisis','inpatient','residential','php','iop','outpatient','detox','sober_living','aftercare','unknown') NOT NULL DEFAULT 'unknown',
	`telehealthAvailable` boolean DEFAULT false,
	`schedule` json,
	`lengthOfStay` json,
	`medicalCapability` json,
	`paymentOptions` json,
	`insuranceNotes` text,
	`description` text,
	`programStatus` enum('active','closed','unknown') NOT NULL DEFAULT 'unknown',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastVerifiedAt` timestamp,
	CONSTRAINT `programs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uri` varchar(2000) NOT NULL,
	`domain` varchar(500),
	`retrievedAt` timestamp NOT NULL DEFAULT (now()),
	`contentHash` varchar(64),
	`contentType` enum('html','pdf','other') DEFAULT 'html',
	`title` varchar(1000),
	`rawText` text,
	`robotsAllowed` boolean,
	`httpStatus` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`namespace` enum('level_of_care','modality','specialty','condition','population','payer','amenity') NOT NULL,
	`label` varchar(200) NOT NULL,
	`synonyms` json,
	`parentId` int,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tag_ns_label_idx` UNIQUE(`namespace`,`label`)
);
--> statement-breakpoint
CREATE TABLE `user_needs_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(100),
	`userId` int,
	`location` varchar(300),
	`lat` decimal(10,7),
	`lng` decimal(10,7),
	`distanceMiles` int DEFAULT 50,
	`levelOfCareTarget` json,
	`ageGroup` varchar(50),
	`primaryConcerns` json,
	`substanceRelated` boolean,
	`substanceList` json,
	`telehealthOk` boolean,
	`insuranceType` json,
	`budget` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_needs_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `assertions` ADD CONSTRAINT `assertions_sourceId_sources_id_fk` FOREIGN KEY (`sourceId`) REFERENCES `sources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `facilities` ADD CONSTRAINT `facilities_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ingestion_jobs` ADD CONSTRAINT `ingestion_jobs_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `program_tags` ADD CONSTRAINT `program_tags_programId_programs_id_fk` FOREIGN KEY (`programId`) REFERENCES `programs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `program_tags` ADD CONSTRAINT `program_tags_tagId_tags_id_fk` FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `programs` ADD CONSTRAINT `programs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `programs` ADD CONSTRAINT `programs_facilityId_facilities_id_fk` FOREIGN KEY (`facilityId`) REFERENCES `facilities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_needs_profiles` ADD CONSTRAINT `user_needs_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `assert_entity_idx` ON `assertions` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `assert_field_idx` ON `assertions` (`entityType`,`entityId`,`fieldPath`);--> statement-breakpoint
CREATE INDEX `assert_source_idx` ON `assertions` (`sourceId`);--> statement-breakpoint
CREATE INDEX `fac_org_idx` ON `facilities` (`organizationId`);--> statement-breakpoint
CREATE INDEX `fac_state_city_idx` ON `facilities` (`state`,`city`);--> statement-breakpoint
CREATE INDEX `fac_name_idx` ON `facilities` (`name`);--> statement-breakpoint
CREATE INDEX `fac_lat_lng_idx` ON `facilities` (`lat`,`lng`);--> statement-breakpoint
CREATE INDEX `job_status_idx` ON `ingestion_jobs` (`jobStatus`);--> statement-breakpoint
CREATE INDEX `job_type_idx` ON `ingestion_jobs` (`jobType`);--> statement-breakpoint
CREATE INDEX `job_created_idx` ON `ingestion_jobs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `org_domain_idx` ON `organizations` (`websiteDomain`);--> statement-breakpoint
CREATE INDEX `org_name_idx` ON `organizations` (`name`);--> statement-breakpoint
CREATE INDEX `pt_prog_idx` ON `program_tags` (`programId`);--> statement-breakpoint
CREATE INDEX `pt_tag_idx` ON `program_tags` (`tagId`);--> statement-breakpoint
CREATE INDEX `prog_org_idx` ON `programs` (`organizationId`);--> statement-breakpoint
CREATE INDEX `prog_fac_idx` ON `programs` (`facilityId`);--> statement-breakpoint
CREATE INDEX `prog_loc_idx` ON `programs` (`levelOfCare`);--> statement-breakpoint
CREATE INDEX `prog_name_idx` ON `programs` (`name`);--> statement-breakpoint
CREATE INDEX `src_domain_idx` ON `sources` (`domain`);--> statement-breakpoint
CREATE INDEX `src_uri_idx` ON `sources` (`uri`);--> statement-breakpoint
CREATE INDEX `tag_ns_idx` ON `tags` (`namespace`);