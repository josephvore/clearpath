import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { TRPCError } from "@trpc/server";

// ============================================================================
// Test helpers
// ============================================================================

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "test-user-123",
    email: "user@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user-456",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ============================================================================
// Mock the db module
// ============================================================================

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  searchPrograms: vi.fn().mockResolvedValue({
    results: [
      {
        program: {
          id: 1,
          name: "Recovery IOP",
          levelOfCare: "iop",
          status: "active",
          telehealthAvailable: true,
          description: "Intensive outpatient program",
        },
        facility: {
          id: 1,
          name: "Sunrise Center",
          city: "Denver",
          state: "CO",
          lat: "39.7392",
          lng: "-104.9903",
        },
        organization: {
          id: 1,
          name: "Sunrise Health",
        },
      },
    ],
    total: 1,
  }),
  getProgramDetail: vi.fn().mockResolvedValue({
    program: {
      id: 1,
      name: "Recovery IOP",
      levelOfCare: "iop",
      status: "active",
      telehealthAvailable: true,
      description: "Intensive outpatient program",
    },
    facility: {
      id: 1,
      name: "Sunrise Center",
      city: "Denver",
      state: "CO",
    },
    organization: {
      id: 1,
      name: "Sunrise Health",
    },
    tags: [
      { tag: { id: 1, namespace: "condition", label: "depression" }, confidence: 0.9 },
    ],
    assertions: [
      {
        assertion: {
          id: 1,
          entityType: "program",
          entityId: 1,
          fieldPath: "program.name",
          confidence: 0.95,
          method: "llm",
          sourceExcerpt: "Recovery IOP program",
        },
        source: {
          id: 1,
          uri: "https://example.com/programs",
          domain: "example.com",
        },
      },
    ],
    facilityAssertions: [],
  }),
  getAssertionsForEntity: vi.fn().mockResolvedValue([
    {
      assertion: {
        id: 1,
        entityType: "program",
        entityId: 1,
        fieldPath: "program.name",
        confidence: 0.95,
        method: "llm",
      },
      source: {
        id: 1,
        uri: "https://example.com",
        domain: "example.com",
      },
    },
  ]),
  getAllTags: vi.fn().mockResolvedValue([
    { id: 1, namespace: "condition", label: "depression" },
    { id: 2, namespace: "modality", label: "cbt" },
    { id: 3, namespace: "specialty", label: "trauma" },
  ]),
  getTagsByNamespace: vi.fn().mockResolvedValue([
    { id: 1, namespace: "condition", label: "depression" },
  ]),
  createUserNeedsProfile: vi.fn().mockResolvedValue({ id: 1 }),
  getFacilitiesForMap: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "Sunrise Center",
      lat: "39.7392",
      lng: "-104.9903",
      city: "Denver",
      state: "CO",
      facilityType: "clinic",
      status: "active",
      organizationId: 1,
    },
  ]),
  getDashboardStats: vi.fn().mockResolvedValue({
    organizations: 5,
    facilities: 12,
    programs: 30,
    sources: 45,
    assertions: 200,
  }),
  getJobStats: vi.fn().mockResolvedValue({
    pending: 2,
    running: 1,
    completed: 15,
    failed: 3,
  }),
  createIngestionJob: vi.fn().mockResolvedValue({ id: 99 }),
  getIngestionJobs: vi.fn().mockResolvedValue({
    jobs: [
      {
        id: 1,
        jobType: "ingest_seed_url",
        status: "completed",
        payload: { url: "https://example.com" },
        createdAt: new Date(),
      },
    ],
    total: 1,
  }),
  getStaleEntities: vi.fn().mockResolvedValue([
    {
      program: { id: 5, name: "Old Program", lastVerifiedAt: null },
      facility: { id: 3, name: "Old Facility", state: "TX" },
    },
  ]),
}));

// Mock the ingestion module
vi.mock("./ingestion", () => ({
  processIngestionJob: vi.fn().mockResolvedValue(undefined),
}));

