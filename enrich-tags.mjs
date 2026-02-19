// Tag enrichment script
// Analyzes each program's name, description, level of care, and existing tags
// Uses LLM to generate comprehensive condition, substance, population, and modality tags
// Also applies rule-based enrichment for common patterns

import mysql from "mysql2/promise";
import { invokeLLM } from "./server/_core/llm.ts";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ============================================================================
// Step 1: Rule-based enrichment (fast, no LLM needed)
// ============================================================================

const CONDITION_RULES = [
  { patterns: ["alcohol", "alcoholism", "drinking"], tags: ["alcohol use disorder", "substance use disorder", "addiction"] },
  { patterns: ["opioid", "heroin", "fentanyl", "opiate"], tags: ["opioid use disorder", "substance use disorder", "addiction"] },
  { patterns: ["drug", "substance abuse", "substance use", "addiction", "chemical dependency"], tags: ["substance use disorder", "addiction"] },
  { patterns: ["dual diagnosis", "co-occurring", "co occurring", "comorbid"], tags: ["co-occurring disorders", "substance use disorder", "mental health disorders"] },
  { patterns: ["depression", "depressive"], tags: ["depression", "mood disorders", "mental health disorders"] },
  { patterns: ["anxiety", "anxious", "panic"], tags: ["anxiety", "anxiety disorders", "mental health disorders"] },
  { patterns: ["trauma", "ptsd", "post-traumatic"], tags: ["trauma", "ptsd", "mental health disorders"] },
  { patterns: ["eating disorder", "anorexia", "bulimia", "binge eating"], tags: ["eating disorders", "mental health disorders"] },
  { patterns: ["bipolar", "manic"], tags: ["bipolar disorder", "mood disorders", "mental health disorders"] },
  { patterns: ["ocd", "obsessive"], tags: ["ocd", "anxiety disorders", "mental health disorders"] },
  { patterns: ["detox", "detoxification", "withdrawal"], tags: ["withdrawal management", "substance use disorder"] },
  { patterns: ["gambling"], tags: ["gambling disorder", "behavioral addiction"] },
  { patterns: ["sex addiction", "sexual compulsivity"], tags: ["sexual compulsivity", "behavioral addiction"] },
  { patterns: ["chronic pain", "pain management"], tags: ["chronic pain", "co-occurring disorders"] },
  { patterns: ["schizophrenia", "psychosis", "psychotic"], tags: ["psychotic disorders", "mental health disorders"] },
  { patterns: ["adhd", "attention deficit"], tags: ["adhd", "mental health disorders"] },
  { patterns: ["personality disorder", "borderline"], tags: ["personality disorders", "mental health disorders"] },
];

const SUBSTANCE_RULES = [
  { patterns: ["alcohol", "alcoholism", "drinking"], tags: ["alcohol"] },
  { patterns: ["opioid", "heroin", "fentanyl", "opiate", "oxycodone", "hydrocodone"], tags: ["opioids", "heroin", "prescription opioids"] },
  { patterns: ["cocaine", "crack"], tags: ["cocaine"] },
  { patterns: ["methamphetamine", "meth", "crystal meth", "amphetamine"], tags: ["methamphetamine", "stimulants"] },
  { patterns: ["marijuana", "cannabis", "weed"], tags: ["marijuana"] },
  { patterns: ["benzodiazepine", "benzo", "xanax", "valium"], tags: ["benzodiazepines", "prescription drugs"] },
  { patterns: ["prescription", "pills"], tags: ["prescription drugs"] },
  { patterns: ["drug", "substance", "addiction", "chemical"], tags: ["alcohol", "opioids", "cocaine", "methamphetamine", "benzodiazepines", "marijuana", "prescription drugs"] },
];

