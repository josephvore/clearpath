CREATE TABLE `assertions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('organization','facility','program') NOT NULL,
	`entityId` int NOT NULL,
	`fieldPath` varchar(200) NOT NULL,
	`valueJson` json,
	`confidence` float NOT NULL DEFAULT 0.5,
	`method` enum('rule','llm','human','api','validation') NOT NULL DEFAULT 'llm',
	`validated` boolean DEFAULT false,
	`validationResult` enum('pass','fail','skip'),
	`sourceId` int,
	`sourceExcerpt` text,
	`supersededBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assertions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crawl_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int,
	`uri` varchar(2000) NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`rawHtml` text,
	`cleanText` text,
	`httpStatus` int,
	`headers` json,
	`crawledAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crawl_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `facilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int,
	`name` varchar(500) NOT NULL,
	`facilityType` enum('hospital','clinic','residential','detox_center','sober_living','php_facility','iop_facility','telehealth_only','crisis_center','mat_clinic','unknown') NOT NULL DEFAULT 'unknown',
	`phone` varchar(50),
	`phoneVerified` boolean DEFAULT false,
	`email` varchar(320),
	`website` varchar(2000),
	`websiteStatus` enum('live','dead','redirect','unknown') DEFAULT 'unknown',
	`addressLine1` varchar(500),
	`addressLine2` varchar(500),
	`city` varchar(200),
	`state` varchar(100),
	`postalCode` varchar(20),
	`country` varchar(100) DEFAULT 'US',
	`lat` decimal(10,7),
	`lng` decimal(10,7),
	`addressVerified` boolean DEFAULT false,
	`acceptedInsurance` json,
	`paymentOptions` json,
	`specializations` json,
	`substancesTreated` json,
	`treatmentApproaches` json,
	`ageGroups` json,
	`genderPolicy` enum('co_ed','male_only','female_only','lgbtq_affirming','unknown') DEFAULT 'unknown',
	`languages` json,
	`amenities` json,
	`accreditations` json,
	`licenseNumber` varchar(200),
	`samhsaId` varchar(100),
	`capacity` int,
	`avgLengthOfStay` varchar(200),
	`admissionsProcess` text,
	`eligibility` text,
	`costRange` varchar(300),
	`hours` varchar(500),
	`description` text,
	`imageUrl` varchar(1000),
	`status` enum('active','closed','unknown') NOT NULL DEFAULT 'unknown',
	`qualityScore` float,
	`completenessScore` float,
	`freshnessScore` float,
	`validationPassRate` float,
	`recrawlTier` enum('weekly','monthly','quarterly') DEFAULT 'monthly',
	`lastCrawledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastVerifiedAt` timestamp,
	CONSTRAINT `facilities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `facility_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`facilityId` int NOT NULL,
	`tagId` int NOT NULL,
	`confidence` float NOT NULL DEFAULT 0.5,
	CONSTRAINT `facility_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `ft_fac_tag_idx` UNIQUE(`facilityId`,`tagId`)
);
--> statement-breakpoint
CREATE TABLE `field_changes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`changeEntityType` enum('organization','facility','program') NOT NULL,
	`entityId` int NOT NULL,
	`fieldPath` varchar(200) NOT NULL,
	`oldValue` json,
	`newValue` json,
	`reason` varchar(500),
	`sourceId` int,
	`changedBy` enum('pipeline','human','api') DEFAULT 'pipeline',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `field_changes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ingestion_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobType` enum('ingest_seed_url','crawl_domain','recrawl_entity','refresh_stale','samhsa_import','validate_phones','validate_urls','compute_quality') NOT NULL,
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
	`websiteUrl` varchar(2000),
	`phoneMain` varchar(50),
	`ownershipType` varchar(100),
	`description` text,
	`accreditations` json,
	`npiNumber` varchar(20),
	`qualityScore` float,
	`completenessScore` float,
	`freshnessScore` float,
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
	`programType` enum('detox','residential','php','iop','outpatient','aftercare','family','sober_living','crisis','unknown') DEFAULT 'unknown',
	`levelOfCare` enum('crisis','inpatient','residential','php','iop','outpatient','detox','sober_living','aftercare','unknown') NOT NULL DEFAULT 'unknown',
	`telehealthAvailable` boolean DEFAULT false,
	`duration` varchar(300),
	`scheduleText` varchar(500),
	`schedule` json,
	`lengthOfStay` json,
	`medicalCapability` json,
	`specializations` json,
	`paymentOptions` json,
	`insuranceNotes` text,
	`eligibility` text,
	`description` text,
	`programStatus` enum('active','closed','unknown') NOT NULL DEFAULT 'unknown',
	`qualityScore` float,
	`completenessScore` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastVerifiedAt` timestamp,
	CONSTRAINT `programs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewType` enum('low_confidence','merge_conflict','user_flag','validation_fail','new_entity','duplicate_suspect') NOT NULL,
	`reviewEntityType` enum('organization','facility','program') NOT NULL,
	`entityId` int NOT NULL,
	`relatedEntityId` int,
	`reviewPriority` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`reviewStatus` enum('pending','in_review','approved','rejected','merged') NOT NULL DEFAULT 'pending',
	`details` json,
	`assignedTo` int,
	`resolvedBy` int,
	`resolvedAt` timestamp,
	`resolution` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `review_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uri` varchar(2000) NOT NULL,
	`domain` varchar(500),
	`sourceType` enum('facility_website','samhsa','state_licensing','google_places','directory','user_submission','other') DEFAULT 'other',
	`sourcePriority` int DEFAULT 5,
	`retrievedAt` timestamp NOT NULL DEFAULT (now()),
	`contentHash` varchar(64),
	`contentType` enum('html','pdf','json','csv','other') DEFAULT 'html',
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
	`namespace` enum('level_of_care','modality','specialty','condition','population','payer','amenity','substance','treatment_approach','accreditation','insurance_carrier') NOT NULL,
	`label` varchar(200) NOT NULL,
	`canonicalLabel` varchar(200),
	`synonyms` json,
	`parentId` int,
	`description` text,
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
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `assertions` ADD CONSTRAINT `assertions_sourceId_sources_id_fk` FOREIGN KEY (`sourceId`) REFERENCES `sources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `crawl_snapshots` ADD CONSTRAINT `crawl_snapshots_sourceId_sources_id_fk` FOREIGN KEY (`sourceId`) REFERENCES `sources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `facilities` ADD CONSTRAINT `facilities_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `facility_tags` ADD CONSTRAINT `facility_tags_facilityId_facilities_id_fk` FOREIGN KEY (`facilityId`) REFERENCES `facilities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `facility_tags` ADD CONSTRAINT `facility_tags_tagId_tags_id_fk` FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `field_changes` ADD CONSTRAINT `field_changes_sourceId_sources_id_fk` FOREIGN KEY (`sourceId`) REFERENCES `sources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ingestion_jobs` ADD CONSTRAINT `ingestion_jobs_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `program_tags` ADD CONSTRAINT `program_tags_programId_programs_id_fk` FOREIGN KEY (`programId`) REFERENCES `programs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `program_tags` ADD CONSTRAINT `program_tags_tagId_tags_id_fk` FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `programs` ADD CONSTRAINT `programs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `programs` ADD CONSTRAINT `programs_facilityId_facilities_id_fk` FOREIGN KEY (`facilityId`) REFERENCES `facilities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_queue` ADD CONSTRAINT `review_queue_assignedTo_users_id_fk` FOREIGN KEY (`assignedTo`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_queue` ADD CONSTRAINT `review_queue_resolvedBy_users_id_fk` FOREIGN KEY (`resolvedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_needs_profiles` ADD CONSTRAINT `user_needs_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `assert_entity_idx` ON `assertions` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `assert_field_idx` ON `assertions` (`entityType`,`entityId`,`fieldPath`);--> statement-breakpoint
CREATE INDEX `assert_source_idx` ON `assertions` (`sourceId`);--> statement-breakpoint
CREATE INDEX `assert_validated_idx` ON `assertions` (`validated`);--> statement-breakpoint
CREATE INDEX `snap_source_idx` ON `crawl_snapshots` (`sourceId`);--> statement-breakpoint
CREATE INDEX `snap_uri_idx` ON `crawl_snapshots` (`uri`);--> statement-breakpoint
CREATE INDEX `snap_crawled_idx` ON `crawl_snapshots` (`crawledAt`);--> statement-breakpoint
CREATE INDEX `fac_org_idx` ON `facilities` (`organizationId`);--> statement-breakpoint
CREATE INDEX `fac_state_city_idx` ON `facilities` (`state`,`city`);--> statement-breakpoint
CREATE INDEX `fac_name_idx` ON `facilities` (`name`);--> statement-breakpoint
CREATE INDEX `fac_lat_lng_idx` ON `facilities` (`lat`,`lng`);--> statement-breakpoint
CREATE INDEX `fac_quality_idx` ON `facilities` (`qualityScore`);--> statement-breakpoint
CREATE INDEX `fac_samhsa_idx` ON `facilities` (`samhsaId`);--> statement-breakpoint
CREATE INDEX `fac_recrawl_idx` ON `facilities` (`recrawlTier`,`lastCrawledAt`);--> statement-breakpoint
CREATE INDEX `ft_fac_idx` ON `facility_tags` (`facilityId`);--> statement-breakpoint
CREATE INDEX `ft_tag_idx` ON `facility_tags` (`tagId`);--> statement-breakpoint
CREATE INDEX `fc_entity_idx` ON `field_changes` (`changeEntityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `fc_field_idx` ON `field_changes` (`changeEntityType`,`entityId`,`fieldPath`);--> statement-breakpoint
CREATE INDEX `fc_created_idx` ON `field_changes` (`createdAt`);--> statement-breakpoint
CREATE INDEX `job_status_idx` ON `ingestion_jobs` (`jobStatus`);--> statement-breakpoint
CREATE INDEX `job_type_idx` ON `ingestion_jobs` (`jobType`);--> statement-breakpoint
CREATE INDEX `job_created_idx` ON `ingestion_jobs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `org_domain_idx` ON `organizations` (`websiteDomain`);--> statement-breakpoint
CREATE INDEX `org_name_idx` ON `organizations` (`name`);--> statement-breakpoint
CREATE INDEX `org_quality_idx` ON `organizations` (`qualityScore`);--> statement-breakpoint
CREATE INDEX `pt_prog_idx` ON `program_tags` (`programId`);--> statement-breakpoint
CREATE INDEX `pt_tag_idx` ON `program_tags` (`tagId`);--> statement-breakpoint
CREATE INDEX `prog_org_idx` ON `programs` (`organizationId`);--> statement-breakpoint
CREATE INDEX `prog_fac_idx` ON `programs` (`facilityId`);--> statement-breakpoint
CREATE INDEX `prog_loc_idx` ON `programs` (`levelOfCare`);--> statement-breakpoint
CREATE INDEX `prog_name_idx` ON `programs` (`name`);--> statement-breakpoint
CREATE INDEX `prog_quality_idx` ON `programs` (`qualityScore`);--> statement-breakpoint
CREATE INDEX `rq_status_idx` ON `review_queue` (`reviewStatus`);--> statement-breakpoint
CREATE INDEX `rq_priority_idx` ON `review_queue` (`reviewPriority`);--> statement-breakpoint
CREATE INDEX `rq_entity_idx` ON `review_queue` (`reviewEntityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `rq_type_idx` ON `review_queue` (`reviewType`);--> statement-breakpoint
CREATE INDEX `rq_assigned_idx` ON `review_queue` (`assignedTo`);--> statement-breakpoint
CREATE INDEX `src_domain_idx` ON `sources` (`domain`);--> statement-breakpoint
CREATE INDEX `src_uri_idx` ON `sources` (`uri`);--> statement-breakpoint
CREATE INDEX `src_type_idx` ON `sources` (`sourceType`);--> statement-breakpoint
CREATE INDEX `src_priority_idx` ON `sources` (`sourcePriority`);--> statement-breakpoint
CREATE INDEX `tag_ns_idx` ON `tags` (`namespace`);--> statement-breakpoint
CREATE INDEX `tag_canonical_idx` ON `tags` (`canonicalLabel`);