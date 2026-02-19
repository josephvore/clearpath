// Browser-based retry ingestion for URLs that blocked our bot fetcher
// Uses Puppeteer to render pages like a real browser, bypassing 403/bot blocks

import puppeteer from "puppeteer";
import mysql from "mysql2/promise";
import { invokeLLM } from "./server/_core/llm.ts";
import crypto from "crypto";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Failed URLs from mass ingestion that we want to retry
const FAILED_URLS = [
  "https://americanaddictioncenters.org/treatment",
  "https://americanaddictioncenters.org/rehab-guide/residential",
  "https://americanaddictioncenters.org/rehab-guide/outpatient-treatment",
  "https://www.sunrisehouse.com/addiction-treatment-programs/",
  "https://www.promises.com/treatment-programs/",
  "https://www.therecoveryvillage.com/treatment-programs/",
  "https://www.therecoveryvillage.com/treatment-programs/inpatient-rehab/",
  "https://www.therecoveryvillage.com/treatment-programs/outpatient-rehab/",
  "https://www.menningerclinic.org/patient-care",
  "https://www.mcleanhospital.org/treatment",
  "https://www.rosecrance.org/treatment/",
  "https://www.crchealth.com/treatment-programs/",
  "https://www.brightviewhealth.com/services",
  "https://www.banyantreatmentcenter.com/programs/",
  "https://www.banyantreatmentcenter.com/",
  "https://www.foundationsrecoverynetwork.com/programs/",
  "https://www.laguna-treatment.com/programs/",
  "https://www.turnbridge.com/programs/",
  "https://www.kolmac.com/treatment-programs/",
  "https://www.orchidrecoverycenter.com/programs/",
  "https://www.thewatershed.com/programs/",
  "https://www.caron.org/our-programs/addiction-treatment",
  "https://www.hazeldenbettyford.org/treatment/programs",
  "https://www.soba.com/treatment-programs/",
  "https://www.recoveryunplugged.com/programs/",
];

// Check which URLs are already ingested
const [existingSources] = await conn.query("SELECT uri FROM sources");
const existingUris = new Set(existingSources.map(s => s.uri));
const urlsToProcess = FAILED_URLS.filter(u => !existingUris.has(u));
console.log(`Total retry URLs: ${FAILED_URLS.length}, New (not yet ingested): ${urlsToProcess.length}`);

// ============================================================================
// LLM extraction (same as ingestion.ts)
// ============================================================================

const EXTRACTION_SYSTEM_PROMPT = `You are a data extraction agent for a treatment program discovery platform.
Extract structured information about behavioral health and addiction treatment organizations, facilities, and programs from web page content.

CRITICAL RULES:
1. Only extract information explicitly stated in the text. NEVER invent data.
2. For every field, provide the exact excerpt from the source text that supports it.
3. If information is not found, use null or omit the field.
4. Assign confidence scores (0.0-1.0) based on clarity.
5. Look for: organization names, facility locations, program types, treatment modalities, specialties, populations served, payment options, contact info, insurance accepted, substances treated.

Return a JSON object with the specified structure.`;

async function extractWithLLM(text, url) {
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: `Extract treatment program data from this page (${url}):\n\n${text.substring(0, 12000)}` }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              organization: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  confidence: { type: "number" },
                },
                required: ["name", "confidence"],
                additionalProperties: false,
              },
              facility: {
                type: ["object", "null"],
                properties: {
                  name: { type: "string" },
                  city: { type: "string" },
                  state: { type: "string" },
                  phone: { type: "string" },
                  confidence: { type: "number" },
                },
                required: ["name", "confidence"],
                additionalProperties: false,
              },
              programs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    level_of_care: { type: "string" },
                    program_type: { type: "string" },
                    description: { type: "string" },
                    modalities: { type: "array", items: { type: "string" } },
                    specialties: { type: "array", items: { type: "string" } },
                    conditions: { type: "array", items: { type: "string" } },
                    populations: { type: "array", items: { type: "string" } },
                    payment_options: { type: "array", items: { type: "string" } },
                    duration: { type: "string" },
                    eligibility: { type: "string" },
                    confidence: { type: "number" },
                  },
                  required: ["name", "confidence"],
                  additionalProperties: false,
                },
              },
            },
            required: ["organization", "programs"],
            additionalProperties: false,
          },
        },
      },
    });
    return JSON.parse(response.choices[0].message.content);
  } catch (e) {
    console.log(`  LLM error: ${e.message?.substring(0, 80)}`);
    return null;
  }
}