// ============================================================================
// Tests
// ============================================================================

describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user data for authenticated users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.openId).toBe("test-user-123");
    expect(result?.name).toBe("Test User");
    expect(result?.role).toBe("user");
  });
});

describe("search.programs", () => {
  it("returns search results with default parameters", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.programs({});
    expect(result).toHaveProperty("results");
    expect(result).toHaveProperty("total");
    expect(result.results).toBeInstanceOf(Array);
    expect(result.total).toBe(1);
  });

  it("accepts query text filter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.programs({ query: "IOP" });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].program.name).toBe("Recovery IOP");
  });

  it("accepts level of care filter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.programs({
      levelOfCare: ["iop", "php"],
    });
    expect(result.results).toHaveLength(1);
  });

  it("accepts telehealth filter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.programs({ telehealth: true });
    expect(result.results).toHaveLength(1);
  });

  it("accepts geo-radius filter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.programs({
      lat: 39.7392,
      lng: -104.9903,
      radiusMiles: 25,
    });
    expect(result.results).toHaveLength(1);
  });

  it("accepts state filter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.programs({ state: "CO" });
    expect(result.results).toHaveLength(1);
  });

  it("accepts pagination parameters", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.programs({ limit: 10, offset: 0 });
    expect(result.results).toHaveLength(1);
  });

  it("rejects limit above 100", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.search.programs({ limit: 200 })
    ).rejects.toThrow();
  });

  it("rejects negative offset", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.search.programs({ offset: -1 })
    ).rejects.toThrow();
  });
});

describe("search.tags", () => {
  it("returns all tags when no namespace specified", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.tags();
    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(3);
  });

  it("returns tags filtered by namespace", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.tags({ namespace: "condition" });
    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("depression");
  });
});

describe("program.detail", () => {
  it("returns full program detail with tags and assertions", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.program.detail({ id: 1 });
    expect(result).not.toBeNull();
    expect(result?.program.name).toBe("Recovery IOP");
    expect(result?.facility?.name).toBe("Sunrise Center");
    expect(result?.organization?.name).toBe("Sunrise Health");
    expect(result?.tags).toHaveLength(1);
    expect(result?.assertions).toHaveLength(1);
    expect(result?.assertions[0].assertion.confidence).toBe(0.95);
    expect(result?.assertions[0].source?.uri).toBe("https://example.com/programs");
  });
});

describe("program.assertions", () => {
  it("returns assertions for a given entity", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.program.assertions({
      entityType: "program",
      entityId: 1,
    });
    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(1);
    expect(result[0].assertion.confidence).toBe(0.95);
  });

  it("accepts all entity types", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    for (const entityType of ["organization", "facility", "program"] as const) {
      const result = await caller.program.assertions({
        entityType,
        entityId: 1,
      });
      expect(result).toBeInstanceOf(Array);
    }
  });

  it("rejects invalid entity type", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.program.assertions({
        entityType: "invalid" as any,
        entityId: 1,
      })
    ).rejects.toThrow();
  });
});

describe("match.find", () => {
  it("returns matched programs based on user needs", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.match.find({
      levelOfCareTarget: ["iop"],
      primaryConcerns: ["depression"],
      telehealthOk: true,
      location: "Denver, CO",
      lat: 39.7392,
      lng: -104.9903,
      distanceMiles: 50,
    });
    expect(result).toHaveProperty("results");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("matchCriteria");
    expect(result.matchCriteria.levelOfCare).toEqual(["iop"]);
    expect(result.matchCriteria.concerns).toEqual(["depression"]);
  });

  it("works with minimal input", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.match.find({});
    expect(result).toHaveProperty("results");
    expect(result).toHaveProperty("total");
  });

  it("handles insurance type filter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.match.find({
      insuranceType: ["medicaid", "commercial"],
    });
    expect(result.matchCriteria.insurance).toEqual(["medicaid", "commercial"]);
  });
});

