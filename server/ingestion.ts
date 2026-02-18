import { invokeLLM } from "./_core/llm";
import { makeRequest, type GeocodingResult } from "./_core/map";
import * as db from "./db";
import crypto from "crypto";

// ============================================================================
// Rate limiting
// ============================================================================

const domainLastFetch: Map<string, number> = new Map();
const RATE_LIMIT_MS = 1500;

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
      "User-Agent": "ClearPath-Bot/2.0 (+https://clearpath.app/about; treatment-discovery)",
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
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  text = text.replace(/<\/?(p|div|br|h[1-6]|li|tr|td|th|section|article)[^>]*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  text = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n\n").trim();
  if (text.length > 15000) text = text.substring(0, 15000) + "\n[...truncated]";
  return text;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : null;
}

// ============================================================================
// Validation helpers
// ============================================================================

function validatePhone(phone: string | undefined | null): { valid: boolean; normalized: string | null } {
  if (!phone) return { valid: false, normalized: null };
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return { valid: true, normalized: `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` };
  if (digits.length === 11 && digits[0] === "1") return { valid: true, normalized: `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}` };
  return { valid: false, normalized: phone };
}

function validateUrl(url: string | undefined | null): { valid: boolean; normalized: string | null } {
  if (!url) return { valid: false, normalized: null };
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return { valid: true, normalized: parsed.href };
  } catch {
    return { valid: false, normalized: url };
  }
}

function normalizeInsurance(raw: string): string {
  const lower = raw.toLowerCase().trim();
  const map: Record<string, string> = {
    "blue cross": "Blue Cross Blue Shield",
    "bcbs": "Blue Cross Blue Shield",
    "blue cross blue shield": "Blue Cross Blue Shield",
    "aetna": "Aetna",
    "cigna": "Cigna",
    "united healthcare": "UnitedHealthcare",
    "unitedhealthcare": "UnitedHealthcare",
    "uhc": "UnitedHealthcare",
    "humana": "Humana",
    "kaiser": "Kaiser Permanente",
    "kaiser permanente": "Kaiser Permanente",
    "medicaid": "Medicaid",
    "medicare": "Medicare",
    "tricare": "TRICARE",
    "va": "VA/Military",
    "military": "VA/Military",
    "self pay": "Self Pay",
    "self-pay": "Self Pay",
    "sliding scale": "Sliding Scale",
    "anthem": "Anthem",
    "magellan": "Magellan Health",
    "optum": "Optum",
  };
  return map[lower] ?? raw.trim();
}

function normalizeSubstance(raw: string): string {
  const lower = raw.toLowerCase().trim();
  const map: Record<string, string> = {
    "alcohol": "Alcohol",
    "opioids": "Opioids",
    "opioid": "Opioids",
    "heroin": "Opioids (Heroin)",
    "fentanyl": "Opioids (Fentanyl)",
    "cocaine": "Cocaine",
    "crack": "Cocaine (Crack)",
    "methamphetamine": "Methamphetamine",
    "meth": "Methamphetamine",
    "marijuana": "Cannabis",
    "cannabis": "Cannabis",
    "benzodiazepines": "Benzodiazepines",
    "benzos": "Benzodiazepines",
    "prescription drugs": "Prescription Drugs",
    "stimulants": "Stimulants",
    "gambling": "Gambling",
    "tobacco": "Tobacco/Nicotine",
    "nicotine": "Tobacco/Nicotine",
  };
  return map[lower] ?? raw.trim();
}

// ============================================================================
// Quality scoring
// ============================================================================

function computeCompletenessScore(facility: any, programCount: number): number {
  let score = 0;
  let total = 0;
  const fields = [
    "name", "phone", "addressLine1", "city", "state", "postalCode",
    "lat", "lng", "description", "facilityType", "website",
  ];
  for (const f of fields) {
    total++;
    if (facility[f] && facility[f] !== "unknown") score++;
  }
  const arrayFields = ["acceptedInsurance", "specializations", "substancesTreated", "treatmentApproaches", "languages"];
  for (const f of arrayFields) {
    total++;
    if (facility[f] && Array.isArray(facility[f]) && facility[f].length > 0) score++;
  }
  total++;
  if (programCount > 0) score++;
  return total > 0 ? score / total : 0;
}