// ============================================================================
// DB helpers
// ============================================================================

async function findOrCreateOrg(name, domain) {
  const [existing] = await conn.query(
    "SELECT id FROM organizations WHERE websiteDomain = ? OR name = ? LIMIT 1",
    [domain, name]
  );
  if (existing.length > 0) return existing[0].id;
  
  const [result] = await conn.query(
    "INSERT INTO organizations (name, websiteDomain, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())",
    [name, domain]
  );
  return result.insertId;
}

async function findOrCreateFacility(orgId, fac, domain) {
  if (!fac) return null;
  const [existing] = await conn.query(
    "SELECT id FROM facilities WHERE organizationId = ? AND name = ? LIMIT 1",
    [orgId, fac.name]
  );
  if (existing.length > 0) return existing[0].id;
  
  const [result] = await conn.query(
    `INSERT INTO facilities (organizationId, name, facilityType, city, state, phone, status, createdAt, updatedAt)
     VALUES (?, ?, 'unknown', ?, ?, ?, 'active', NOW(), NOW())`,
    [orgId, fac.name, fac.city || null, fac.state || null, fac.phone || null]
  );
  return result.insertId;
}

async function createProgram(orgId, facilityId, prog) {
  const [result] = await conn.query(
    `INSERT INTO programs (organizationId, facilityId, name, programType, levelOfCare, 
     description, duration, eligibility, programStatus, createdAt, updatedAt, lastVerifiedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW(), NOW())`,
    [orgId, facilityId, prog.name, prog.program_type || 'unknown', prog.level_of_care || 'unknown',
     prog.description || null, prog.duration || null, prog.eligibility || null]
  );
  return result.insertId;
}

async function findOrCreateTag(namespace, label) {
  const normalized = label.toLowerCase().trim();
  const [existing] = await conn.query(
    "SELECT id FROM tags WHERE namespace = ? AND label = ? LIMIT 1",
    [namespace, normalized]
  );
  if (existing.length > 0) return existing[0].id;
  const [result] = await conn.query(
    "INSERT INTO tags (namespace, label, canonicalLabel) VALUES (?, ?, ?)",
    [namespace, normalized, label]
  );
  return result.insertId;
}

async function createSource(url, domain, text) {
  const contentHash = crypto.createHash("sha256").update(text).digest("hex");
  const [result] = await conn.query(
    `INSERT INTO sources (uri, domain, contentHash, contentType, sourceType, sourcePriority, rawText, robotsAllowed, httpStatus, createdAt)
     VALUES (?, ?, ?, 'html', 'facility_website', 3, ?, 1, 200, NOW())`,
    [url, domain, contentHash, text.substring(0, 5000)]
  );
  return result.insertId;
}

async function createAssertion(entityType, entityId, field, excerpt, confidence, sourceId) {
  await conn.query(
    `INSERT INTO assertions (entityType, entityId, fieldPath, valueJson, confidence, method, sourceId, sourceExcerpt, createdAt)
     VALUES (?, ?, ?, ?, ?, 'llm', ?, ?, NOW())`,
    [entityType, entityId, `${entityType}.${field}`, JSON.stringify({ field, excerpt: excerpt?.substring(0, 300) || "" }), confidence, sourceId, (excerpt || "").substring(0, 300)]
  );
}

// ============================================================================
// HTML to clean text
// ============================================================================

