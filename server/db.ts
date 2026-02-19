import { eq, and, or, like, desc, asc, count, gte, lte, isNull, isNotNull, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  organizations,
  InsertOrganization,
  facilities,
  InsertFacility,
  programs,
  InsertProgram,
  tags,
  InsertTag,
  programTags,
  InsertProgramTag,
  facilityTags,
  InsertFacilityTag,
  sources,
  InsertSource,
  assertions,
  InsertAssertion,
  crawlSnapshots,
  InsertCrawlSnapshot,
  fieldChanges,
  InsertFieldChange,
  reviewQueue,
  InsertReviewQueueItem,
  ingestionJobs,
  InsertIngestionJob,
  userNeedsProfiles,
  InsertUserNeedsProfile,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================================
// Users
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// Organizations
// ============================================================================

export async function createOrganization(data: InsertOrganization) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(organizations).values(data);
  return { id: result[0].insertId };
}

export async function getOrganizationByDomain(domain: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(organizations).where(eq(organizations.websiteDomain, domain)).limit(1);
  return rows[0] ?? null;
}

export async function updateOrganization(id: number, data: Partial<InsertOrganization>) {
  const db = await getDb();
  if (!db) return;
  await db.update(organizations).set(data).where(eq(organizations.id, id));
}

// ============================================================================
// Facilities
// ============================================================================

export async function createFacility(data: InsertFacility) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(facilities).values(data);
  return { id: result[0].insertId };
}

export async function updateFacility(id: number, data: Partial<InsertFacility>) {
  const db = await getDb();
  if (!db) return;
  await db.update(facilities).set(data).where(eq(facilities.id, id));
}

export async function findFacilityByMatch(domain: string, name: string, state: string | null) {
  const db = await getDb();
  if (!db) return null;

  // Try SAMHSA ID first, then name+state, then domain+name
  const conditions = [
    and(
      eq(facilities.name, name),
      state ? eq(facilities.state, state) : undefined
    ),
  ];

  for (const cond of conditions) {
    if (!cond) continue;
    const rows = await db.select().from(facilities)
      .innerJoin(organizations, eq(facilities.organizationId, organizations.id))
      .where(and(cond, eq(organizations.websiteDomain, domain)))
      .limit(1);
    if (rows.length > 0) return rows[0].facilities;
  }

  return null;
}

export async function getFacilityById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(facilities).where(eq(facilities.id, id)).limit(1);
  return rows[0] ?? null;
}

// ============================================================================
// Programs
// ============================================================================

export async function createProgram(data: InsertProgram) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(programs).values(data);
  return { id: result[0].insertId };
}

export async function updateProgram(id: number, data: Partial<InsertProgram>) {
  const db = await getDb();
  if (!db) return;
  await db.update(programs).set(data).where(eq(programs.id, id));
}