const POPULATION_RULES = [
  { patterns: ["veteran", "military", "service member"], tags: ["veterans", "military families"] },
  { patterns: ["adolescent", "teen", "youth", "young adult"], tags: ["adolescents", "young adults"] },
  { patterns: ["women", "female", "mother", "pregnant", "maternal"], tags: ["women", "pregnant women"] },
  { patterns: ["men", "male", "father"], tags: ["men"] },
  { patterns: ["lgbtq", "lgbt", "gay", "lesbian", "transgender", "queer"], tags: ["lgbtq+"] },
  { patterns: ["elderly", "senior", "older adult", "geriatric"], tags: ["older adults"] },
  { patterns: ["first responder", "firefighter", "police", "ems"], tags: ["first responders"] },
  { patterns: ["professional", "executive", "healthcare professional"], tags: ["professionals", "healthcare professionals"] },
  { patterns: ["family", "families"], tags: ["families"] },
  { patterns: ["native american", "indigenous"], tags: ["indigenous peoples"] },
  { patterns: ["spanish", "hispanic", "latino", "latina"], tags: ["hispanic/latino"] },
];

const MODALITY_RULES = [
  { patterns: ["cbt", "cognitive behavioral"], tags: ["cognitive behavioral therapy (cbt)"] },
  { patterns: ["dbt", "dialectical"], tags: ["dialectical behavior therapy (dbt)"] },
  { patterns: ["emdr", "eye movement"], tags: ["emdr"] },
  { patterns: ["12 step", "twelve step", "12-step"], tags: ["12-step program"] },
  { patterns: ["group therapy", "group counseling"], tags: ["group therapy"] },
  { patterns: ["individual therapy", "individual counseling", "one-on-one"], tags: ["individual therapy"] },
  { patterns: ["family therapy", "family counseling"], tags: ["family therapy"] },
  { patterns: ["art therapy", "creative arts"], tags: ["art therapy", "experiential therapy"] },
  { patterns: ["equine", "horse"], tags: ["equine therapy", "experiential therapy"] },
  { patterns: ["meditation", "mindfulness"], tags: ["mindfulness-based therapy", "meditation"] },
  { patterns: ["yoga"], tags: ["yoga therapy", "holistic therapy"] },
  { patterns: ["mat", "medication-assisted", "medication assisted", "suboxone", "vivitrol", "naltrexone", "methadone", "buprenorphine"], tags: ["medication-assisted treatment (mat)"] },
  { patterns: ["telehealth", "virtual", "online therapy", "remote"], tags: ["telehealth"] },
  { patterns: ["adventure therapy", "wilderness", "outdoor"], tags: ["adventure therapy", "experiential therapy"] },
  { patterns: ["music therapy"], tags: ["music therapy", "experiential therapy"] },
  { patterns: ["motivational interviewing"], tags: ["motivational interviewing"] },
  { patterns: ["trauma-informed", "trauma informed"], tags: ["trauma-informed care"] },
  { patterns: ["holistic", "whole person", "integrative"], tags: ["holistic therapy"] },
];

function applyRules(text, rules) {
  const matched = new Set();
  const lower = text.toLowerCase();
  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      if (lower.includes(pattern)) {
        for (const tag of rule.tags) matched.add(tag);
        break;
      }
    }
  }
  return Array.from(matched);
}

// ============================================================================
// Step 2: Get all programs with their existing data
// ============================================================================

const [programs] = await conn.query(`
  SELECT p.id, p.name, p.description, p.levelOfCare, p.programType,
         p.specializations, p.paymentOptions, p.eligibility,
         o.name as orgName
  FROM programs p
  LEFT JOIN organizations o ON o.id = p.organizationId
  ORDER BY p.id
`);

console.log(`Found ${programs.length} programs to enrich`);

// Get existing tags for each program
const [existingProgramTags] = await conn.query(`
  SELECT pt.programId, t.namespace, t.label
  FROM program_tags pt
  JOIN tags t ON t.id = pt.tagId
`);

const existingTagMap = {};
for (const row of existingProgramTags) {
  if (!existingTagMap[row.programId]) existingTagMap[row.programId] = [];
  existingTagMap[row.programId].push({ namespace: row.namespace, label: row.label });
}