describe("map.facilities", () => {
  it("returns facilities with coordinates", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.map.facilities();
    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("lat");
    expect(result[0]).toHaveProperty("lng");
    expect(result[0]).toHaveProperty("name");
  });

  it("accepts state filter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.map.facilities({ state: "CO" });
    expect(result).toBeInstanceOf(Array);
  });

  it("accepts geo-radius filter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.map.facilities({
      lat: 39.7392,
      lng: -104.9903,
      radiusMiles: 50,
    });
    expect(result).toBeInstanceOf(Array);
  });
});

describe("admin (authorization)", () => {
  it("rejects unauthenticated users for admin.stats", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.stats()).rejects.toThrow(TRPCError);
  });

  it("rejects non-admin users for admin.stats", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.stats()).rejects.toThrow(TRPCError);
  });

  it("allows admin users for admin.stats", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.stats();
    expect(result).toHaveProperty("entities");
    expect(result).toHaveProperty("jobs");
    expect(result.entities.organizations).toBe(5);
    expect(result.entities.facilities).toBe(12);
    expect(result.entities.programs).toBe(30);
    expect(result.jobs.pending).toBe(2);
    expect(result.jobs.completed).toBe(15);
  });

  it("rejects unauthenticated users for admin.ingest", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.ingest({ url: "https://example.com", jobType: "ingest_seed_url" })
    ).rejects.toThrow(TRPCError);
  });

  it("rejects non-admin users for admin.ingest", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.ingest({ url: "https://example.com", jobType: "ingest_seed_url" })
    ).rejects.toThrow(TRPCError);
  });
});

describe("admin.ingest", () => {
  it("creates an ingestion job and returns job ID", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.ingest({
      url: "https://example.com/treatment",
      jobType: "ingest_seed_url",
    });
    expect(result).toHaveProperty("jobId");
    expect(result.jobId).toBe(99);
  });

  it("rejects invalid URLs", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.ingest({ url: "not-a-url", jobType: "ingest_seed_url" })
    ).rejects.toThrow();
  });

  it("accepts crawl_domain job type", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.ingest({
      url: "https://example.com",
      jobType: "crawl_domain",
    });
    expect(result.jobId).toBe(99);
  });
});

describe("admin.jobs", () => {
  it("returns list of ingestion jobs", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.jobs();
    expect(result).toHaveProperty("jobs");
    expect(result).toHaveProperty("total");
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].jobType).toBe("ingest_seed_url");
  });

  it("accepts status filter", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.jobs({ status: "completed" });
    expect(result).toHaveProperty("jobs");
  });

  it("accepts pagination", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.jobs({ limit: 10, offset: 0 });
    expect(result).toHaveProperty("jobs");
  });
});

describe("admin.staleEntities", () => {
  it("returns stale entities with default threshold", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.staleEntities();
    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(1);
    expect(result[0].program.name).toBe("Old Program");
  });

  it("accepts custom days threshold", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.staleEntities({ days: 30 });
    expect(result).toBeInstanceOf(Array);
  });
});

describe("admin.refreshStale", () => {
  it("creates a refresh job and returns job ID", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.refreshStale({ days: 90 });
    expect(result).toHaveProperty("jobId");
    expect(result.jobId).toBe(99);
  });
});

describe("admin.recrawl", () => {
  it("creates a recrawl job for a specific entity", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.recrawl({
      entityType: "program",
      entityId: 1,
    });
    expect(result).toHaveProperty("jobId");
    expect(result.jobId).toBe(99);
  });

  it("accepts all entity types", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    for (const entityType of ["organization", "facility", "program"] as const) {
      const result = await caller.admin.recrawl({
        entityType,
        entityId: 1,
      });
      expect(result.jobId).toBe(99);
    }
  });

  it("rejects invalid entity type", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.recrawl({
        entityType: "invalid" as any,
        entityId: 1,
      })
    ).rejects.toThrow();
  });
});