export async function searchPrograms(filters: {
  query?: string;
  levelOfCare?: string[];
  telehealth?: boolean;
  specialties?: string[];
  conditions?: string[];
  populations?: string[];
  paymentOptions?: string[];
  insurance?: string[];
  substances?: string[];
  accreditations?: string[];
  genderPolicy?: string;
  state?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  minQuality?: number;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { results: [], total: 0 };

  const limit = filters.limit ?? 20;
  const offset = filters.offset ?? 0;
  const conditions: any[] = [];

  if (filters.query) {
    const q = `%${filters.query}%`;
    conditions.push(
      or(
        like(programs.name, q),
        like(programs.description, q),
        like(facilities.name, q),
        like(facilities.city, q),
        like(organizations.name, q)
      )
    );
  }

  if (filters.levelOfCare?.length) {
    conditions.push(inArray(programs.levelOfCare, filters.levelOfCare as any));
  }

  if (filters.telehealth !== undefined) {
    conditions.push(eq(programs.telehealthAvailable, filters.telehealth));
  }

  if (filters.state) {
    conditions.push(eq(facilities.state, filters.state));
  }

  if (filters.city) {
    conditions.push(like(facilities.city, `%${filters.city}%`));
  }

  if (filters.genderPolicy && filters.genderPolicy !== "unknown") {
    conditions.push(eq(facilities.genderPolicy, filters.genderPolicy as any));
  }

  if (filters.minQuality) {
    conditions.push(gte(programs.qualityScore, filters.minQuality));
  }

  // Geo filter
  if (filters.lat !== undefined && filters.lng !== undefined && filters.radiusMiles) {
    const latDelta = filters.radiusMiles / 69.0;
    const lngDelta = filters.radiusMiles / (69.0 * Math.cos((filters.lat * Math.PI) / 180));
    conditions.push(
      gte(facilities.lat, String(filters.lat - latDelta)),
      lte(facilities.lat, String(filters.lat + latDelta)),
      gte(facilities.lng, String(filters.lng - lngDelta)),
      lte(facilities.lng, String(filters.lng + lngDelta))
    );
  }

  // JSON array filters for facility enriched fields
  if (filters.insurance?.length) {
    for (const ins of filters.insurance) {
      conditions.push(sql`JSON_CONTAINS(${facilities.acceptedInsurance}, ${JSON.stringify(ins)})`);
    }
  }
  if (filters.accreditations?.length) {
    for (const acc of filters.accreditations) {
      conditions.push(sql`JSON_CONTAINS(${facilities.accreditations}, ${JSON.stringify(acc)})`);
    }
  }

  // Tag-based filters using program_tags + tags tables
  // For conditions (primary concerns), match against condition/substance tags
  if (filters.conditions?.length) {
    const likePatterns = filters.conditions.map(c => {
      // Map user-friendly names to tag-friendly patterns
      const normalized = c.toLowerCase().replace(/ use$/i, "").trim();
      return `%${normalized}%`;
    });
    conditions.push(
      sql`${programs.id} IN (
        SELECT pt.programId FROM program_tags pt
        JOIN tags t ON pt.tagId = t.id
        WHERE t.namespace IN ('condition', 'substance', 'specialty')
        AND (${sql.join(
          likePatterns.map(p => sql`t.label LIKE ${p}`),
          sql` OR `
        )})
      )`
    );
  }

  // Substance filter via tags
  if (filters.substances?.length) {
    const likePatterns = filters.substances.map(s => `%${s.toLowerCase()}%`);
    conditions.push(
      sql`${programs.id} IN (
        SELECT pt.programId FROM program_tags pt
        JOIN tags t ON pt.tagId = t.id
        WHERE t.namespace = 'substance'
        AND (${sql.join(
          likePatterns.map(p => sql`t.label LIKE ${p}`),
          sql` OR `
        )})
      )`
    );
  }

  // Specialties filter via tags
  if (filters.specialties?.length) {
    const likePatterns = filters.specialties.map(s => `%${s.toLowerCase()}%`);
    conditions.push(
      sql`${programs.id} IN (
        SELECT pt.programId FROM program_tags pt
        JOIN tags t ON pt.tagId = t.id
        WHERE t.namespace IN ('specialty', 'modality')
        AND (${sql.join(
          likePatterns.map(p => sql`t.label LIKE ${p}`),
          sql` OR `
        )})
      )`
    );
  }

  // Population filter via tags
  if (filters.populations?.length) {
    const likePatterns = filters.populations.map(p => `%${p.toLowerCase()}%`);
    conditions.push(
      sql`${programs.id} IN (
        SELECT pt.programId FROM program_tags pt
        JOIN tags t ON pt.tagId = t.id
        WHERE t.namespace = 'population'
        AND (${sql.join(
          likePatterns.map(p => sql`t.label LIKE ${p}`),
          sql` OR `
        )})
      )`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db
    .select({ total: count() })
    .from(programs)
    .leftJoin(facilities, eq(programs.facilityId, facilities.id))
    .leftJoin(organizations, eq(programs.organizationId, organizations.id))
    .where(whereClause);

  const total = countResult[0]?.total ?? 0;

  const results = await db
    .select({
      program: programs,
      facility: facilities,
      organization: organizations,
    })
    .from(programs)
    .leftJoin(facilities, eq(programs.facilityId, facilities.id))
    .leftJoin(organizations, eq(programs.organizationId, organizations.id))
    .where(whereClause)
    .orderBy(desc(programs.qualityScore), desc(programs.lastVerifiedAt), desc(programs.updatedAt))
    .limit(limit)
    .offset(offset);

  return { results, total };
}

export async function getProgramDetail(programId: number) {
  const db = await getDb();
  if (!db) return null;

  const programRows = await db
    .select({ program: programs, facility: facilities, organization: organizations })
    .from(programs)
    .leftJoin(facilities, eq(programs.facilityId, facilities.id))
    .leftJoin(organizations, eq(programs.organizationId, organizations.id))
    .where(eq(programs.id, programId))
    .limit(1);

  if (programRows.length === 0) return null;
  const row = programRows[0];

  // Get tags
  const tagRows = await db
    .select({ tag: tags, confidence: programTags.confidence })
    .from(programTags)
    .innerJoin(tags, eq(programTags.tagId, tags.id))
    .where(eq(programTags.programId, programId));

  // Get facility tags
  const facTagRows = row.facility
    ? await db
        .select({ tag: tags, confidence: facilityTags.confidence })
        .from(facilityTags)
        .innerJoin(tags, eq(facilityTags.tagId, tags.id))
        .where(eq(facilityTags.facilityId, row.facility.id))
    : [];

  // Get assertions with sources
  const assertionRows = await db
    .select({ assertion: assertions, source: sources })
    .from(assertions)
    .leftJoin(sources, eq(assertions.sourceId, sources.id))
    .where(and(eq(assertions.entityType, "program"), eq(assertions.entityId, programId)))
    .orderBy(desc(assertions.confidence));

  // Also get facility assertions
  const facilityAssertions = row.facility
    ? await db
        .select({ assertion: assertions, source: sources })
        .from(assertions)
        .leftJoin(sources, eq(assertions.sourceId, sources.id))
        .where(and(eq(assertions.entityType, "facility"), eq(assertions.entityId, row.facility.id)))
        .orderBy(desc(assertions.confidence))
    : [];

  return {
    ...row,
    tags: tagRows,
    facilityTags: facTagRows,
    assertions: assertionRows,
    facilityAssertions,
  };
}

// ============================================================================
// Tags
// ============================================================================

export async function findOrCreateTag(namespace: string, label: string, canonicalLabel?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const normalizedLabel = label.toLowerCase().trim();
  const existing = await db
    .select()
    .from(tags)
    .where(and(eq(tags.namespace, namespace as any), eq(tags.label, normalizedLabel)))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const result = await db.insert(tags).values({
    namespace: namespace as any,
    label: normalizedLabel,
    canonicalLabel: canonicalLabel ?? normalizedLabel,
  });
  const created = await db.select().from(tags).where(eq(tags.id, result[0].insertId)).limit(1);
  return created[0];
}

export async function upsertProgramTag(programId: number, tagId: number, confidence: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(programTags)
    .values({ programId, tagId, confidence })
    .onDuplicateKeyUpdate({ set: { confidence } });
}

export async function upsertFacilityTag(facilityId: number, tagId: number, confidence: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(facilityTags)
    .values({ facilityId, tagId, confidence })
    .onDuplicateKeyUpdate({ set: { confidence } });
}

export async function getTagsByNamespace(namespace: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tags).where(eq(tags.namespace, namespace as any));
}

export async function getAllTags() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tags).orderBy(tags.namespace, tags.label);
}

