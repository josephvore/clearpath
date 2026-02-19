import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { processIngestionJob } from "./ingestion";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ========================================================================
  // Search (enriched filters)
  // ========================================================================
  search: router({
    programs: publicProcedure
      .input(
        z.object({
          query: z.string().optional(),
          levelOfCare: z.array(z.string()).optional(),
          telehealth: z.boolean().optional(),
          specialties: z.array(z.string()).optional(),
          conditions: z.array(z.string()).optional(),
          populations: z.array(z.string()).optional(),
          paymentOptions: z.array(z.string()).optional(),
          insurance: z.array(z.string()).optional(),
          substances: z.array(z.string()).optional(),
          accreditations: z.array(z.string()).optional(),
          genderPolicy: z.string().optional(),
          state: z.string().optional(),
          city: z.string().optional(),
          lat: z.number().optional(),
          lng: z.number().optional(),
          radiusMiles: z.number().optional(),
          minQuality: z.number().min(0).max(1).optional(),
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
      )
      .query(async ({ input }) => {
        return db.searchPrograms(input);
      }),

    tags: publicProcedure
      .input(z.object({ namespace: z.string().optional() }).optional())
      .query(async ({ input }) => {
        if (input?.namespace) {
          return db.getTagsByNamespace(input.namespace);
        }
        return db.getAllTags();
      }),
  }),

  // ========================================================================
  // Program Detail
  // ========================================================================
  program: router({
    detail: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getProgramDetail(input.id);
      }),

    assertions: publicProcedure
      .input(
        z.object({
          entityType: z.enum(["organization", "facility", "program"]),
          entityId: z.number(),
        })
      )
      .query(async ({ input }) => {
        return db.getAssertionsForEntity(input.entityType, input.entityId);
      }),

    fieldChanges: publicProcedure
      .input(
        z.object({
          entityType: z.enum(["organization", "facility", "program"]),
          entityId: z.number(),
          limit: z.number().min(1).max(100).optional(),
        })
      )
      .query(async ({ input }) => {
        return db.getFieldChanges(input.entityType, input.entityId, { limit: input.limit });
      }),
  }),

  // ========================================================================
  // Guided Match
  // ========================================================================
  match: router({
    find: publicProcedure
      .input(
        z.object({
          location: z.string().optional(),
          lat: z.number().optional(),
          lng: z.number().optional(),
          distanceMiles: z.number().optional(),
          levelOfCareTarget: z.array(z.string()).optional(),
          ageGroup: z.string().optional(),
          primaryConcerns: z.array(z.string()).optional(),
          substanceRelated: z.boolean().optional(),
          substanceList: z.array(z.string()).optional(),
          telehealthOk: z.boolean().optional(),
          insuranceType: z.array(z.string()).optional(),
          budget: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.createUserNeedsProfile({
          location: input.location,
          lat: input.lat ? String(input.lat) : undefined,
          lng: input.lng ? String(input.lng) : undefined,
          distanceMiles: input.distanceMiles,
          levelOfCareTarget: input.levelOfCareTarget,
          ageGroup: input.ageGroup,
          primaryConcerns: input.primaryConcerns,
          substanceRelated: input.substanceRelated,
          substanceList: input.substanceList,
          telehealthOk: input.telehealthOk,
          insuranceType: input.insuranceType,
          budget: input.budget,
        });

        // Progressive fallback matching strategy:
        // 1. Try with all filters (level of care + conditions tags)
        // 2. If no results, try with just level of care
        // 3. If still no results, try with just conditions/query
        // 4. Final fallback: return all programs sorted by quality

        let searchResults = await db.searchPrograms({
          levelOfCare: input.levelOfCareTarget,
          telehealth: input.telehealthOk || undefined,
          conditions: input.primaryConcerns,
          substances: input.substanceList,
          lat: input.lat,
          lng: input.lng,
          radiusMiles: input.distanceMiles || 50,
          limit: 20,
        });

        let matchStrategy = "exact";

        // Fallback 1: Drop conditions filter, keep level of care
        if (searchResults.total === 0 && input.levelOfCareTarget?.length) {
          searchResults = await db.searchPrograms({
            levelOfCare: input.levelOfCareTarget,
            telehealth: input.telehealthOk || undefined,
            lat: input.lat,
            lng: input.lng,
            radiusMiles: input.distanceMiles || 50,
            limit: 20,
          });
          matchStrategy = "level_of_care_only";
        }

        // Fallback 2: Use concerns as a text query instead of tag filter
        if (searchResults.total === 0 && input.primaryConcerns?.length) {
          searchResults = await db.searchPrograms({
            query: input.primaryConcerns.join(" "),
            telehealth: input.telehealthOk || undefined,
            limit: 20,
          });
          matchStrategy = "text_search";
        }

        // Fallback 3: Return all programs sorted by quality
        if (searchResults.total === 0) {
          searchResults = await db.searchPrograms({ limit: 20 });
          matchStrategy = "browse_all";
        }

        return {
          results: searchResults.results,
          total: searchResults.total,
          matchStrategy,
          matchCriteria: {
            levelOfCare: input.levelOfCareTarget,
            location: input.location,
            concerns: input.primaryConcerns,
            insurance: input.insuranceType,
          },
        };
      }),
  }),

  // ========================================================================
  // Nearby Programs
  // ========================================================================
  nearby: router({
    programs: publicProcedure
      .input(
        z.object({
          lat: z.number(),
          lng: z.number(),
          radiusMiles: z.number().min(1).max(500).default(50),
          levelOfCare: z.array(z.string()).optional(),
          limit: z.number().min(1).max(100).optional(),
        })
      )
      .query(async ({ input }) => {
        return db.getNearbyPrograms(input);
      }),
  }),

  // ========================================================================
  // Map
  // ========================================================================
  map: router({
    facilities: publicProcedure
      .input(
        z
          .object({
            state: z.string().optional(),
            lat: z.number().optional(),
            lng: z.number().optional(),
            radiusMiles: z.number().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        return db.getFacilitiesForMap(input ?? {});
      }),
  }),

  // ========================================================================
  // Admin
  // ========================================================================
  admin: router({
    stats: adminProcedure.query(async () => {
      const [entityStats, jobStats, reviewStats, qualityMetrics] = await Promise.all([
        db.getDashboardStats(),
        db.getJobStats(),
        db.getReviewStats(),
        db.getQualityMetrics(),
      ]);
      return { entities: entityStats, jobs: jobStats, review: reviewStats, quality: qualityMetrics };
    }),

    ingest: adminProcedure
      .input(
        z.object({
          url: z.string().url(),
          jobType: z.enum(["ingest_seed_url", "crawl_domain"]).default("ingest_seed_url"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const domain = new URL(input.url).hostname;
        const job = await db.createIngestionJob({
          jobType: input.jobType,
          payload: { url: input.url, domain },
          status: "pending",
          createdBy: ctx.user.id,
        });
        processIngestionJob(job.id).catch((err) => {
          console.error(`[Ingestion] Job ${job.id} failed:`, err);
        });
        return { jobId: job.id };
      }),

    recrawl: adminProcedure
      .input(
        z.object({
          entityType: z.enum(["organization", "facility", "program"]),
          entityId: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const job = await db.createIngestionJob({
          jobType: "recrawl_entity",
          payload: { entityType: input.entityType, entityId: input.entityId },
          status: "pending",
          createdBy: ctx.user.id,
        });
        processIngestionJob(job.id).catch((err) => {
          console.error(`[Ingestion] Recrawl job ${job.id} failed:`, err);
        });
        return { jobId: job.id };
      }),

    computeQuality: adminProcedure.mutation(async ({ ctx }) => {
      const job = await db.createIngestionJob({
        jobType: "compute_quality",
        payload: {},
        status: "pending",
        createdBy: ctx.user.id,
      });
      processIngestionJob(job.id).catch((err) => {
        console.error(`[Ingestion] Quality job ${job.id} failed:`, err);
      });
      return { jobId: job.id };
    }),

    jobs: adminProcedure
      .input(
        z
          .object({
            status: z.string().optional(),
            limit: z.number().min(1).max(100).optional(),
            offset: z.number().min(0).optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        return db.getIngestionJobs(input ?? {});
      }),

    staleEntities: adminProcedure
      .input(z.object({ days: z.number().min(1).default(120) }).optional())
      .query(async ({ input }) => {
        return db.getStaleEntities(input?.days ?? 120);
      }),

    refreshStale: adminProcedure
      .input(z.object({ days: z.number().min(1).default(120) }))
      .mutation(async ({ input, ctx }) => {
        const job = await db.createIngestionJob({
          jobType: "refresh_stale",
          payload: {
            lastVerifiedBefore: new Date(Date.now() - input.days * 24 * 60 * 60 * 1000).toISOString(),
          },
          status: "pending",
          createdBy: ctx.user.id,
        });
        processIngestionJob(job.id).catch((err) => {
          console.error(`[Ingestion] Refresh job ${job.id} failed:`, err);
        });
        return { jobId: job.id };
      }),

    // Review Queue
    reviewQueue: adminProcedure
      .input(
        z
          .object({
            status: z.string().optional(),
            reviewType: z.string().optional(),
            priority: z.string().optional(),
            limit: z.number().min(1).max(100).optional(),
            offset: z.number().min(0).optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        return db.getReviewQueue(input ?? {});
      }),

    resolveReview: adminProcedure
      .input(
        z.object({
          id: z.number(),
          resolution: z.enum(["approved", "rejected", "merged", "skipped"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await db.updateReviewItem(input.id, {
          status: input.resolution === "approved" || input.resolution === "merged" ? "approved" : "rejected",
          resolvedBy: ctx.user.id,
          resolvedAt: new Date(),
          resolution: input.resolution,
        });
        return { success: true };
      }),

    // Quality metrics
    qualityMetrics: adminProcedure.query(async () => {
      return db.getQualityMetrics();
    }),
  }),
});

export type AppRouter = typeof appRouter;