function computeFreshnessScore(lastVerifiedAt: Date | null): number {
  if (!lastVerifiedAt) return 0;
  const daysSince = (Date.now() - lastVerifiedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 30) return 1.0;
  if (daysSince <= 90) return 0.8;
  if (daysSince <= 180) return 0.5;
  if (daysSince <= 365) return 0.3;
  return 0.1;
}

// ============================================================================
// LLM Extraction (enhanced with enriched fields)
// ============================================================================

const EXTRACTION_SYSTEM_PROMPT = `You are a data extraction agent for a treatment program discovery platform.
Your job is to extract structured information about behavioral health and addiction treatment organizations, facilities, and programs from web page content.

CRITICAL RULES:
1. Only extract information that is explicitly stated in the text. NEVER invent or hallucinate data.
2. For every field you extract, provide the exact excerpt from the source text that supports it.
3. If information is not found, use null or omit the field - NEVER guess.
4. Assign confidence scores (0.0-1.0) based on how clearly the information is stated.
5. Normalize insurance names to standard forms (e.g., "BCBS" → "Blue Cross Blue Shield").
6. Normalize substance names to standard forms (e.g., "meth" → "Methamphetamine").
7. Look for: organization names, facility locations, program types, treatment modalities, specialties, populations served, payment options, contact info, insurance accepted, substances treated, accreditations, amenities.

Return a JSON object with the specified structure. All fields are optional - only include what you find.`;