// ============================================================================
// Sources
// ============================================================================

export async function createSource(data: InsertSource) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(sources).values(data);
  return { id: result[0].insertId };
}

export async function getSourceByUri(uri: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(sources).where(eq(sources.uri, uri)).limit(1);
  return rows[0] ?? null;
}

// ============================================================================
// Crawl Snapshots
// ============================================================================

export async function createCrawlSnapshot(data: InsertCrawlSnapshot) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(crawlSnapshots).values(data);
  return { id: result[0].insertId };
}

export async function getLatestSnapshot(uri: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(crawlSnapshots)
    .where(eq(crawlSnapshots.uri, uri))
    .orderBy(desc(crawlSnapshots.crawledAt))
    .limit(1);
  return rows[0] ?? null;
}

// ============================================================================
// Assertions
// ============================================================================

export async function createAssertion(data: InsertAssertion) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(assertions).values(data);
  return { id: result[0].insertId };
}

export async function getAssertionsForEntity(entityType: string, entityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ assertion: assertions, source: sources })
    .from(assertions)
    .leftJoin(sources, eq(assertions.sourceId, sources.id))
    .where(and(eq(assertions.entityType, entityType as any), eq(assertions.entityId, entityId)))
    .orderBy(desc(assertions.confidence));
}

// ============================================================================
// Field Changes
// ============================================================================

