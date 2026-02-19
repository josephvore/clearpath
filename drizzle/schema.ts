import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  float,
  boolean,
  index,
  uniqueIndex,
  decimal,
} from "drizzle-orm/mysql-core";

// ============================================================================
// Users (from template)
// ============================================================================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// Organizations
// ============================================================================

export const organizations = mysqlTable(
  "organizations",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 500 }).notNull(),
    websiteDomain: varchar("websiteDomain", { length: 500 }),
    websiteUrl: varchar("websiteUrl", { length: 2000 }),
    phoneMain: varchar("phoneMain", { length: 50 }),
    ownershipType: varchar("ownershipType", { length: 100 }),
    description: text("description"),
    // Enriched fields
    accreditations: json("accreditations").$type<string[]>(),
    npiNumber: varchar("npiNumber", { length: 20 }),
    // Quality scoring
    qualityScore: float("qualityScore"),
    completenessScore: float("completenessScore"),
    freshnessScore: float("freshnessScore"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastVerifiedAt: timestamp("lastVerifiedAt"),
  },
  (table) => [
    index("org_domain_idx").on(table.websiteDomain),
    index("org_name_idx").on(table.name),
    index("org_quality_idx").on(table.qualityScore),
  ]
);

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ============================================================================
// Facilities (enriched per spec)
// ============================================================================

export const facilities = mysqlTable(
  "facilities",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").references(() => organizations.id),
    name: varchar("name", { length: 500 }).notNull(),
    facilityType: mysqlEnum("facilityType", [
      "hospital",
      "clinic",
      "residential",
      "detox_center",
      "sober_living",
      "php_facility",
      "iop_facility",
      "telehealth_only",
      "crisis_center",
      "mat_clinic",
      "unknown",
    ])
      .default("unknown")
      .notNull(),
    // Contact
    phone: varchar("phone", { length: 50 }),
    phoneVerified: boolean("phoneVerified").default(false),
    email: varchar("email", { length: 320 }),
    website: varchar("website", { length: 2000 }),
    websiteStatus: mysqlEnum("websiteStatus", ["live", "dead", "redirect", "unknown"]).default("unknown"),
    // Address (structured)
    addressLine1: varchar("addressLine1", { length: 500 }),
    addressLine2: varchar("addressLine2", { length: 500 }),
    city: varchar("city", { length: 200 }),
    state: varchar("state", { length: 100 }),
    postalCode: varchar("postalCode", { length: 20 }),
    country: varchar("country", { length: 100 }).default("US"),
    lat: decimal("lat", { precision: 10, scale: 7 }),
    lng: decimal("lng", { precision: 10, scale: 7 }),
    addressVerified: boolean("addressVerified").default(false),
    // Enriched fields from spec
    acceptedInsurance: json("acceptedInsurance").$type<string[]>(),
    paymentOptions: json("paymentOptions").$type<string[]>(),
    specializations: json("specializations").$type<string[]>(),
    substancesTreated: json("substancesTreated").$type<string[]>(),
    treatmentApproaches: json("treatmentApproaches").$type<string[]>(),
    ageGroups: json("ageGroups").$type<string[]>(),
    genderPolicy: mysqlEnum("genderPolicy", [
      "co_ed",
      "male_only",
      "female_only",
      "lgbtq_affirming",
      "unknown",
    ]).default("unknown"),
    languages: json("languages").$type<string[]>(),
    amenities: json("amenities").$type<string[]>(),
    accreditations: json("accreditations").$type<string[]>(),
    licenseNumber: varchar("licenseNumber", { length: 200 }),
    samhsaId: varchar("samhsaId", { length: 100 }),
    capacity: int("capacity"),
    avgLengthOfStay: varchar("avgLengthOfStay", { length: 200 }),
    admissionsProcess: text("admissionsProcess"),
    eligibility: text("eligibility"),
    costRange: varchar("costRange", { length: 300 }),
    hours: varchar("hours", { length: 500 }),
    description: text("description"),
    imageUrl: varchar("imageUrl", { length: 1000 }),
    status: mysqlEnum("status", ["active", "closed", "unknown"])
      .default("unknown")
      .notNull(),
    // Quality scoring
    qualityScore: float("qualityScore"),
    completenessScore: float("completenessScore"),
    freshnessScore: float("freshnessScore"),
    validationPassRate: float("validationPassRate"),
    // Recrawl tier
    recrawlTier: mysqlEnum("recrawlTier", ["weekly", "monthly", "quarterly"]).default("monthly"),
    lastCrawledAt: timestamp("lastCrawledAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastVerifiedAt: timestamp("lastVerifiedAt"),
  },
  (table) => [
    index("fac_org_idx").on(table.organizationId),
    index("fac_state_city_idx").on(table.state, table.city),
    index("fac_name_idx").on(table.name),
    index("fac_lat_lng_idx").on(table.lat, table.lng),
    index("fac_quality_idx").on(table.qualityScore),
    index("fac_samhsa_idx").on(table.samhsaId),
    index("fac_recrawl_idx").on(table.recrawlTier, table.lastCrawledAt),
  ]
);

