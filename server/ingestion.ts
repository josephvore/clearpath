import { invokeLLM } from "./_core/llm";
import { makeRequest, type GeocodingResult } from "./_core/map";
import * as db from "./db";
import crypto from "crypto";

// ============================================================================
// Rate limiting
// ============================================================================

const domainLastFetch: Map<string, number> = new Map();
const RATE_LIMIT_MS = 1500; // 1.5s between requests to same domain

async function rateLimitedFetch(url: string): Promise<Response> {
  const domain = new URL(url).hostname;
  const lastFetch = domainLastFetch.get(domain) ?? 0;
  const elapsed = Date.now() - lastFetch;

  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }

  domainLastFetch.set(domain, Date.now());

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "EquipFlow-Bot/1.0 (+https://equipflow.com/about; treatment-discovery)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });

  return response;
}

// ============================================================================
// HTML to clean text
// ============================================================================

function htmlToText(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");

  // Replace common block elements with newlines
  text = text.replace(/<\/?(p|div|br|h[1-6]|li|tr|td|th|section|article)[^>]*>/gi, "\n");

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");

  // Clean up whitespace
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n\s*\n/g, "\n\n");
  text = text.trim();

  // Truncate to reasonable size for LLM
  if (text.length > 15000) {
    text = text.substring(0, 15000) + "\n[...truncated]";
  }

  return text;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : null;
}

// ============================================================================
// LLM Extraction
// ============================================================================

const EXTRACTION_SYSTEM_PROMPT = `You are a data extraction agent for a treatment program discovery platform. 
Your job is to extract structured information about behavioral health and addiction treatment organizations, facilities, and programs from web page content.

CRITICAL RULES:
1. Only extract information that is explicitly stated in the text. NEVER invent or hallucinate data.
2. For every field you extract, provide the exact excerpt from the source text that supports it.
3. If information is not found, use null or "unknown" - NEVER guess.
4. Assign confidence scores (0.0-1.0) based on how clearly the information is stated.
5. Look for: organization names, facility locations, program types (IOP, PHP, residential, detox, etc.), 
   treatment modalities (CBT, DBT, etc.), specialties, populations served, payment options, contact info.

Return a JSON object with this structure. All fields are optional - only include what you find:`;

const EXTRACTION_SCHEMA = {
  type: "object" as const,
  properties: {
    organization: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Organization name" },
        website_domain: { type: "string" as const },
        phone_main: { type: "string" as const },
        ownership_type: { type: "string" as const },
        description: { type: "string" as const },
        confidence: { type: "number" as const },
        citations: {
          type: "object" as const,
          additionalProperties: {
            type: "object" as const,
            properties: { excerpt: { type: "string" as const } },
            required: ["excerpt"] as const,
          },
        },
      },
      required: ["name", "confidence"] as const,
      additionalProperties: false as const,
    },
    facility: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const },
        facility_type: {
          type: "string" as const,
          enum: ["hospital", "clinic", "residential", "detox_center", "telehealth_only", "unknown"] as const,
        },
        address_line1: { type: "string" as const },
        city: { type: "string" as const },
        state: { type: "string" as const },
        postal_code: { type: "string" as const },
        phone_intake: { type: "string" as const },
        email_intake: { type: "string" as const },
        ages_served_min: { type: ["number", "null"] as const },
        ages_served_max: { type: ["number", "null"] as const },
        languages: { type: "array" as const, items: { type: "string" as const } },
        description: { type: "string" as const },
        confidence: { type: "number" as const },
        citations: {
          type: "object" as const,
          additionalProperties: {
            type: "object" as const,
            properties: { excerpt: { type: "string" as const } },
            required: ["excerpt"] as const,
          },
        },
      },
      required: ["name", "confidence"] as const,
      additionalProperties: false as const,
    },
    programs: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
          level_of_care: {
            type: "string" as const,
            enum: ["crisis", "inpatient", "residential", "php", "iop", "outpatient", "detox", "sober_living", "aftercare", "unknown"] as const,
          },
          telehealth_available: { type: "boolean" as const },
          modalities: { type: "array" as const, items: { type: "string" as const } },
          specialties: { type: "array" as const, items: { type: "string" as const } },
          conditions: { type: "array" as const, items: { type: "string" as const } },
          populations: { type: "array" as const, items: { type: "string" as const } },
          payment_options: { type: "array" as const, items: { type: "string" as const } },
          schedule: {
            type: "object" as const,
            properties: {
              days_per_week: { type: ["number", "null"] as const },
              hours_per_day: { type: ["number", "null"] as const },
              notes: { type: "string" as const },
            },
            additionalProperties: false as const,
          },
          length_of_stay: {
            type: "object" as const,
            properties: {
              min_days: { type: ["number", "null"] as const },
              max_days: { type: ["number", "null"] as const },
              typical_days: { type: ["number", "null"] as const },
            },
            additionalProperties: false as const,
          },
          medical_capability: {
            type: "object" as const,
            properties: {
              nursing_24_7: { type: "boolean" as const },
              psychiatrist: { type: "boolean" as const },
              mat_available: { type: "boolean" as const },
              medically_managed_detox: { type: "boolean" as const },
              notes: { type: "string" as const },
            },
            additionalProperties: false as const,
          },
          description: { type: "string" as const },
          insurance_notes: { type: "string" as const },
          confidence: {
            type: "object" as const,
            additionalProperties: { type: "number" as const },
          },
          citations: {
            type: "object" as const,
            additionalProperties: {
              type: "object" as const,
              properties: { excerpt: { type: "string" as const } },
              required: ["excerpt"] as const,
            },
          },
        },
        required: ["name", "level_of_care", "confidence"] as const,
        additionalProperties: false as const,
      },
    },
  },
  required: ["organization", "programs"] as const,
  additionalProperties: false as const,
};