export async function createFieldChange(data: InsertFieldChange) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(fieldChanges).values(data);
  return { id: result[0].insertId };
}

export async function getFieldChanges(entityType: string, entityId: number, opts?: { limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ change: fieldChanges, source: sources })
    .from(fieldChanges)
    .leftJoin(sources, eq(fieldChanges.sourceId, sources.id))
    .where(and(eq(fieldChanges.entityType, entityType as any), eq(fieldChanges.entityId, entityId)))
    .orderBy(desc(fieldChanges.createdAt))
    .limit(opts?.limit ?? 50);
}

// ============================================================================
// Review Queue
// ============================================================================

export async function createReviewItem(data: InsertReviewQueueItem) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(reviewQueue).values(data);
  return { id: result[0].insertId };
}

export async function getReviewQueue(opts: {
  status?: string;
  reviewType?: string;
  priority?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions: any[] = [];
  if (opts.status) conditions.push(eq(reviewQueue.status, opts.status as any));
  if (opts.reviewType) conditions.push(eq(reviewQueue.reviewType, opts.reviewType as any));
  if (opts.priority) conditions.push(eq(reviewQueue.priority, opts.priority as any));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ total: count() }).from(reviewQueue).where(whereClause);
  const total = countResult[0]?.total ?? 0;

  const items = await db
    .select()
    .from(reviewQueue)
    .where(whereClause)
    .orderBy(
      sql`FIELD(${reviewQueue.priority}, 'critical', 'high', 'medium', 'low')`,
      desc(reviewQueue.createdAt)
    )
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);

  return { items, total };
}

export async function updateReviewItem(id: number, data: Partial<InsertReviewQueueItem>) {
  const db = await getDb();
  if (!db) return;
  await db.update(reviewQueue).set(data).where(eq(reviewQueue.id, id));
}

export async function getReviewStats() {
  const db = await getDb();
  if (!db) return { pending: 0, inReview: 0, total: 0, byType: {} as Record<string, number>, byPriority: {} as Record<string, number> };

  const statusRows = await db
    .select({ status: reviewQueue.status, count: count() })
    .from(reviewQueue)
    .groupBy(reviewQueue.status);

  const typeRows = await db
    .select({ reviewType: reviewQueue.reviewType, count: count() })
    .from(reviewQueue)
    .where(or(eq(reviewQueue.status, "pending"), eq(reviewQueue.status, "in_review")))
    .groupBy(reviewQueue.reviewType);

  const priorityRows = await db
    .select({ priority: reviewQueue.priority, count: count() })
    .from(reviewQueue)
    .where(or(eq(reviewQueue.status, "pending"), eq(reviewQueue.status, "in_review")))
    .groupBy(reviewQueue.priority);

  const stats: Record<string, number> = {};
  for (const row of statusRows) stats[row.status] = row.count;

  const byType: Record<string, number> = {};
  for (const row of typeRows) byType[row.reviewType] = row.count;

  const byPriority: Record<string, number> = {};
  for (const row of priorityRows) byPriority[row.priority] = row.count;

  return {
    pending: stats.pending ?? 0,
    inReview: stats.in_review ?? 0,
    total: Object.values(stats).reduce((a, b) => a + b, 0),
    byType,
    byPriority,
  };
}

// ============================================================================
// Ingestion Jobs
// ============================================================================

export async function createIngestionJob(data: InsertIngestionJob) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(ingestionJobs).values(data);
  return { id: result[0].insertId };
}

