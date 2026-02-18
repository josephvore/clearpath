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
    phoneMain: varchar("phoneMain", { length: 50 }),
    ownershipType: varchar("ownershipType", { length: 100 }),
    description: text("description"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastVerifiedAt: timestamp("lastVerifiedAt"),
  },
  (table) => [
    index("org_domain_idx").on(table.websiteDomain),
    index("org_name_idx").on(table.name),
  ]
);

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ============================================================================
// Facilities
// ============================================================================

export const facilityTypeEnum = mysqlEnum("facilityType", [
  "hospital",
  "clinic",
  "residential",
  "detox_center",
  "telehealth_only",
  "unknown",
]);

export const facilityStatusEnum = mysqlEnum("facilityStatus", [
  "active",
  "closed",
  "unknown",
]);

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
      "telehealth_only",
      "unknown",
    ])
      .default("unknown")
      .notNull(),
    addressLine1: varchar("addressLine1", { length: 500 }),
    addressLine2: varchar("addressLine2", { length: 500 }),
    city: varchar("city", { length: 200 }),
    state: varchar("state", { length: 100 }),
    postalCode: varchar("postalCode", { length: 20 }),
    country: varchar("country", { length: 100 }).default("US"),
    lat: decimal("lat", { precision: 10, scale: 7 }),
    lng: decimal("lng", { precision: 10, scale: 7 }),
    phoneIntake: varchar("phoneIntake", { length: 50 }),
    emailIntake: varchar("emailIntake", { length: 320 }),
    agesServedMin: int("agesServedMin"),
    agesServedMax: int("agesServedMax"),
    languages: json("languages").$type<string[]>(),
    description: text("description"),
    imageUrl: varchar("imageUrl", { length: 1000 }),
    status: mysqlEnum("status", ["active", "closed", "unknown"])
      .default("unknown")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastVerifiedAt: timestamp("lastVerifiedAt"),
  },
  (table) => [
    index("fac_org_idx").on(table.organizationId),
    index("fac_state_city_idx").on(table.state, table.city),
    index("fac_name_idx").on(table.name),
    index("fac_lat_lng_idx").on(table.lat, table.lng),
  ]
);

export type Facility = typeof facilities.$inferSelect;
export type InsertFacility = typeof facilities.$inferInsert;

// ============================================================================
// Programs
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
    paymentOptions: json("paymentOptions").$type<string[]>(),
    insuranceNotes: text("insuranceNotes"),
    description: text("description"),
    status: mysqlEnum("programStatus", ["active", "closed", "unknown"])
      .default("unknown")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastVerifiedAt: timestamp("lastVerifiedAt"),
  },
  (table) => [
    index("prog_org_idx").on(table.organizationId),
    index("prog_fac_idx").on(table.facilityId),
    index("prog_loc_idx").on(table.levelOfCare),
    index("prog_name_idx").on(table.name),
  ]
);

export type Program = typeof programs.$inferSelect;
export type InsertProgram = typeof programs.$inferInsert;

// ============================================================================
// Tags (Ontology)
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
    ]).notNull(),
    label: varchar("label", { length: 200 }).notNull(),
    synonyms: json("synonyms").$type<string[]>(),
    parentId: int("parentId"),
    version: int("version").default(1).notNull(),
  },
  (table) => [
    index("tag_ns_idx").on(table.namespace),
    uniqueIndex("tag_ns_label_idx").on(table.namespace, table.label),
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
// Sources (Provenance)
// ============================================================================

export const sources = mysqlTable(
  "sources",
  {
    id: int("id").autoincrement().primaryKey(),
    uri: varchar("uri", { length: 2000 }).notNull(),
    domain: varchar("domain", { length: 500 }),
    retrievedAt: timestamp("retrievedAt").defaultNow().notNull(),
    contentHash: varchar("contentHash", { length: 64 }),
    contentType: mysqlEnum("contentType", ["html", "pdf", "other"]).default(
      "html"
    ),
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
  ]
);

export type Source = typeof sources.$inferSelect;
export type InsertSource = typeof sources.$inferInsert;

// ============================================================================
// Assertions (AI claims with provenance)
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
    method: mysqlEnum("method", ["rule", "llm", "human"]).default("llm").notNull(),
    sourceId: int("sourceId").references(() => sources.id),
    sourceExcerpt: text("sourceExcerpt"),
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
  ]
);

export type Assertion = typeof assertions.$inferSelect;
export type InsertAssertion = typeof assertions.$inferInsert;

// ============================================================================
// Ingestion Jobs (Queue)
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
    ]).notNull(),
    payload: json("payload").$type<{
      url?: string;
      domain?: string;
      depthLimit?: number;
      entityType?: string;
      entityId?: number;
      lastVerifiedBefore?: string;
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