function htmlToText(html) {
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

// ============================================================================
// Main browser-based ingestion
// ============================================================================

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

let succeeded = 0;
let failed = 0;
let totalEntities = 0;
let totalAssertions = 0;

const BATCH_SIZE = 3;
for (let i = 0; i < urlsToProcess.length; i += BATCH_SIZE) {
  const batch = urlsToProcess.slice(i, i + BATCH_SIZE);
  console.log(`\n===== Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(urlsToProcess.length / BATCH_SIZE)} =====`);
  
  for (const url of batch) {
    console.log(`--- Processing: ${url} ---`);
    const page = await browser.newPage();
    
    try {
      // Set a realistic user agent
      await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
      
      // Navigate with timeout
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      
      // Wait a bit for dynamic content
      await new Promise(r => setTimeout(r, 2000));
      
      // Get the rendered HTML
      const html = await page.content();
      const cleanText = htmlToText(html);
      
      if (cleanText.length < 100) {
        console.log(`  ✗ Page too short (${cleanText.length} chars)`);
        failed++;
        await page.close();
        continue;
      }
      
      const domain = new URL(url).hostname;
      
      // Save source
      const sourceId = await createSource(url, domain, cleanText);
      
      // Extract with LLM
      const extracted = await extractWithLLM(cleanText, url);
      if (!extracted || !extracted.organization) {
        console.log(`  ✗ No data extracted`);
        failed++;
        await page.close();
        continue;
      }
      
      // Resolve organization
      const orgId = await findOrCreateOrg(extracted.organization.name, domain);
      totalEntities++;
      
      // Create assertion for org
      await createAssertion("organization", orgId, "name", extracted.organization.name, extracted.organization.confidence, sourceId);
      totalAssertions++;
      
      // Resolve facility
      const facilityId = await findOrCreateFacility(orgId, extracted.facility, domain);
      if (facilityId) {
        totalEntities++;
        await createAssertion("facility", facilityId, "name", extracted.facility?.name, extracted.facility?.confidence || 0.5, sourceId);
        totalAssertions++;
      }
      
      // Create programs
      for (const prog of extracted.programs || []) {
        const progId = await createProgram(orgId, facilityId, prog);
        totalEntities++;
        
        await createAssertion("program", progId, "name", prog.name, prog.confidence, sourceId);
        totalAssertions++;
        
        // Write tags
        const tagMappings = [
          { namespace: "modality", values: prog.modalities },
          { namespace: "specialty", values: prog.specialties },
          { namespace: "condition", values: prog.conditions },
          { namespace: "population", values: prog.populations },
          { namespace: "payer", values: prog.payment_options },
        ];
        
        for (const mapping of tagMappings) {
          if (!mapping.values) continue;
          for (const value of mapping.values) {
            const tagId = await findOrCreateTag(mapping.namespace, value);
            await conn.query(
              `INSERT INTO program_tags (programId, tagId, confidence) VALUES (?, ?, ?)
               ON DUPLICATE KEY UPDATE confidence = GREATEST(confidence, VALUES(confidence))`,
              [progId, tagId, prog.confidence || 0.5]
            );
          }
        }
      }
      
      console.log(`  ✓ Entities: ${extracted.programs?.length || 0} programs, Assertions: ${totalAssertions}`);
      succeeded++;
    } catch (e) {
      console.log(`  ✗ Failed: ${e.message?.substring(0, 80)}`);
      failed++;
    }
    
    await page.close();
  }
  
  // Pause between batches
  if (i + BATCH_SIZE < urlsToProcess.length) {
    console.log("  [Pausing 3s between batches...]");
    await new Promise(r => setTimeout(r, 3000));
  }
}

await browser.close();

// Final stats
const [finalProgs] = await conn.query("SELECT COUNT(*) as cnt FROM programs WHERE programStatus = 'active'");
const [finalOrgs] = await conn.query("SELECT COUNT(*) as cnt FROM organizations");
const [finalFacs] = await conn.query("SELECT COUNT(*) as cnt FROM facilities");
const [finalTags] = await conn.query("SELECT COUNT(*) as cnt FROM program_tags");

console.log(`\n========== BROWSER INGESTION COMPLETE ==========`);
console.log(`Succeeded: ${succeeded}/${urlsToProcess.length}`);
console.log(`Failed: ${failed}/${urlsToProcess.length}`);
console.log(`Entities created: ${totalEntities}`);
console.log(`Assertions created: ${totalAssertions}`);
console.log(`DB Totals: ${finalOrgs[0].cnt} orgs, ${finalFacs[0].cnt} facilities, ${finalProgs[0].cnt} active programs, ${finalTags[0].cnt} program_tags`);

await conn.end();
process.exit(0);