export async function getIngestionJobs(opts: { status?: string; limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) return { jobs: [], total: 0 };

  const conditions: any[] = [];
  if (opts.status) conditions.push(eq(ingestionJobs.status, opts.status as any));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ total: count() }).from(ingestionJobs).where(whereClause);
  const total = countResult[0]?.total ?? 0;

  const jobs = await db
    .select()
    .from(ingestionJobs)
    .where(whereClause)
    .orderBy(desc(ingestionJobs.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);

  return { jobs, total };
}

export async function getNextPendingJob() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(ingestionJobs)
    .where(eq(ingestionJobs.status, "pending"))
    .orderBy(asc(ingestionJobs.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateIngestionJob(id: number, data: Partial<InsertIngestionJob>) {
  const db = await getDb();
  if (!db) return;
  await db.update(ingestionJobs).set(data).where(eq(ingestionJobs.id, id));
}

export async function getJobStats() {
  const db = await getDb();
  if (!db) return { pending: 0, running: 0, completed: 0, failed: 0 };

  const rows = await db
    .select({ status: ingestionJobs.status, count: count() })
    .from(ingestionJobs)
    .groupBy(ingestionJobs.status);

  const stats: Record<string, number> = { pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
  for (const row of rows) stats[row.status] = row.count;
  return stats;
}

// ============================================================================
// Stale entities
// ============================================================================

export async function getStaleEntities(daysSinceVerified: number = 120) {
  const db = await getDb();
  if (!db) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysSinceVerified);

  return db
    .select({ program: programs, facility: facilities })
    .from(programs)
    .leftJoin(facilities, eq(programs.facilityId, facilities.id))
    .where(or(isNull(programs.lastVerifiedAt), lte(programs.lastVerifiedAt, cutoff)))
    .orderBy(asc(programs.lastVerifiedAt))
    .limit(100);
}

// ============================================================================
// User Needs Profiles
// ============================================================================

export async function createUserNeedsProfile(data: InsertUserNeedsProfile) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(userNeedsProfiles).values(data);
  return { id: result[0].insertId };
}

// ============================================================================
// Dashboard stats
// ============================================================================

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { organizations: 0, facilities: 0, programs: 0, sources: 0, assertions: 0, reviewItems: 0, snapshots: 0 };

  const [orgCount] = await db.select({ c: count() }).from(organizations);
  const [facCount] = await db.select({ c: count() }).from(facilities);
  const [progCount] = await db.select({ c: count() }).from(programs);
  const [srcCount] = await db.select({ c: count() }).from(sources);
  const [assertCount] = await db.select({ c: count() }).from(assertions);
  const [reviewCount] = await db.select({ c: count() }).from(reviewQueue).where(or(eq(reviewQueue.status, "pending"), eq(reviewQueue.status, "in_review")));
  const [snapCount] = await db.select({ c: count() }).from(crawlSnapshots);

  return {
    organizations: orgCount.c,
    facilities: facCount.c,
    programs: progCount.c,
    sources: srcCount.c,
    assertions: assertCount.c,
    reviewItems: reviewCount.c,
    snapshots: snapCount.c,
  };
}

// ============================================================================
// Quality metrics
// ============================================================================

export async function getQualityMetrics() {
  const db = await getDb();
  if (!db) return { avgQuality: 0, avgCompleteness: 0, avgFreshness: 0, validationPassRate: 0, distribution: [] as any[] };

  const [avgResult] = await db
    .select({
      avgQuality: sql<number>`AVG(${facilities.qualityScore})`,
      avgCompleteness: sql<number>`AVG(${facilities.completenessScore})`,
      avgFreshness: sql<number>`AVG(${facilities.freshnessScore})`,
      avgValidation: sql<number>`AVG(${facilities.validationPassRate})`,
    })
    .from(facilities)
    .where(isNotNull(facilities.qualityScore));

  // Quality distribution - use raw SQL to avoid Drizzle column qualification mismatch
  const caseExpr = sql`CASE 
    WHEN \`facilities\`.\`qualityScore\` >= 0.8 THEN 'high'
    WHEN \`facilities\`.\`qualityScore\` >= 0.5 THEN 'medium'
    WHEN \`facilities\`.\`qualityScore\` > 0 THEN 'low'
    ELSE 'unscored'
  END`;
  const distribution = await db
    .select({
      bucket: sql<string>`${caseExpr}`,
      count: count(),
    })
    .from(facilities)
    .groupBy(caseExpr);

  return {
    avgQuality: avgResult.avgQuality ?? 0,
    avgCompleteness: avgResult.avgCompleteness ?? 0,
    avgFreshness: avgResult.avgFreshness ?? 0,
    validationPassRate: avgResult.avgValidation ?? 0,
    distribution,
  };
}