type ExtractionResult = {
  organization: {
    name: string;
    website_domain?: string;
    phone_main?: string;
    ownership_type?: string;
    description?: string;
    confidence: number;
    citations?: Record<string, { excerpt: string }>;
  };
  facility?: {
    name: string;
    facility_type?: string;
    address_line1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    phone_intake?: string;
    email_intake?: string;
    ages_served_min?: number | null;
    ages_served_max?: number | null;
    languages?: string[];
    description?: string;
    confidence: number;
    citations?: Record<string, { excerpt: string }>;
  };
  programs: Array<{
    name: string;
    level_of_care: string;
    telehealth_available?: boolean;
    modalities?: string[];
    specialties?: string[];
    conditions?: string[];
    populations?: string[];
    payment_options?: string[];
    schedule?: { days_per_week?: number | null; hours_per_day?: number | null; notes?: string };
    length_of_stay?: { min_days?: number | null; max_days?: number | null; typical_days?: number | null };
    medical_capability?: {
      nursing_24_7?: boolean;
      psychiatrist?: boolean;
      mat_available?: boolean;
      medically_managed_detox?: boolean;
      notes?: string;
    };
    description?: string;
    insurance_notes?: string;
    confidence: Record<string, number>;
    citations?: Record<string, { excerpt: string }>;
  }>;
};

async function extractWithLLM(text: string, url: string): Promise<ExtractionResult | null> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: EXTRACTION_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Extract treatment program information from this web page content.\n\nURL: ${url}\n\nContent:\n${text}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "treatment_extraction",
          strict: false,
          schema: EXTRACTION_SCHEMA,
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") return null;

    const parsed = JSON.parse(content) as ExtractionResult;
    return parsed;
  } catch (error) {
    console.error("[Extraction] LLM extraction failed:", error);
    return null;
  }
}

// ============================================================================
// Geocoding
// ============================================================================

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const result = await makeRequest<GeocodingResult>("/maps/api/geocode/json", {
      address,
    });
    if (result.status === "OK" && result.results.length > 0) {
      return result.results[0].geometry.location;
    }
    return null;
  } catch (error) {
    console.error("[Geocode] Failed:", error);
    return null;
  }
}

// ============================================================================
// Entity Resolution
// ============================================================================

async function resolveOrganization(
  extracted: ExtractionResult["organization"],
  domain: string
): Promise<number> {
  // Try to find existing org by domain
  const existing = await db.getOrganizationByDomain(domain);
  if (existing) {
    // Update if we have newer/better data
    await db.updateOrganization(existing.id, {
      lastVerifiedAt: new Date(),
      ...(extracted.description && !existing.description
        ? { description: extracted.description }
        : {}),
      ...(extracted.phone_main && !existing.phoneMain
        ? { phoneMain: extracted.phone_main }
        : {}),
    });
    return existing.id;
  }

  // Create new org
  const result = await db.createOrganization({
    name: extracted.name,
    websiteDomain: domain,
    phoneMain: extracted.phone_main,
    ownershipType: extracted.ownership_type,
    description: extracted.description,
    lastVerifiedAt: new Date(),
  });

  return result.id;
}

