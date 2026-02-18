import { and, desc, eq, gte, inArray, like, lte, or, sql, asc, isNull, isNotNull, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  organizations,
  facilities,
  programs,
  tags,
  programTags,
  sources,
  assertions,
  ingestionJobs,
  userNeedsProfiles,
  type InsertOrganization,
  type InsertFacility,
  type InsertProgram,
  type InsertTag,
  type InsertProgramTag,
  type InsertSource,
  type InsertAssertion,
  type InsertIngestionJob,
  type InsertUserNeedsProfile,
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
  if (!db) return;

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

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0)
      updateSet.lastSignedIn = new Date();

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

export async function getOrganizationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return rows[0] ?? null;
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

export async function getFacilityById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(facilities).where(eq(facilities.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getFacilitiesByOrg(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(facilities).where(eq(facilities.organizationId, orgId));
}

export async function updateFacility(id: number, data: Partial<InsertFacility>) {
  const db = await getDb();
  if (!db) return;
  await db.update(facilities).set(data).where(eq(facilities.id, id));
}

export async function findFacilityByMatch(domain: string | null, name: string, state: string | null) {
  const db = await getDb();
  if (!db) return null;

  const conditions = [];
  if (domain) {
    conditions.push(
      sql`${facilities.organizationId} IN (SELECT id FROM organizations WHERE websiteDomain = ${domain})`
    );
  }
  conditions.push(like(facilities.name, `%${name}%`));
  if (state) conditions.push(eq(facilities.state, state));

  if (conditions.length === 0) return null;
  const rows = await db.select().from(facilities).where(and(...conditions)).limit(1);
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

export async function getProgramById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(programs).where(eq(programs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getProgramsByFacility(facilityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(programs).where(eq(programs.facilityId, facilityId));
}

export async function updateProgram(id: number, data: Partial<InsertProgram>) {
  const db = await getDb();
  if (!db) return;
  await db.update(programs).set(data).where(eq(programs.id, id));
}

export type SearchFilters = {
  query?: string;
  levelOfCare?: string[];
  telehealth?: boolean;
  specialties?: string[];
  conditions?: string[];
  populations?: string[];
  paymentOptions?: string[];
  state?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  limit?: number;
  offset?: number;
};

export async function searchPrograms(filters: SearchFilters) {
  const db = await getDb();
  if (!db) return { results: [], total: 0 };

  const conditions: any[] = [];

  // Text search on program name
  if (filters.query) {
    conditions.push(
      or(
        like(programs.name, `%${filters.query}%`),
        like(facilities.name, `%${filters.query}%`),
        like(organizations.name, `%${filters.query}%`)
      )
    );
  }

  // Level of care filter
  if (filters.levelOfCare && filters.levelOfCare.length > 0) {
    conditions.push(inArray(programs.levelOfCare, filters.levelOfCare as any));
  }

  // Telehealth filter
  if (filters.telehealth !== undefined) {
    conditions.push(eq(programs.telehealthAvailable, filters.telehealth));
  }

  // State filter
  if (filters.state) {
    conditions.push(eq(facilities.state, filters.state));
  }

  // City filter
  if (filters.city) {
    conditions.push(like(facilities.city, `%${filters.city}%`));
  }

  // Geo-radius filter (simple bounding box)
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

  // Tag-based filters (specialties, conditions, populations, payment)
  const tagFilters: { namespace: string; labels: string[] }[] = [];
  if (filters.specialties?.length) tagFilters.push({ namespace: "specialty", labels: filters.specialties });
  if (filters.conditions?.length) tagFilters.push({ namespace: "condition", labels: filters.conditions });
  if (filters.populations?.length) tagFilters.push({ namespace: "population", labels: filters.populations });
  if (filters.paymentOptions?.length) tagFilters.push({ namespace: "payer", labels: filters.paymentOptions });

  if (tagFilters.length > 0) {
    for (const tf of tagFilters) {
      conditions.push(
        sql`${programs.id} IN (
          SELECT pt.programId FROM program_tags pt
          JOIN tags t ON pt.tagId = t.id
          WHERE t.namespace = ${tf.namespace}
          AND t.label IN (${sql.join(tf.labels.map(l => sql`${l}`), sql`, `)})
        )`
      );
    }
  }

  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Count total
  const countResult = await db
    .select({ total: count() })
    .from(programs)
    .leftJoin(facilities, eq(programs.facilityId, facilities.id))
    .leftJoin(organizations, eq(programs.organizationId, organizations.id))
    .where(whereClause);

  const total = countResult[0]?.total ?? 0;

  // Fetch results
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
    .orderBy(desc(programs.lastVerifiedAt), desc(programs.updatedAt))
    .limit(limit)
    .offset(offset);

  return { results, total };
}

export async function getProgramDetail(programId: number) {
  const db = await getDb();
  if (!db) return null;

  const programRows = await db
    .select({
      program: programs,
      facility: facilities,
      organization: organizations,
    })
    .from(programs)
    .leftJoin(facilities, eq(programs.facilityId, facilities.id))
    .leftJoin(organizations, eq(programs.organizationId, organizations.id))
    .where(eq(programs.id, programId))
    .limit(1);

  if (programRows.length === 0) return null;

  const row = programRows[0];

  // Get tags
  const tagRows = await db
    .select({
      tag: tags,
      confidence: programTags.confidence,
    })
    .from(programTags)
    .innerJoin(tags, eq(programTags.tagId, tags.id))
    .where(eq(programTags.programId, programId));

  // Get assertions with sources
  const assertionRows = await db
    .select({
      assertion: assertions,
      source: sources,
    })
    .from(assertions)
    .leftJoin(sources, eq(assertions.sourceId, sources.id))
    .where(
      and(
        eq(assertions.entityType, "program"),
        eq(assertions.entityId, programId)
      )
    )
    .orderBy(desc(assertions.confidence));

  // Also get facility assertions
  const facilityAssertions = row.facility
    ? await db
        .select({
          assertion: assertions,
          source: sources,
        })
        .from(assertions)
        .leftJoin(sources, eq(assertions.sourceId, sources.id))
        .where(
          and(
            eq(assertions.entityType, "facility"),
            eq(assertions.entityId, row.facility.id)
          )
        )
        .orderBy(desc(assertions.confidence))
    : [];

  return {
    ...row,
    tags: tagRows,
    assertions: assertionRows,
    facilityAssertions,
  };
}

// ============================================================================
// Tags
// ============================================================================

export async function findOrCreateTag(namespace: string, label: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existing = await db
    .select()
    .from(tags)
    .where(and(eq(tags.namespace, namespace as any), eq(tags.label, label)))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const result = await db.insert(tags).values({ namespace: namespace as any, label });
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
    .select({
      assertion: assertions,
      source: sources,
    })
    .from(assertions)
    .leftJoin(sources, eq(assertions.sourceId, sources.id))
    .where(
      and(
        eq(assertions.entityType, entityType as any),
        eq(assertions.entityId, entityId)
      )
    )
    .orderBy(desc(assertions.confidence));
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
    .select({
      status: ingestionJobs.status,
      count: count(),
    })
    .from(ingestionJobs)
    .groupBy(ingestionJobs.status);

  const stats: Record<string, number> = { pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
  for (const row of rows) {
    stats[row.status] = row.count;
  }
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

  const stalePrograms = await db
    .select({
      program: programs,
      facility: facilities,
    })
    .from(programs)
    .leftJoin(facilities, eq(programs.facilityId, facilities.id))
    .where(
      or(
        isNull(programs.lastVerifiedAt),
        lte(programs.lastVerifiedAt, cutoff)
      )
    )
    .orderBy(asc(programs.lastVerifiedAt))
    .limit(100);

  return stalePrograms;
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
  if (!db) return { organizations: 0, facilities: 0, programs: 0, sources: 0, assertions: 0 };

  const [orgCount] = await db.select({ c: count() }).from(organizations);
  const [facCount] = await db.select({ c: count() }).from(facilities);
  const [progCount] = await db.select({ c: count() }).from(programs);
  const [srcCount] = await db.select({ c: count() }).from(sources);
  const [assertCount] = await db.select({ c: count() }).from(assertions);

  return {
    organizations: orgCount.c,
    facilities: facCount.c,
    programs: progCount.c,
    sources: srcCount.c,
    assertions: assertCount.c,
  };
}

// ============================================================================
// Facility listing for map
// ============================================================================

export async function getFacilitiesForMap(opts: { state?: string; lat?: number; lng?: number; radiusMiles?: number } = {}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [
    isNotNull(facilities.lat),
    isNotNull(facilities.lng),
  ];

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
    })
    .from(facilities)
    .where(and(...conditions))
    .limit(500);
}