// ============================================================================
// Step 3: Apply rule-based enrichment to all programs
// ============================================================================

let totalNewTags = 0;
let programsEnriched = 0;

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

async function upsertProgramTag(programId, tagId, confidence = 0.6) {
  await conn.query(
    `INSERT INTO program_tags (programId, tagId, confidence) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE confidence = GREATEST(confidence, VALUES(confidence))`,
    [programId, tagId, confidence]
  );
}

for (const prog of programs) {
  const text = [
    prog.name || "",
    prog.description || "",
    prog.orgName || "",
    prog.levelOfCare || "",
    prog.programType || "",
    prog.eligibility || "",
    JSON.stringify(prog.specializations || []),
    JSON.stringify(prog.paymentOptions || []),
  ].join(" ");

  const existingLabels = new Set(
    (existingTagMap[prog.id] || []).map(t => t.label.toLowerCase())
  );

  // Apply rules
  const conditionTags = applyRules(text, CONDITION_RULES);
  const substanceTags = applyRules(text, SUBSTANCE_RULES);
  const populationTags = applyRules(text, POPULATION_RULES);
  const modalityTags = applyRules(text, MODALITY_RULES);

  let newForThisProgram = 0;

  for (const tag of conditionTags) {
    if (!existingLabels.has(tag.toLowerCase())) {
      const tagId = await findOrCreateTag("condition", tag);
      await upsertProgramTag(prog.id, tagId, 0.65);
      newForThisProgram++;
    }
  }
  for (const tag of substanceTags) {
    if (!existingLabels.has(tag.toLowerCase())) {
      const tagId = await findOrCreateTag("substance", tag);
      await upsertProgramTag(prog.id, tagId, 0.6);
      newForThisProgram++;
    }
  }
  for (const tag of populationTags) {
    if (!existingLabels.has(tag.toLowerCase())) {
      const tagId = await findOrCreateTag("population", tag);
      await upsertProgramTag(prog.id, tagId, 0.6);
      newForThisProgram++;
    }
  }
  for (const tag of modalityTags) {
    if (!existingLabels.has(tag.toLowerCase())) {
      const tagId = await findOrCreateTag("modality", tag);
      await upsertProgramTag(prog.id, tagId, 0.6);
      newForThisProgram++;
    }
  }

  if (newForThisProgram > 0) {
    programsEnriched++;
    totalNewTags += newForThisProgram;
  }
}

console.log(`\n=== Rule-based enrichment complete ===`);
console.log(`Programs enriched: ${programsEnriched}/${programs.length}`);
console.log(`New tags added: ${totalNewTags}`);

// ============================================================================
// Step 4: LLM enrichment for programs with few tags
// ============================================================================

// Find programs that still have fewer than 3 condition tags
const [underTagged] = await conn.query(`
  SELECT p.id, p.name, p.description, p.levelOfCare, p.programType,
         p.specializations, p.eligibility, o.name as orgName,
         (SELECT COUNT(*) FROM program_tags pt JOIN tags t ON t.id = pt.tagId 
          WHERE pt.programId = p.id AND t.namespace = 'condition') as conditionCount
  FROM programs p
  LEFT JOIN organizations o ON o.id = p.organizationId
  HAVING conditionCount < 2
  ORDER BY conditionCount ASC
  LIMIT 200
`);

console.log(`\n=== LLM enrichment for ${underTagged.length} under-tagged programs ===`);

// Batch them in groups of 5 for efficiency
const BATCH_SIZE = 5;
let llmTagsAdded = 0;