async function resolveFacility(
  extracted: ExtractionResult["facility"],
  orgId: number,
  domain: string
): Promise<number | null> {
  if (!extracted) return null;

  // Try to find existing facility
  const existing = await db.findFacilityByMatch(
    domain,
    extracted.name,
    extracted.state ?? null
  );

  if (existing) {
    await db.updateFacility(existing.id, {
      lastVerifiedAt: new Date(),
      ...(extracted.description && !existing.description
        ? { description: extracted.description }
        : {}),
      ...(extracted.phone_intake && !existing.phoneIntake
        ? { phoneIntake: extracted.phone_intake }
        : {}),
    });
    return existing.id;
  }

  // Geocode the address
  let lat: string | undefined;
  let lng: string | undefined;
  if (extracted.address_line1 && extracted.city && extracted.state) {
    const fullAddress = `${extracted.address_line1}, ${extracted.city}, ${extracted.state} ${extracted.postal_code ?? ""}`;
    const coords = await geocodeAddress(fullAddress);
    if (coords) {
      lat = String(coords.lat);
      lng = String(coords.lng);
    }
  }

  const result = await db.createFacility({
    organizationId: orgId,
    name: extracted.name,
    facilityType: (extracted.facility_type as any) ?? "unknown",
    addressLine1: extracted.address_line1,
    city: extracted.city,
    state: extracted.state,
    postalCode: extracted.postal_code,
    phoneIntake: extracted.phone_intake,
    emailIntake: extracted.email_intake,
    agesServedMin: extracted.ages_served_min ?? undefined,
    agesServedMax: extracted.ages_served_max ?? undefined,
    languages: extracted.languages,
    description: extracted.description,
    lat,
    lng,
    status: "active",
    lastVerifiedAt: new Date(),
  });

  return result.id;
}

// ============================================================================
// Write assertions
// ============================================================================

async function writeAssertions(
  entityType: "organization" | "facility" | "program",
  entityId: number,
  citations: Record<string, { excerpt: string }> | undefined,
  confidenceMap: Record<string, number> | number,
  sourceId: number
) {
  if (!citations) return;

  for (const [field, citation] of Object.entries(citations)) {
    const confidence =
      typeof confidenceMap === "number"
        ? confidenceMap
        : confidenceMap[field] ?? 0.5;

    await db.createAssertion({
      entityType,
      entityId,
      fieldPath: `${entityType}.${field}`,
      valueJson: { field, excerpt: citation.excerpt },
      confidence,
      method: "llm",
      sourceId,
      sourceExcerpt: citation.excerpt.substring(0, 300),
    });
  }
}

// ============================================================================
// Write tags
// ============================================================================

async function writeProgramTags(
  programId: number,
  extracted: ExtractionResult["programs"][0]
) {
  const tagMappings: { namespace: string; values: string[] | undefined }[] = [
    { namespace: "modality", values: extracted.modalities },
    { namespace: "specialty", values: extracted.specialties },
    { namespace: "condition", values: extracted.conditions },
    { namespace: "population", values: extracted.populations },
    { namespace: "payer", values: extracted.payment_options },
  ];

  for (const mapping of tagMappings) {
    if (!mapping.values) continue;
    for (const value of mapping.values) {
      const tag = await db.findOrCreateTag(mapping.namespace, value.toLowerCase());
      if (tag) {
        const confidence = extracted.confidence[mapping.namespace] ?? 0.5;
        await db.upsertProgramTag(programId, tag.id, confidence);
      }
    }
  }

  // Also add level_of_care as a tag
  if (extracted.level_of_care && extracted.level_of_care !== "unknown") {
    const locTag = await db.findOrCreateTag("level_of_care", extracted.level_of_care);
    if (locTag) {
      await db.upsertProgramTag(
        programId,
        locTag.id,
        extracted.confidence.level_of_care ?? 0.7
      );
    }
  }
}

// ============================================================================
// Main ingestion pipeline
// ============================================================================