export type Facility = typeof facilities.$inferSelect;
export type InsertFacility = typeof facilities.$inferInsert;

// ============================================================================
// Programs (enriched per spec)
// ============================================================================

export const levelOfCareValues = [
  "crisis",
  "inpatient",
  "residential",
  "php",
  "iop",
  "outpatient",
  "detox",
  "sober_living",
  "aftercare",
  "unknown",
] as const;

export const programs = mysqlTable(
  "programs",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").references(() => organizations.id),
    facilityId: int("facilityId").references(() => facilities.id),
    name: varchar("name", { length: 500 }).notNull(),
    programType: mysqlEnum("programType", [
      "detox",
      "residential",
      "php",
      "iop",
      "outpatient",
      "aftercare",
      "family",
      "sober_living",
      "crisis",
      "unknown",
    ]).default("unknown"),
    levelOfCare: mysqlEnum("levelOfCare", [
      "crisis",
      "inpatient",
      "residential",
      "php",
      "iop",
      "outpatient",
      "detox",
      "sober_living",
      "aftercare",
      "unknown",
    ])
      .default("unknown")
      .notNull(),
    telehealthAvailable: boolean("telehealthAvailable").default(false),
    // Enriched schedule
    duration: varchar("duration", { length: 300 }),
    scheduleText: varchar("scheduleText", { length: 500 }),
    schedule: json("schedule").$type<{
      daysPerWeek?: number;
      hoursPerDay?: number;
      notes?: string;
    }>(),
    lengthOfStay: json("lengthOfStay").$type<{
      minDays?: number;
      maxDays?: number;
      typicalDays?: number;
    }>(),
    medicalCapability: json("medicalCapability").$type<{
      nursing247?: boolean;
      psychiatrist?: boolean;
      matAvailable?: boolean;
      medicallyManagedDetox?: boolean;
      notes?: string;
    }>(),
    // Enriched fields
    specializations: json("specializations").$type<string[]>(),
    paymentOptions: json("paymentOptions").$type<string[]>(),
    insuranceNotes: text("insuranceNotes"),
    eligibility: text("eligibility"),
    description: text("description"),
    status: mysqlEnum("programStatus", ["active", "closed", "unknown"])
      .default("unknown")
      .notNull(),
    // Quality scoring
    qualityScore: float("qualityScore"),
    completenessScore: float("completenessScore"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastVerifiedAt: timestamp("lastVerifiedAt"),
  },
  (table) => [
    index("prog_org_idx").on(table.organizationId),
    index("prog_fac_idx").on(table.facilityId),
    index("prog_loc_idx").on(table.levelOfCare),
    index("prog_name_idx").on(table.name),
    index("prog_quality_idx").on(table.qualityScore),
  ]
);

export type Program = typeof programs.$inferSelect;
export type InsertProgram = typeof programs.$inferInsert;

// ============================================================================
// Tags (Controlled Vocabulary / Taxonomy)
// ============================================================================