for (let i = 0; i < underTagged.length; i += BATCH_SIZE) {
  const batch = underTagged.slice(i, i + BATCH_SIZE);
  const programDescriptions = batch.map((p, idx) => 
    `Program ${idx + 1} (ID: ${p.id}):
    Name: ${p.name}
    Organization: ${p.orgName || "Unknown"}
    Level of Care: ${p.levelOfCare}
    Type: ${p.programType}
    Description: ${(p.description || "").substring(0, 300)}
    Specializations: ${JSON.stringify(p.specializations || [])}
    Eligibility: ${p.eligibility || "Not specified"}`
  ).join("\n\n");

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a healthcare data specialist. For each treatment program, generate appropriate tags in these categories:
- conditions: Mental health and substance use conditions treated (e.g., "alcohol use disorder", "opioid use disorder", "depression", "anxiety", "ptsd", "bipolar disorder", "eating disorders")
- substances: Specific substances treated (e.g., "alcohol", "opioids", "cocaine", "methamphetamine", "benzodiazepines", "marijuana")
- populations: Target populations (e.g., "adults", "adolescents", "veterans", "women", "lgbtq+", "professionals")
- modalities: Treatment modalities used (e.g., "cbt", "dbt", "group therapy", "individual therapy", "family therapy", "12-step program", "mat")

Be comprehensive but accurate. If a program treats addiction/substance use generally, include common substances. If it's a mental health program, include relevant conditions.
Return JSON array with one object per program.`
        },
        {
          role: "user",
          content: `Generate tags for these programs:\n\n${programDescriptions}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "tag_enrichment",
          strict: true,
          schema: {
            type: "object",
            properties: {
              programs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "integer" },
                    conditions: { type: "array", items: { type: "string" } },
                    substances: { type: "array", items: { type: "string" } },
                    populations: { type: "array", items: { type: "string" } },
                    modalities: { type: "array", items: { type: "string" } },
                  },
                  required: ["id", "conditions", "substances", "populations", "modalities"],
                  additionalProperties: false,
                },
              },
            },
            required: ["programs"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);

    for (const enriched of parsed.programs) {
      const progId = enriched.id;
      const existingLabels = new Set(
        (existingTagMap[progId] || []).map(t => t.label.toLowerCase())
      );

      for (const tag of enriched.conditions || []) {
        if (!existingLabels.has(tag.toLowerCase())) {
          const tagId = await findOrCreateTag("condition", tag);
          await upsertProgramTag(progId, tagId, 0.55);
          llmTagsAdded++;
          existingLabels.add(tag.toLowerCase());
        }
      }
      for (const tag of enriched.substances || []) {
        if (!existingLabels.has(tag.toLowerCase())) {
          const tagId = await findOrCreateTag("substance", tag);
          await upsertProgramTag(progId, tagId, 0.55);
          llmTagsAdded++;
          existingLabels.add(tag.toLowerCase());
        }
      }
      for (const tag of enriched.populations || []) {
        if (!existingLabels.has(tag.toLowerCase())) {
          const tagId = await findOrCreateTag("population", tag);
          await upsertProgramTag(progId, tagId, 0.55);
          llmTagsAdded++;
          existingLabels.add(tag.toLowerCase());
        }
      }
      for (const tag of enriched.modalities || []) {
        if (!existingLabels.has(tag.toLowerCase())) {
          const tagId = await findOrCreateTag("modality", tag);
          await upsertProgramTag(progId, tagId, 0.55);
          llmTagsAdded++;
          existingLabels.add(tag.toLowerCase());
        }
      }
    }
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: enriched ${batch.length} programs`);
  } catch (error) {
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: LLM error - ${error.message?.substring(0, 80)}`);
  }
}

console.log(`\nLLM tags added: ${llmTagsAdded}`);

// ============================================================================
// Step 5: Also geocode any facilities missing lat/lng
// ============================================================================

const [ungeocodedFacilities] = await conn.query(`
  SELECT id, name, addressLine1 as address, city, state FROM facilities WHERE lat IS NULL OR lng IS NULL OR lat = '' OR lng = ''
`);