export async function processIngestionJob(jobId: number): Promise<void> {
  const dbInstance = await db.getDb();
  if (!dbInstance) throw new Error("DB not available");

  // Get the job
  const jobs = await db.getIngestionJobs({ limit: 1 });
  const job = jobs.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  // Mark as running
  await db.updateIngestionJob(jobId, {
    status: "running",
    startedAt: new Date(),
    attempts: (job.attempts ?? 0) + 1,
  });

  try {
    const payload = job.payload as any;
    let result = { entitiesCreated: 0, entitiesUpdated: 0, assertionsCreated: 0, sourcesCreated: 0, pagesProcessed: 0 };

    if (job.jobType === "ingest_seed_url" && payload?.url) {
      result = await ingestUrl(payload.url);
    } else if (job.jobType === "crawl_domain" && payload?.domain) {
      result = await crawlDomain(payload.url || `https://${payload.domain}`, payload.depthLimit ?? 3);
    } else if (job.jobType === "recrawl_entity") {
      // For recrawl, find the source URLs for this entity and re-ingest them
      result = await recrawlEntity(payload.entityType, payload.entityId);
    } else if (job.jobType === "refresh_stale") {
      result = await refreshStaleEntities();
    }

    await db.updateIngestionJob(jobId, {
      status: "completed",
      completedAt: new Date(),
      result,
    });
  } catch (error: any) {
    console.error(`[Ingestion] Job ${jobId} error:`, error);
    const attempts = (job.attempts ?? 0) + 1;
    await db.updateIngestionJob(jobId, {
      status: attempts >= (job.maxAttempts ?? 3) ? "failed" : "pending",
      errorMessage: error.message || String(error),
    });
  }
}

async function ingestUrl(url: string) {
  const stats = { entitiesCreated: 0, entitiesUpdated: 0, assertionsCreated: 0, sourcesCreated: 0, pagesProcessed: 0 };

  console.log(`[Ingestion] Fetching: ${url}`);
  const response = await rateLimitedFetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const cleanText = htmlToText(html);
  const title = extractTitle(html);
  const domain = new URL(url).hostname;
  const contentHash = crypto.createHash("sha256").update(cleanText).digest("hex");

  // Check if we already have this exact content
  const existingSource = await db.getSourceByUri(url);
  if (existingSource && existingSource.contentHash === contentHash) {
    console.log(`[Ingestion] Content unchanged for ${url}, skipping`);
    return stats;
  }

  // Save source
  const source = await db.createSource({
    uri: url,
    domain,
    contentHash,
    contentType: "html",
    title,
    rawText: cleanText.substring(0, 5000), // Store limited excerpt
    robotsAllowed: true,
    httpStatus: response.status,
  });
  stats.sourcesCreated++;
  stats.pagesProcessed++;

  // Extract with LLM
  console.log(`[Ingestion] Extracting from: ${url}`);
  const extracted = await extractWithLLM(cleanText, url);

  if (!extracted) {
    console.log(`[Ingestion] No data extracted from: ${url}`);
    return stats;
  }

  // Resolve organization
  const orgId = await resolveOrganization(extracted.organization, domain);
  stats.entitiesCreated++;

  // Write org assertions
  await writeAssertions(
    "organization",
    orgId,
    extracted.organization.citations,
    extracted.organization.confidence,
    source.id
  );

  // Resolve facility
  const facilityId = await resolveFacility(extracted.facility ?? undefined, orgId, domain);
  if (facilityId) {
    stats.entitiesCreated++;
    if (extracted.facility?.citations) {
      await writeAssertions(
        "facility",
        facilityId,
        extracted.facility.citations,
        extracted.facility.confidence,
        source.id
      );
    }
  }

  // Process programs
  for (const prog of extracted.programs) {
    const programResult = await db.createProgram({
      organizationId: orgId,
      facilityId: facilityId ?? undefined,
      name: prog.name,
      levelOfCare: prog.level_of_care as any,
      telehealthAvailable: prog.telehealth_available ?? false,
      schedule: prog.schedule
        ? {
            daysPerWeek: prog.schedule.days_per_week ?? undefined,
            hoursPerDay: prog.schedule.hours_per_day ?? undefined,
            notes: prog.schedule.notes,
          }
        : undefined,
      lengthOfStay: prog.length_of_stay
        ? {
            minDays: prog.length_of_stay.min_days ?? undefined,
            maxDays: prog.length_of_stay.max_days ?? undefined,
            typicalDays: prog.length_of_stay.typical_days ?? undefined,
          }
        : undefined,
      medicalCapability: prog.medical_capability
        ? {
            nursing247: prog.medical_capability.nursing_24_7,
            psychiatrist: prog.medical_capability.psychiatrist,
            matAvailable: prog.medical_capability.mat_available,
            medicallyManagedDetox: prog.medical_capability.medically_managed_detox,
            notes: prog.medical_capability.notes,
          }
        : undefined,
      paymentOptions: prog.payment_options,
      insuranceNotes: prog.insurance_notes,
      description: prog.description,
      status: "active",
      lastVerifiedAt: new Date(),
    });

    stats.entitiesCreated++;

    // Write assertions for program
    await writeAssertions("program", programResult.id, prog.citations, prog.confidence, source.id);
    stats.assertionsCreated += Object.keys(prog.citations ?? {}).length;

    // Write tags
    await writeProgramTags(programResult.id, prog);
  }

  console.log(`[Ingestion] Completed: ${url} - ${stats.entitiesCreated} entities, ${stats.assertionsCreated} assertions`);
  return stats;
}

