// Deduplication script for programs
// Identifies near-duplicate programs using name similarity + organization matching
// Merges duplicates by keeping the higher-quality version and transferring tags/assertions

import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ============================================================================
// Step 1: Load all programs with their org and facility info
// ============================================================================

const [programs] = await conn.query(`
  SELECT p.id, p.name, p.description, p.levelOfCare, p.programType,
         p.organizationId, p.facilityId, p.qualityScore, p.programStatus,
         o.name as orgName
  FROM programs p
  LEFT JOIN organizations o ON o.id = p.organizationId
  WHERE p.programStatus = 'active'
  ORDER BY p.organizationId, p.name
`);

console.log(`Loaded ${programs.length} active programs`);

// ============================================================================
// Step 2: Normalize names for comparison
// ============================================================================

function normalize(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Compute Jaccard similarity on word sets
function wordSimilarity(a, b) {
  const wordsA = new Set(normalize(a).split(" ").filter(w => w.length > 2));
  const wordsB = new Set(normalize(b).split(" ").filter(w => w.length > 2));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

// Check if one name is a substring of another
function isSubstring(a, b) {
  const normA = normalize(a);
  const normB = normalize(b);
  return normA.includes(normB) || normB.includes(normA);
}

// ============================================================================
// Step 3: Find duplicate clusters within same organization
// ============================================================================

// Group programs by organization
const orgGroups = {};
for (const prog of programs) {
  const key = prog.organizationId;
  if (!orgGroups[key]) orgGroups[key] = [];
  orgGroups[key].push(prog);
}

const duplicateClusters = [];

for (const [orgId, progs] of Object.entries(orgGroups)) {
  if (progs.length < 2) continue;

  // Compare all pairs within the same org
  const merged = new Set();
  
  for (let i = 0; i < progs.length; i++) {
    if (merged.has(progs[i].id)) continue;
    
    const cluster = [progs[i]];
    
    for (let j = i + 1; j < progs.length; j++) {
      if (merged.has(progs[j].id)) continue;
      
      const sim = wordSimilarity(progs[i].name, progs[j].name);
      const substring = isSubstring(progs[i].name, progs[j].name);
      const sameLoc = progs[i].levelOfCare === progs[j].levelOfCare;
      const sameType = progs[i].programType === progs[j].programType;
      
      // Consider duplicates if:
      // 1. Very high name similarity (>0.8) within same org
      // 2. One name is substring of other AND same level of care
      // 3. Exact normalized name match
      const isDuplicate = 
        normalize(progs[i].name) === normalize(progs[j].name) ||
        (sim >= 0.8 && (sameLoc || sameType)) ||
        (substring && sameLoc && sim >= 0.5);
      
      if (isDuplicate) {
        cluster.push(progs[j]);
        merged.add(progs[j].id);
      }
    }
    
    if (cluster.length > 1) {
      merged.add(progs[i].id);
      duplicateClusters.push(cluster);
    }
  }
}

console.log(`\nFound ${duplicateClusters.length} duplicate clusters`);

// ============================================================================
// Step 4: Merge duplicates - keep highest quality, transfer tags/assertions
// ============================================================================

let totalMerged = 0;
let totalDeactivated = 0;

for (const cluster of duplicateClusters) {
  // Sort by quality score descending, then by description length (more complete)
  cluster.sort((a, b) => {
    const qualDiff = (b.qualityScore || 0) - (a.qualityScore || 0);
    if (qualDiff !== 0) return qualDiff;
    return (b.description || "").length - (a.description || "").length;
  });
  
  const keeper = cluster[0];
  const duplicates = cluster.slice(1);
  
  console.log(`\nCluster (org: ${keeper.orgName}):`);
  console.log(`  KEEP: [${keeper.id}] "${keeper.name}" (quality: ${keeper.qualityScore?.toFixed(2)}, loc: ${keeper.levelOfCare})`);
  
  for (const dup of duplicates) {
    console.log(`  MERGE: [${dup.id}] "${dup.name}" (quality: ${dup.qualityScore?.toFixed(2)}, loc: ${dup.levelOfCare})`);
    
    // Transfer tags from duplicate to keeper
    const [dupTags] = await conn.query(
      "SELECT tagId, confidence FROM program_tags WHERE programId = ?",
      [dup.id]
    );
    
    for (const tag of dupTags) {
      await conn.query(
        `INSERT INTO program_tags (programId, tagId, confidence) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE confidence = GREATEST(confidence, VALUES(confidence))`,
        [keeper.id, tag.tagId, tag.confidence]
      );
    }
    
    // Transfer assertions from duplicate to keeper
    await conn.query(
      "UPDATE assertions SET entityId = ? WHERE entityType = 'program' AND entityId = ?",
      [keeper.id, dup.id]
    );
    
    // Fill in missing fields on keeper from duplicate
    if (!keeper.description && dup.description) {
      await conn.query("UPDATE programs SET description = ? WHERE id = ?", [dup.description, keeper.id]);
    }
    
    // Deactivate the duplicate
    await conn.query("UPDATE programs SET programStatus = 'closed' WHERE id = ?", [dup.id]);
    totalDeactivated++;
  }
  
  totalMerged++;
}

// ============================================================================
// Step 5: Also find cross-org exact duplicates (same name, same level of care)
// ============================================================================

console.log(`\n=== Cross-org duplicate check ===`);

const nameMap = {};
for (const prog of programs) {
  const key = normalize(prog.name) + "|" + (prog.levelOfCare || "");
  if (!nameMap[key]) nameMap[key] = [];
  nameMap[key].push(prog);
}

let crossOrgDups = 0;
for (const [key, progs] of Object.entries(nameMap)) {
  if (progs.length < 2) continue;
  // Check if they're from different orgs
  const orgs = new Set(progs.map(p => p.organizationId));
  if (orgs.size < 2) continue;
  
  // These are genuinely different programs at different organizations with the same name
  // Don't merge, but log for awareness
  console.log(`  Same name across orgs: "${progs[0].name}" (${progs.length} instances across ${orgs.size} orgs)`);
  crossOrgDups++;
}

console.log(`Cross-org same-name programs: ${crossOrgDups} (not merged - different organizations)`);

// ============================================================================
// Step 6: Check for the mergedIntoId column - add if missing
// ============================================================================

// No mergedIntoId column needed - we just set programStatus to inactive

// ============================================================================
// Final stats
// ============================================================================

const [activeCount] = await conn.query("SELECT COUNT(*) as cnt FROM programs WHERE programStatus = 'active'");
const [mergedCount] = await conn.query("SELECT COUNT(*) as cnt FROM programs WHERE programStatus = 'closed'");
const [totalCount] = await conn.query("SELECT COUNT(*) as cnt FROM programs");

console.log(`\n========== DEDUPLICATION COMPLETE ==========`);
console.log(`Duplicate clusters found: ${duplicateClusters.length}`);
console.log(`Programs deactivated (merged): ${totalDeactivated}`);
console.log(`Active programs: ${activeCount[0].cnt}`);
console.log(`Merged programs: ${mergedCount[0].cnt}`);
console.log(`Total programs: ${totalCount[0].cnt}`);

await conn.end();
process.exit(0);