export const tags = mysqlTable(
  "tags",
  {
    id: int("id").autoincrement().primaryKey(),
    namespace: mysqlEnum("namespace", [
      "level_of_care",
      "modality",
      "specialty",
      "condition",
      "population",
      "payer",
      "amenity",
      "substance",
      "treatment_approach",
      "accreditation",
      "insurance_carrier",
    ]).notNull(),
    label: varchar("label", { length: 200 }).notNull(),
    canonicalLabel: varchar("canonicalLabel", { length: 200 }),
    synonyms: json("synonyms").$type<string[]>(),
    parentId: int("parentId"),
    description: text("description"),
    version: int("version").default(1).notNull(),
  },
  (table) => [
    index("tag_ns_idx").on(table.namespace),
    uniqueIndex("tag_ns_label_idx").on(table.namespace, table.label),
    index("tag_canonical_idx").on(table.canonicalLabel),
  ]
);

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

// ============================================================================
// Program Tags (junction)
// ============================================================================

export const programTags = mysqlTable(
  "program_tags",
  {
    id: int("id").autoincrement().primaryKey(),
    programId: int("programId")
      .references(() => programs.id)
      .notNull(),
    tagId: int("tagId")
      .references(() => tags.id)
      .notNull(),
    confidence: float("confidence").default(0.5).notNull(),
  },
  (table) => [
    index("pt_prog_idx").on(table.programId),
    index("pt_tag_idx").on(table.tagId),
    uniqueIndex("pt_prog_tag_idx").on(table.programId, table.tagId),
  ]
);

export type ProgramTag = typeof programTags.$inferSelect;
export type InsertProgramTag = typeof programTags.$inferInsert;

// ============================================================================
// Facility Tags (junction — tags can apply to facilities too)
// ============================================================================

export const facilityTags = mysqlTable(
  "facility_tags",
  {
    id: int("id").autoincrement().primaryKey(),
    facilityId: int("facilityId")
      .references(() => facilities.id)
      .notNull(),
    tagId: int("tagId")
      .references(() => tags.id)
      .notNull(),
    confidence: float("confidence").default(0.5).notNull(),
  },
  (table) => [
    index("ft_fac_idx").on(table.facilityId),
    index("ft_tag_idx").on(table.tagId),
    uniqueIndex("ft_fac_tag_idx").on(table.facilityId, table.tagId),
  ]
);

export type FacilityTag = typeof facilityTags.$inferSelect;
export type InsertFacilityTag = typeof facilityTags.$inferInsert;

// ============================================================================
// Sources (Provenance) — enhanced with versioning
// ============================================================================

export const sources = mysqlTable(
  "sources",
  {
    id: int("id").autoincrement().primaryKey(),
    uri: varchar("uri", { length: 2000 }).notNull(),
    domain: varchar("domain", { length: 500 }),
    sourceType: mysqlEnum("sourceType", [
      "facility_website",
      "samhsa",
      "state_licensing",
      "google_places",
      "directory",
      "user_submission",
      "other",
    ]).default("other"),
    // Source priority (1=highest)
    sourcePriority: int("sourcePriority").default(5),
    retrievedAt: timestamp("retrievedAt").defaultNow().notNull(),
    contentHash: varchar("contentHash", { length: 64 }),
    contentType: mysqlEnum("contentType", ["html", "pdf", "json", "csv", "other"]).default("html"),
    title: varchar("title", { length: 1000 }),
    rawText: text("rawText"),
    robotsAllowed: boolean("robotsAllowed"),
    httpStatus: int("httpStatus"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("src_domain_idx").on(table.domain),
    index("src_uri_idx").on(table.uri),
    index("src_type_idx").on(table.sourceType),
    index("src_priority_idx").on(table.sourcePriority),
  ]
);

export type Source = typeof sources.$inferSelect;
export type InsertSource = typeof sources.$inferInsert;

// ============================================================================
// Crawl Snapshots (raw content versioning)
// ============================================================================

export const crawlSnapshots = mysqlTable(
  "crawl_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    sourceId: int("sourceId").references(() => sources.id),
    uri: varchar("uri", { length: 2000 }).notNull(),
    contentHash: varchar("contentHash", { length: 64 }).notNull(),
    rawHtml: text("rawHtml"),
    cleanText: text("cleanText"),
    httpStatus: int("httpStatus"),
    headers: json("headers").$type<Record<string, string>>(),
    crawledAt: timestamp("crawledAt").defaultNow().notNull(),
  },
  (table) => [
    index("snap_source_idx").on(table.sourceId),
    index("snap_uri_idx").on(table.uri),
    index("snap_crawled_idx").on(table.crawledAt),
  ]
);