// ============================================================================
// Nearby Programs (Haversine distance)
// ============================================================================

export async function getNearbyPrograms(opts: {
  lat: number;
  lng: number;
  radiusMiles: number;
  levelOfCare?: string[];
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return { results: [], total: 0 };

  const limit = opts.limit ?? 50;

  // Haversine formula in SQL for distance in miles
  const distanceExpr = sql<number>`(
    3959 * ACOS(
      LEAST(1, COS(RADIANS(${opts.lat})) * COS(RADIANS(CAST(${facilities.lat} AS DECIMAL(10,7))))
      * COS(RADIANS(CAST(${facilities.lng} AS DECIMAL(10,7))) - RADIANS(${opts.lng}))
      + SIN(RADIANS(${opts.lat})) * SIN(RADIANS(CAST(${facilities.lat} AS DECIMAL(10,7)))))
    )
  )`;

  // Bounding box pre-filter for performance
  const latDelta = opts.radiusMiles / 69.0;
  const lngDelta = opts.radiusMiles / (69.0 * Math.cos((opts.lat * Math.PI) / 180));

  const conditions: any[] = [
    isNotNull(facilities.lat),
    isNotNull(facilities.lng),
    gte(facilities.lat, String(opts.lat - latDelta)),
    lte(facilities.lat, String(opts.lat + latDelta)),
    gte(facilities.lng, String(opts.lng - lngDelta)),
    lte(facilities.lng, String(opts.lng + lngDelta)),
    eq(programs.status, "active"),
  ];

  if (opts.levelOfCare?.length) {
    conditions.push(inArray(programs.levelOfCare, opts.levelOfCare as any));
  }

  const results = await db
    .select({
      program: programs,
      facility: facilities,
      organization: organizations,
      distance: distanceExpr,
    })
    .from(programs)
    .innerJoin(facilities, eq(programs.facilityId, facilities.id))
    .leftJoin(organizations, eq(programs.organizationId, organizations.id))
    .where(and(...conditions))
    .having(sql`${distanceExpr} <= ${opts.radiusMiles}`)
    .orderBy(sql`${distanceExpr} ASC`)
    .limit(limit);

  return {
    results: results.map((r) => ({
      ...r,
      distance: Math.round(r.distance * 10) / 10,
    })),
    total: results.length,
  };
}

// ============================================================================
// Facility listing for map
// ============================================================================

export async function getFacilitiesForMap(opts: { state?: string; lat?: number; lng?: number; radiusMiles?: number } = {}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [isNotNull(facilities.lat), isNotNull(facilities.lng)];

  if (opts.state) conditions.push(eq(facilities.state, opts.state));

  if (opts.lat !== undefined && opts.lng !== undefined && opts.radiusMiles) {
    const latDelta = opts.radiusMiles / 69.0;
    const lngDelta = opts.radiusMiles / (69.0 * Math.cos((opts.lat * Math.PI) / 180));
    conditions.push(
      gte(facilities.lat, String(opts.lat - latDelta)),
      lte(facilities.lat, String(opts.lat + latDelta)),
      gte(facilities.lng, String(opts.lng - lngDelta)),
      lte(facilities.lng, String(opts.lng + lngDelta))
    );
  }

  return db
    .select({
      id: facilities.id,
      name: facilities.name,
      lat: facilities.lat,
      lng: facilities.lng,
      city: facilities.city,
      state: facilities.state,
      facilityType: facilities.facilityType,
      status: facilities.status,
      organizationId: facilities.organizationId,
      qualityScore: facilities.qualityScore,
      phone: facilities.phone,
    })
    .from(facilities)
    .where(and(...conditions))
    .limit(500);
}