if (ungeocodedFacilities.length > 0) {
  console.log(`\n=== Geocoding ${ungeocodedFacilities.length} facilities ===`);
  for (const fac of ungeocodedFacilities) {
    const addr = [fac.address, fac.city, fac.state].filter(Boolean).join(", ");
    if (!addr || addr.length < 5) {
      // Use name + state as fallback
      const searchAddr = [fac.name, fac.state || "USA"].join(", ");
      try {
        const { makeRequest } = await import("./server/_core/map.ts");
        const result = await makeRequest(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchAddr)}`
        );
        if (result?.results?.[0]?.geometry?.location) {
          const loc = result.results[0].geometry.location;
          await conn.query("UPDATE facilities SET lat = ?, lng = ? WHERE id = ?", [loc.lat, loc.lng, fac.id]);
          console.log(`  Geocoded ${fac.name}: ${loc.lat}, ${loc.lng}`);
        }
      } catch (e) {
        console.log(`  Failed to geocode ${fac.name}: ${e.message?.substring(0, 60)}`);
      }
    } else {
      try {
        const { makeRequest } = await import("./server/_core/map.ts");
        const result = await makeRequest(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}`
        );
        if (result?.results?.[0]?.geometry?.location) {
          const loc = result.results[0].geometry.location;
          await conn.query("UPDATE facilities SET lat = ?, lng = ? WHERE id = ?", [loc.lat, loc.lng, fac.id]);
          console.log(`  Geocoded ${fac.name}: ${loc.lat}, ${loc.lng}`);
        }
      } catch (e) {
        console.log(`  Failed to geocode ${fac.name}: ${e.message?.substring(0, 60)}`);
      }
    }
  }
}

// ============================================================================
// Step 6: Link orphaned programs to facilities
// ============================================================================

const [orphaned] = await conn.query(`
  SELECT p.id, p.organizationId FROM programs p WHERE p.facilityId IS NULL
`);

if (orphaned.length > 0) {
  console.log(`\n=== Linking ${orphaned.length} orphaned programs ===`);
  for (const prog of orphaned) {
    const [facs] = await conn.query(
      "SELECT id FROM facilities WHERE organizationId = ? LIMIT 1",
      [prog.organizationId]
    );
    if (facs.length > 0) {
      await conn.query("UPDATE programs SET facilityId = ? WHERE id = ?", [facs[0].id, prog.id]);
    }
  }
  const [stillOrphaned] = await conn.query("SELECT COUNT(*) as cnt FROM programs WHERE facilityId IS NULL");
  console.log(`  Linked. Still orphaned: ${stillOrphaned[0].cnt}`);
}

// ============================================================================
// Final stats
// ============================================================================

const [finalTags] = await conn.query("SELECT namespace, COUNT(*) as cnt FROM tags GROUP BY namespace ORDER BY cnt DESC");
const [finalPT] = await conn.query("SELECT COUNT(*) as cnt FROM program_tags");
const [finalConditions] = await conn.query(`
  SELECT COUNT(DISTINCT pt.programId) as cnt 
  FROM program_tags pt JOIN tags t ON t.id = pt.tagId 
  WHERE t.namespace = 'condition'
`);
const [finalSubstances] = await conn.query(`
  SELECT COUNT(DISTINCT pt.programId) as cnt 
  FROM program_tags pt JOIN tags t ON t.id = pt.tagId 
  WHERE t.namespace = 'substance'
`);
const [finalNoTags] = await conn.query(`
  SELECT COUNT(*) as cnt FROM programs p 
  WHERE NOT EXISTS (SELECT 1 FROM program_tags pt WHERE pt.programId = p.id)
`);

console.log("\n========== ENRICHMENT COMPLETE ==========");
console.log("Tags by namespace:");
for (const t of finalTags) console.log(`  ${t.namespace}: ${t.cnt}`);
console.log(`Total program-tag links: ${finalPT[0].cnt}`);
const [totalProgs] = await conn.query('SELECT COUNT(*) as cnt FROM programs');
console.log(`Programs with condition tags: ${finalConditions[0].cnt}/${totalProgs[0].cnt}`);
console.log(`Programs with substance tags: ${finalSubstances[0].cnt}/${totalProgs[0].cnt}`);
console.log(`Programs with NO tags: ${finalNoTags[0].cnt}/${totalProgs[0].cnt}`);

await conn.end();
process.exit(0);