const EXTRACTION_SCHEMA = {
  type: "object" as const,
  properties: {
    organization: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const },
        website_domain: { type: "string" as const },
        phone_main: { type: "string" as const },
        ownership_type: { type: "string" as const },
        description: { type: "string" as const },
        accreditations: { type: "array" as const, items: { type: "string" as const } },
        confidence: { type: "number" as const },
        citations: { type: "object" as const, additionalProperties: { type: "object" as const, properties: { excerpt: { type: "string" as const } }, required: ["excerpt"] as const } },
      },
      required: ["name", "confidence"] as const,
      additionalProperties: false as const,
    },
    facility: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const },
        facility_type: { type: "string" as const, enum: ["hospital", "clinic", "residential", "detox_center", "sober_living", "php_facility", "iop_facility", "telehealth_only", "crisis_center", "mat_clinic", "unknown"] as const },
        address_line1: { type: "string" as const },
        city: { type: "string" as const },
        state: { type: "string" as const },
        postal_code: { type: "string" as const },
        phone: { type: "string" as const },
        email: { type: "string" as const },
        website: { type: "string" as const },
        gender_policy: { type: "string" as const, enum: ["co_ed", "male_only", "female_only", "lgbtq_affirming", "unknown"] as const },
        accepted_insurance: { type: "array" as const, items: { type: "string" as const } },
        payment_options: { type: "array" as const, items: { type: "string" as const } },
        specializations: { type: "array" as const, items: { type: "string" as const } },
        substances_treated: { type: "array" as const, items: { type: "string" as const } },
        treatment_approaches: { type: "array" as const, items: { type: "string" as const } },
        age_groups: { type: "array" as const, items: { type: "string" as const } },
        languages: { type: "array" as const, items: { type: "string" as const } },
        amenities: { type: "array" as const, items: { type: "string" as const } },
        accreditations: { type: "array" as const, items: { type: "string" as const } },
        license_number: { type: "string" as const },
        capacity: { type: ["number", "null"] as const },
        hours: { type: "string" as const },
        admissions_process: { type: "string" as const },
        eligibility: { type: "string" as const },
        cost_range: { type: "string" as const },
        description: { type: "string" as const },
        confidence: { type: "number" as const },
        citations: { type: "object" as const, additionalProperties: { type: "object" as const, properties: { excerpt: { type: "string" as const } }, required: ["excerpt"] as const } },
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
          program_type: { type: "string" as const, enum: ["detox", "residential", "php", "iop", "outpatient", "aftercare", "family", "sober_living", "crisis", "unknown"] as const },
          level_of_care: { type: "string" as const, enum: ["crisis", "inpatient", "residential", "php", "iop", "outpatient", "detox", "sober_living", "aftercare", "unknown"] as const },
          telehealth_available: { type: "boolean" as const },
          duration: { type: "string" as const },
          schedule_text: { type: "string" as const },
          modalities: { type: "array" as const, items: { type: "string" as const } },
          specialties: { type: "array" as const, items: { type: "string" as const } },
          conditions: { type: "array" as const, items: { type: "string" as const } },
          populations: { type: "array" as const, items: { type: "string" as const } },
          payment_options: { type: "array" as const, items: { type: "string" as const } },
          specializations: { type: "array" as const, items: { type: "string" as const } },
          eligibility: { type: "string" as const },
          schedule: { type: "object" as const, properties: { days_per_week: { type: ["number", "null"] as const }, hours_per_day: { type: ["number", "null"] as const }, notes: { type: "string" as const } }, additionalProperties: false as const },
          length_of_stay: { type: "object" as const, properties: { min_days: { type: ["number", "null"] as const }, max_days: { type: ["number", "null"] as const }, typical_days: { type: ["number", "null"] as const } }, additionalProperties: false as const },
          medical_capability: { type: "object" as const, properties: { nursing_24_7: { type: "boolean" as const }, psychiatrist: { type: "boolean" as const }, mat_available: { type: "boolean" as const }, medically_managed_detox: { type: "boolean" as const }, notes: { type: "string" as const } }, additionalProperties: false as const },
          description: { type: "string" as const },
          insurance_notes: { type: "string" as const },
          confidence: { type: "object" as const, additionalProperties: { type: "number" as const } },
          citations: { type: "object" as const, additionalProperties: { type: "object" as const, properties: { excerpt: { type: "string" as const } }, required: ["excerpt"] as const } },
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
    accreditations?: string[];
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
    phone?: string;
    email?: string;
    website?: string;
    gender_policy?: string;
    accepted_insurance?: string[];
    payment_options?: string[];
    specializations?: string[];
    substances_treated?: string[];
    treatment_approaches?: string[];
    age_groups?: string[];
    languages?: string[];
    amenities?: string[];
    accreditations?: string[];
    license_number?: string;
    capacity?: number | null;
    hours?: string;
    admissions_process?: string;
    eligibility?: string;
    cost_range?: string;
    description?: string;
    confidence: number;
    citations?: Record<string, { excerpt: string }>;
  };
  programs: Array<{
    name: string;
    program_type?: string;
    level_of_care: string;
    telehealth_available?: boolean;
    duration?: string;
    schedule_text?: string;
    modalities?: string[];
    specialties?: string[];
    conditions?: string[];
    populations?: string[];
    payment_options?: string[];
    specializations?: string[];
    eligibility?: string;
    schedule?: { days_per_week?: number | null; hours_per_day?: number | null; notes?: string };
    length_of_stay?: { min_days?: number | null; max_days?: number | null; typical_days?: number | null };
    medical_capability?: { nursing_24_7?: boolean; psychiatrist?: boolean; mat_available?: boolean; medically_managed_detox?: boolean; notes?: string };
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
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: `Extract treatment program information from this web page content.\n\nURL: ${url}\n\nContent:\n${text}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "treatment_extraction", strict: false, schema: EXTRACTION_SCHEMA },
      },
    });
    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") return null;
    return JSON.parse(content) as ExtractionResult;
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
    const result = await makeRequest<GeocodingResult>("/maps/api/geocode/json", { address });
    if (result.status === "OK" && result.results.length > 0) return result.results[0].geometry.location;
    return null;
  } catch (error) {
    console.error("[Geocode] Failed:", error);
    return null;
  }
}

// ============================================================================
// Entity Resolution
// ============================================================================

async function resolveOrganization(extracted: ExtractionResult["organization"], domain: string): Promise<number> {
  const existing = await db.getOrganizationByDomain(domain);
  if (existing) {
    await db.updateOrganization(existing.id, {
      lastVerifiedAt: new Date(),
      ...(extracted.description && !existing.description ? { description: extracted.description } : {}),
      ...(extracted.phone_main && !existing.phoneMain ? { phoneMain: validatePhone(extracted.phone_main).normalized ?? undefined } : {}),
      ...(extracted.accreditations?.length ? { accreditations: extracted.accreditations } : {}),
    });
    return existing.id;
  }
  const phoneResult = validatePhone(extracted.phone_main);
  const result = await db.createOrganization({
    name: extracted.name,
    websiteDomain: domain,
    phoneMain: phoneResult.normalized ?? undefined,
    ownershipType: extracted.ownership_type,
    description: extracted.description,
    accreditations: extracted.accreditations,
    lastVerifiedAt: new Date(),
  });
  return result.id;
}

async function resolveFacility(extracted: ExtractionResult["facility"], orgId: number, domain: string): Promise<number | null> {
  if (!extracted) return null;

  const existing = await db.findFacilityByMatch(domain, extracted.name, extracted.state ?? null);
  if (existing) {
    // Differential update — only update fields that are new or better
    const updates: any = { lastVerifiedAt: new Date(), lastCrawledAt: new Date() };
    if (extracted.description && !existing.description) updates.description = extracted.description;
    if (extracted.phone && !existing.phone) updates.phone = validatePhone(extracted.phone).normalized;
    if (extracted.email && !existing.email) updates.email = extracted.email;
    if (extracted.website && !existing.website) updates.website = validateUrl(extracted.website).normalized;
    if (extracted.accepted_insurance?.length) updates.acceptedInsurance = extracted.accepted_insurance.map(normalizeInsurance);
    if (extracted.specializations?.length) updates.specializations = extracted.specializations;
    if (extracted.substances_treated?.length) updates.substancesTreated = extracted.substances_treated.map(normalizeSubstance);
    if (extracted.treatment_approaches?.length) updates.treatmentApproaches = extracted.treatment_approaches;
    if (extracted.amenities?.length) updates.amenities = extracted.amenities;
    if (extracted.accreditations?.length) updates.accreditations = extracted.accreditations;
    if (extracted.languages?.length) updates.languages = extracted.languages;
    if (extracted.age_groups?.length) updates.ageGroups = extracted.age_groups;
    if (extracted.gender_policy && extracted.gender_policy !== "unknown") updates.genderPolicy = extracted.gender_policy;
    if (extracted.capacity) updates.capacity = extracted.capacity;
    if (extracted.hours) updates.hours = extracted.hours;
    if (extracted.admissions_process) updates.admissionsProcess = extracted.admissions_process;
    if (extracted.eligibility) updates.eligibility = extracted.eligibility;
    if (extracted.cost_range) updates.costRange = extracted.cost_range;
    if (extracted.license_number) updates.licenseNumber = extracted.license_number;

    await db.updateFacility(existing.id, updates);
    return existing.id;
  }

  // Geocode the address
  let lat: string | undefined;
  let lng: string | undefined;
  if (extracted.address_line1 && extracted.city && extracted.state) {
    const fullAddress = `${extracted.address_line1}, ${extracted.city}, ${extracted.state} ${extracted.postal_code ?? ""}`;
    const coords = await geocodeAddress(fullAddress);
    if (coords) { lat = String(coords.lat); lng = String(coords.lng); }
  }

  const phoneResult = validatePhone(extracted.phone);
  const urlResult = validateUrl(extracted.website);

  const result = await db.createFacility({
    organizationId: orgId,
    name: extracted.name,
    facilityType: (extracted.facility_type as any) ?? "unknown",
    addressLine1: extracted.address_line1,
    city: extracted.city,
    state: extracted.state,
    postalCode: extracted.postal_code,
    phone: phoneResult.normalized ?? undefined,
    phoneVerified: phoneResult.valid,
    email: extracted.email,
    website: urlResult.normalized ?? undefined,
    websiteStatus: urlResult.valid ? "live" : "unknown",
    genderPolicy: (extracted.gender_policy as any) ?? "unknown",
    acceptedInsurance: extracted.accepted_insurance?.map(normalizeInsurance),
    paymentOptions: extracted.payment_options,
    specializations: extracted.specializations,
    substancesTreated: extracted.substances_treated?.map(normalizeSubstance),
    treatmentApproaches: extracted.treatment_approaches,
    ageGroups: extracted.age_groups,
    languages: extracted.languages ?? ["English"],
    amenities: extracted.amenities,
    accreditations: extracted.accreditations,
    licenseNumber: extracted.license_number,
    capacity: extracted.capacity ?? undefined,
    hours: extracted.hours,
    admissionsProcess: extracted.admissions_process,
    eligibility: extracted.eligibility,
    costRange: extracted.cost_range,
    description: extracted.description,
    lat,
    lng,
    addressVerified: !!(lat && lng),
    status: "active",
    lastVerifiedAt: new Date(),
    lastCrawledAt: new Date(),
  });

  // Create review item for new facility
  await db.createReviewItem({
    reviewType: "new_entity",
    entityType: "facility",
    entityId: result.id,
    priority: extracted.confidence < 0.5 ? "high" : "medium",
    details: { reason: "New facility created from web crawl", fields: ["name", "address", "phone"] },
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
  sourceId: number,
  validationResults?: Record<string, boolean>
) {
  if (!citations) return;
  for (const [field, citation] of Object.entries(citations)) {
    const confidence = typeof confidenceMap === "number" ? confidenceMap : confidenceMap[field] ?? 0.5;
    const validated = validationResults?.[field];
    await db.createAssertion({
      entityType,
      entityId,
      fieldPath: `${entityType}.${field}`,
      valueJson: { field, excerpt: citation.excerpt },
      confidence,
      method: "llm",
      sourceId,
      sourceExcerpt: citation.excerpt.substring(0, 300),
      validated: validated !== undefined,
      validationResult: validated !== undefined ? (validated ? "pass" : "fail") : undefined,
    });

    // Create review item for low-confidence assertions
    if (confidence < 0.4) {
      await db.createReviewItem({
        reviewType: "low_confidence",
        entityType,
        entityId,
        priority: confidence < 0.2 ? "high" : "medium",
        details: { reason: `Low confidence (${confidence.toFixed(2)}) on field: ${field}`, fields: [field] },
      });
    }
  }
}

// ============================================================================
// Write tags (enhanced with facility tags)
// ============================================================================

async function writeProgramTags(programId: number, extracted: ExtractionResult["programs"][0]) {
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

  if (extracted.level_of_care && extracted.level_of_care !== "unknown") {
    const locTag = await db.findOrCreateTag("level_of_care", extracted.level_of_care);
    if (locTag) await db.upsertProgramTag(programId, locTag.id, extracted.confidence.level_of_care ?? 0.7);
  }
}

async function writeFacilityTags(facilityId: number, extracted: ExtractionResult["facility"]) {
  if (!extracted) return;

  const tagMappings: { namespace: string; values: string[] | undefined }[] = [
    { namespace: "insurance_carrier", values: extracted.accepted_insurance },
    { namespace: "substance", values: extracted.substances_treated },
    { namespace: "treatment_approach", values: extracted.treatment_approaches },
    { namespace: "amenity", values: extracted.amenities },
    { namespace: "accreditation", values: extracted.accreditations },
  ];

  for (const mapping of tagMappings) {
    if (!mapping.values) continue;
    for (const value of mapping.values) {
      const normalized = mapping.namespace === "insurance_carrier" ? normalizeInsurance(value) :
        mapping.namespace === "substance" ? normalizeSubstance(value) : value;
      const tag = await db.findOrCreateTag(mapping.namespace, normalized.toLowerCase(), normalized);
      if (tag) await db.upsertFacilityTag(facilityId, tag.id, extracted.confidence);
    }
  }
}

// ============================================================================
// Quality score computation
// ============================================================================

async function computeAndStoreQuality(facilityId: number) {
  const facility = await db.getFacilityById(facilityId);
  if (!facility) return;

  // Count programs for this facility
  const dbInstance = await db.getDb();
  if (!dbInstance) return;
  const [{ c: programCount }] = await dbInstance.select({ c: (await import("drizzle-orm")).count() })
    .from((await import("../drizzle/schema")).programs)
    .where((await import("drizzle-orm")).eq((await import("../drizzle/schema")).programs.facilityId, facilityId));

  const completeness = computeCompletenessScore(facility, programCount);
  const freshness = computeFreshnessScore(facility.lastVerifiedAt);

  // Get validation pass rate from assertions
  const assertionRows = await db.getAssertionsForEntity("facility", facilityId);
  const validatedAssertions = assertionRows.filter(a => a.assertion.validated);
  const passRate = validatedAssertions.length > 0
    ? validatedAssertions.filter(a => a.assertion.validationResult === "pass").length / validatedAssertions.length
    : 0.5;

  // Composite quality score
  const qualityScore = (completeness * 0.4) + (freshness * 0.3) + (passRate * 0.3);

  await db.updateFacility(facilityId, {
    qualityScore,
    completenessScore: completeness,
    freshnessScore: freshness,
    validationPassRate: passRate,
  });
}

// ============================================================================
// Main ingestion pipeline
// ============================================================================

export async function processIngestionJob(jobId: number): Promise<void> {
  const dbInstance = await db.getDb();
  if (!dbInstance) throw new Error("DB not available");

  const jobs = await db.getIngestionJobs({ limit: 1 });
  const job = jobs.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  await db.updateIngestionJob(jobId, {
    status: "running",
    startedAt: new Date(),
    attempts: (job.attempts ?? 0) + 1,
  });

  try {
    const payload = job.payload as any;
    let result = { entitiesCreated: 0, entitiesUpdated: 0, assertionsCreated: 0, sourcesCreated: 0, pagesProcessed: 0, reviewItemsCreated: 0 };

    if (job.jobType === "ingest_seed_url" && payload?.url) {
      result = await ingestUrl(payload.url);
    } else if (job.jobType === "crawl_domain" && payload?.domain) {
      result = await crawlDomain(payload.url || `https://${payload.domain}`, payload.depthLimit ?? 3);
    } else if (job.jobType === "recrawl_entity") {
      result = await recrawlEntity(payload.entityType, payload.entityId);
    } else if (job.jobType === "refresh_stale") {
      result = await refreshStaleEntities();
    } else if (job.jobType === "compute_quality") {
      result = await computeAllQuality();
    }

    await db.updateIngestionJob(jobId, { status: "completed", completedAt: new Date(), result });
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
  const stats = { entitiesCreated: 0, entitiesUpdated: 0, assertionsCreated: 0, sourcesCreated: 0, pagesProcessed: 0, reviewItemsCreated: 0 };

  console.log(`[Ingestion] Fetching: ${url}`);
  const response = await rateLimitedFetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

  const html = await response.text();
  const cleanText = htmlToText(html);
  const title = extractTitle(html);
  const domain = new URL(url).hostname;
  const contentHash = crypto.createHash("sha256").update(cleanText).digest("hex");

  // Check if content unchanged
  const existingSource = await db.getSourceByUri(url);
  if (existingSource && existingSource.contentHash === contentHash) {
    console.log(`[Ingestion] Content unchanged for ${url}, skipping`);
    return stats;
  }

  // Save crawl snapshot
  await db.createCrawlSnapshot({
    uri: url,
    contentHash,
    rawHtml: html.substring(0, 50000),
    cleanText: cleanText.substring(0, 10000),
    httpStatus: response.status,
    headers: Object.fromEntries(response.headers.entries()),
  });

  // Save source
  const source = await db.createSource({
    uri: url,
    domain,
    contentHash,
    contentType: "html",
    sourceType: "facility_website",
    sourcePriority: 3,
    title,
    rawText: cleanText.substring(0, 5000),
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

  await writeAssertions("organization", orgId, extracted.organization.citations, extracted.organization.confidence, source.id);

  // Resolve facility
  const facilityId = await resolveFacility(extracted.facility ?? undefined, orgId, domain);
  if (facilityId) {
    stats.entitiesCreated++;
    if (extracted.facility?.citations) {
      const validationResults: Record<string, boolean> = {};
      if (extracted.facility.phone) validationResults.phone = validatePhone(extracted.facility.phone).valid;
      if (extracted.facility.website) validationResults.website = validateUrl(extracted.facility.website).valid;
      await writeAssertions("facility", facilityId, extracted.facility.citations, extracted.facility.confidence, source.id, validationResults);
    }
    // Write facility tags
    await writeFacilityTags(facilityId, extracted.facility ?? undefined);
    // Compute quality score
    await computeAndStoreQuality(facilityId);
  }

  // Process programs
  for (const prog of extracted.programs) {
    const programResult = await db.createProgram({
      organizationId: orgId,
      facilityId: facilityId ?? undefined,
      name: prog.name,
      programType: (prog.program_type as any) ?? "unknown",
      levelOfCare: prog.level_of_care as any,
      telehealthAvailable: prog.telehealth_available ?? false,
      duration: prog.duration,
      scheduleText: prog.schedule_text,
      schedule: prog.schedule ? { daysPerWeek: prog.schedule.days_per_week ?? undefined, hoursPerDay: prog.schedule.hours_per_day ?? undefined, notes: prog.schedule.notes } : undefined,
      lengthOfStay: prog.length_of_stay ? { minDays: prog.length_of_stay.min_days ?? undefined, maxDays: prog.length_of_stay.max_days ?? undefined, typicalDays: prog.length_of_stay.typical_days ?? undefined } : undefined,
      medicalCapability: prog.medical_capability ? { nursing247: prog.medical_capability.nursing_24_7, psychiatrist: prog.medical_capability.psychiatrist, matAvailable: prog.medical_capability.mat_available, medicallyManagedDetox: prog.medical_capability.medically_managed_detox, notes: prog.medical_capability.notes } : undefined,
      specializations: prog.specializations,
      paymentOptions: prog.payment_options,
      insuranceNotes: prog.insurance_notes,
      eligibility: prog.eligibility,
      description: prog.description,
      status: "active",
      lastVerifiedAt: new Date(),
    });

    stats.entitiesCreated++;
    await writeAssertions("program", programResult.id, prog.citations, prog.confidence, source.id);
    stats.assertionsCreated += Object.keys(prog.citations ?? {}).length;
    await writeProgramTags(programResult.id, prog);
  }

  console.log(`[Ingestion] Completed: ${url} - ${stats.entitiesCreated} entities, ${stats.assertionsCreated} assertions`);
  return stats;
}

async function crawlDomain(startUrl: string, depthLimit: number = 3) {
  const stats = { entitiesCreated: 0, entitiesUpdated: 0, assertionsCreated: 0, sourcesCreated: 0, pagesProcessed: 0, reviewItemsCreated: 0 };
  const domain = new URL(startUrl).hostname;
  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];

  while (queue.length > 0 && visited.size < 10) {
    const item = queue.shift()!;
    if (visited.has(item.url) || item.depth > depthLimit) continue;
    visited.add(item.url);

    try {
      const pageStats = await ingestUrl(item.url);
      stats.entitiesCreated += pageStats.entitiesCreated;
      stats.assertionsCreated += pageStats.assertionsCreated;
      stats.sourcesCreated += pageStats.sourcesCreated;
      stats.pagesProcessed += pageStats.pagesProcessed;

      if (item.depth < depthLimit) {
        const response = await rateLimitedFetch(item.url);
        if (response.ok) {
          const html = await response.text();
          const linkRegex = /href=["']([^"']+)["']/gi;
          let match;
          while ((match = linkRegex.exec(html)) !== null) {
            try {
              const linkUrl = new URL(match[1], item.url);
              if (linkUrl.hostname === domain && !visited.has(linkUrl.href) && !linkUrl.href.includes("#") && !linkUrl.href.match(/\.(jpg|png|gif|css|js|pdf|zip)$/i)) {
                const path = linkUrl.pathname.toLowerCase();
                if (path.includes("program") || path.includes("treatment") || path.includes("service") || path.includes("admission") || path.includes("about") || path.includes("contact") || path.includes("location") || path.includes("facility") || path.includes("insurance") || path === "/") {
                  queue.push({ url: linkUrl.href, depth: item.depth + 1 });
                }
              }
            } catch { /* Invalid URL, skip */ }
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
  const stats = { entitiesCreated: 0, entitiesUpdated: 0, assertionsCreated: 0, sourcesCreated: 0, pagesProcessed: 0, reviewItemsCreated: 0 };
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
  const stats = { entitiesCreated: 0, entitiesUpdated: 0, assertionsCreated: 0, sourcesCreated: 0, pagesProcessed: 0, reviewItemsCreated: 0 };
  const staleEntities = await db.getStaleEntities(120);
  for (const entity of staleEntities.slice(0, 5)) {
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

async function computeAllQuality() {
  const stats = { entitiesCreated: 0, entitiesUpdated: 0, assertionsCreated: 0, sourcesCreated: 0, pagesProcessed: 0, reviewItemsCreated: 0 };
  const dbInstance = await db.getDb();
  if (!dbInstance) return stats;

  const { facilities: facilitiesTable } = await import("../drizzle/schema");
  const allFacilities = await dbInstance.select({ id: facilitiesTable.id }).from(facilitiesTable).limit(1000);

  for (const fac of allFacilities) {
    await computeAndStoreQuality(fac.id);
    stats.entitiesUpdated++;
  }
  return stats;
}