async function crawlDomain(startUrl: string, depthLimit: number = 3) {
  const stats = { entitiesCreated: 0, entitiesUpdated: 0, assertionsCreated: 0, sourcesCreated: 0, pagesProcessed: 0 };
  const domain = new URL(startUrl).hostname;
  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];

  while (queue.length > 0 && visited.size < 10) {
    // Limit pages per crawl
    const item = queue.shift()!;
    if (visited.has(item.url) || item.depth > depthLimit) continue;
    visited.add(item.url);

    try {
      const pageStats = await ingestUrl(item.url);
      stats.entitiesCreated += pageStats.entitiesCreated;
      stats.assertionsCreated += pageStats.assertionsCreated;
      stats.sourcesCreated += pageStats.sourcesCreated;
      stats.pagesProcessed += pageStats.pagesProcessed;

      // Find more links on the same domain
      if (item.depth < depthLimit) {
        const response = await rateLimitedFetch(item.url);
        if (response.ok) {
          const html = await response.text();
          const linkRegex = /href=["']([^"']+)["']/gi;
          let match;
          while ((match = linkRegex.exec(html)) !== null) {
            try {
              const linkUrl = new URL(match[1], item.url);
              if (
                linkUrl.hostname === domain &&
                !visited.has(linkUrl.href) &&
                !linkUrl.href.includes("#") &&
                !linkUrl.href.match(/\.(jpg|png|gif|css|js|pdf|zip)$/i)
              ) {
                // Only follow treatment-related pages
                const path = linkUrl.pathname.toLowerCase();
                if (
                  path.includes("program") ||
                  path.includes("treatment") ||
                  path.includes("service") ||
                  path.includes("admission") ||
                  path.includes("about") ||
                  path.includes("contact") ||
                  path.includes("location") ||
                  path.includes("facility") ||
                  path === "/"
                ) {
                  queue.push({ url: linkUrl.href, depth: item.depth + 1 });
                }
              }
            } catch {
              // Invalid URL, skip
            }
          }
        }
      }
    } catch (error) {
      console.error(`[Crawl] Error processing ${item.url}:`, error);
    }
  }

  return stats;
}

async function recrawlEntity(entityType: string, entityId: number) {
  const stats = { entitiesCreated: 0, entitiesUpdated: 0, assertionsCreated: 0, sourcesCreated: 0, pagesProcessed: 0 };

  // Find sources for this entity
  const entityAssertions = await db.getAssertionsForEntity(entityType, entityId);
  const sourceUrls = new Set<string>();

  for (const { source } of entityAssertions) {
    if (source?.uri) sourceUrls.add(source.uri);
  }

  for (const url of Array.from(sourceUrls)) {
    try {
      const pageStats = await ingestUrl(url);
      stats.entitiesCreated += pageStats.entitiesCreated;
      stats.assertionsCreated += pageStats.assertionsCreated;
      stats.sourcesCreated += pageStats.sourcesCreated;
      stats.pagesProcessed += pageStats.pagesProcessed;
    } catch (error) {
      console.error(`[Recrawl] Error re-ingesting ${url}:`, error);
    }
  }

  return stats;
}

async function refreshStaleEntities() {
  const stats = { entitiesCreated: 0, entitiesUpdated: 0, assertionsCreated: 0, sourcesCreated: 0, pagesProcessed: 0 };

  const staleEntities = await db.getStaleEntities(120);

  for (const entity of staleEntities.slice(0, 5)) {
    // Limit batch size
    try {
      const entityStats = await recrawlEntity("program", entity.program.id);
      stats.entitiesUpdated += entityStats.entitiesUpdated;
      stats.assertionsCreated += entityStats.assertionsCreated;
      stats.pagesProcessed += entityStats.pagesProcessed;
    } catch (error) {
      console.error(`[Refresh] Error refreshing program ${entity.program.id}:`, error);
    }
  }

  return stats;
}