export type CrawlSnapshot = typeof crawlSnapshots.$inferSelect;
export type InsertCrawlSnapshot = typeof crawlSnapshots.$inferInsert;

// ============================================================================
// Assertions (AI claims with provenance) — enhanced with per-field confidence
// ============================================================================

export const assertions = mysqlTable(
  "assertions",
  {
    id: int("id").autoincrement().primaryKey(),
    entityType: mysqlEnum("entityType", [
      "organization",
      "facility",
      "program",
    ]).notNull(),
    entityId: int("entityId").notNull(),
    fieldPath: varchar("fieldPath", { length: 200 }).notNull(),
    valueJson: json("valueJson"),
    confidence: float("confidence").default(0.5).notNull(),
    method: mysqlEnum("method", ["rule", "llm", "human", "api", "validation"]).default("llm").notNull(),
    validated: boolean("validated").default(false),
    validationResult: mysqlEnum("validationResult", ["pass", "fail", "skip"]),
    sourceId: int("sourceId").references(() => sources.id),
    sourceExcerpt: text("sourceExcerpt"),
    supersededBy: int("supersededBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("assert_entity_idx").on(table.entityType, table.entityId),
    index("assert_field_idx").on(
      table.entityType,
      table.entityId,
      table.fieldPath
    ),
    index("assert_source_idx").on(table.sourceId),
    index("assert_validated_idx").on(table.validated),
  ]
);

export type Assertion = typeof assertions.$inferSelect;
export type InsertAssertion = typeof assertions.$inferInsert;

// ============================================================================
// Field Changes (changelog for every field update)
// ============================================================================

export const fieldChanges = mysqlTable(
  "field_changes",
  {
    id: int("id").autoincrement().primaryKey(),
    entityType: mysqlEnum("changeEntityType", [
      "organization",
      "facility",
      "program",
    ]).notNull(),
    entityId: int("entityId").notNull(),
    fieldPath: varchar("fieldPath", { length: 200 }).notNull(),
    oldValue: json("oldValue"),
    newValue: json("newValue"),
    reason: varchar("reason", { length: 500 }),
    sourceId: int("sourceId").references(() => sources.id),
    changedBy: mysqlEnum("changedBy", ["pipeline", "human", "api"]).default("pipeline"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("fc_entity_idx").on(table.entityType, table.entityId),
    index("fc_field_idx").on(table.entityType, table.entityId, table.fieldPath),
    index("fc_created_idx").on(table.createdAt),
  ]
);

export type FieldChange = typeof fieldChanges.$inferSelect;
export type InsertFieldChange = typeof fieldChanges.$inferInsert;

// ============================================================================
// Human Review Queue
// ============================================================================

export const reviewQueue = mysqlTable(
  "review_queue",
  {
    id: int("id").autoincrement().primaryKey(),
    reviewType: mysqlEnum("reviewType", [
      "low_confidence",
      "merge_conflict",
      "user_flag",
      "validation_fail",
      "new_entity",
      "duplicate_suspect",
    ]).notNull(),
    entityType: mysqlEnum("reviewEntityType", [
      "organization",
      "facility",
      "program",
    ]).notNull(),
    entityId: int("entityId").notNull(),
    relatedEntityId: int("relatedEntityId"),
    priority: mysqlEnum("reviewPriority", ["critical", "high", "medium", "low"]).default("medium").notNull(),
    status: mysqlEnum("reviewStatus", ["pending", "in_review", "approved", "rejected", "merged"]).default("pending").notNull(),
    details: json("details").$type<{
      reason?: string;
      fields?: string[];
      conflictingValues?: Record<string, any>;
      matchScore?: number;
      suggestedAction?: string;
    }>(),
    assignedTo: int("assignedTo").references(() => users.id),
    resolvedBy: int("resolvedBy").references(() => users.id),
    resolvedAt: timestamp("resolvedAt"),
    resolution: text("resolution"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("rq_status_idx").on(table.status),
    index("rq_priority_idx").on(table.priority),
    index("rq_entity_idx").on(table.entityType, table.entityId),
    index("rq_type_idx").on(table.reviewType),
    index("rq_assigned_idx").on(table.assignedTo),
  ]
);

export type ReviewQueueItem = typeof reviewQueue.$inferSelect;
export type InsertReviewQueueItem = typeof reviewQueue.$inferInsert;

// ============================================================================
// Ingestion Jobs (Queue) — enhanced
// ============================================================================

export const ingestionJobs = mysqlTable(
  "ingestion_jobs",
  {
    id: int("id").autoincrement().primaryKey(),
    jobType: mysqlEnum("jobType", [
      "ingest_seed_url",
      "crawl_domain",
      "recrawl_entity",
      "refresh_stale",
      "samhsa_import",
      "validate_phones",
      "validate_urls",
      "compute_quality",
    ]).notNull(),
    payload: json("payload").$type<{
      url?: string;
      domain?: string;
      depthLimit?: number;
      entityType?: string;
      entityId?: number;
      lastVerifiedBefore?: string;
      batchSize?: number;
    }>(),
    status: mysqlEnum("jobStatus", [
      "pending",
      "running",
      "completed",
      "failed",
      "cancelled",
    ])
      .default("pending")
      .notNull(),
    attempts: int("attempts").default(0).notNull(),
    maxAttempts: int("maxAttempts").default(3).notNull(),
    errorMessage: text("errorMessage"),
    result: json("result").$type<{
      entitiesCreated?: number;
      entitiesUpdated?: number;
      assertionsCreated?: number;
      sourcesCreated?: number;
      pagesProcessed?: number;
      validationsPassed?: number;
      validationsFailed?: number;
      reviewItemsCreated?: number;
    }>(),
    createdBy: int("createdBy").references(() => users.id),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("job_status_idx").on(table.status),
    index("job_type_idx").on(table.jobType),
    index("job_created_idx").on(table.createdAt),
  ]
);

export type IngestionJob = typeof ingestionJobs.$inferSelect;
export type InsertIngestionJob = typeof ingestionJobs.$inferInsert;

// ============================================================================
// User Needs Profiles (for guided matching)
// ============================================================================

export const userNeedsProfiles = mysqlTable("user_needs_profiles", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 100 }),
  userId: int("userId").references(() => users.id),
  location: varchar("location", { length: 300 }),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  distanceMiles: int("distanceMiles").default(50),
  levelOfCareTarget: json("levelOfCareTarget").$type<string[]>(),
  ageGroup: varchar("ageGroup", { length: 50 }),
  primaryConcerns: json("primaryConcerns").$type<string[]>(),
  substanceRelated: boolean("substanceRelated"),
  substanceList: json("substanceList").$type<string[]>(),
  telehealthOk: boolean("telehealthOk"),
  insuranceType: json("insuranceType").$type<string[]>(),
  budget: varchar("budget", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserNeedsProfile = typeof userNeedsProfiles.$inferSelect;
export type InsertUserNeedsProfile = typeof userNeedsProfiles.$inferInsert;

// ============================================================================
// Bookmarks (user saved programs)
// ============================================================================

export const bookmarks = mysqlTable(
  "bookmarks",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .references(() => users.id)
      .notNull(),
    programId: int("programId")
      .references(() => programs.id)
      .notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("bm_user_program_idx").on(table.userId, table.programId),
    index("bm_user_idx").on(table.userId),
    index("bm_program_idx").on(table.programId),
  ]
);

export type Bookmark = typeof bookmarks.$inferSelect;
export type InsertBookmark = typeof bookmarks.$inferInsert;
