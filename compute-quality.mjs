// Compute quality scores for all programs and facilities
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Compute program quality scores based on completeness of key fields + tag coverage
const [programs] = await conn.query(`
  SELECT p.id, p.name, p.levelOfCare, p.description, p.duration,
         p.eligibility, p.scheduleText, p.programType, p.facilityId,
         (SELECT COUNT(*) FROM program_tags pt WHERE pt.programId = p.id) as tagCount,
         (SELECT COUNT(*) FROM assertions a WHERE a.entityType = 'program' AND a.entityId = p.id) as assertionCount
  FROM programs p
`);

console.log(`Computing quality scores for ${programs.length} programs...`);

let updated = 0;
for (const p of programs) {
  // Completeness: check key fields
  const fields = [
    p.name, p.levelOfCare, p.description, p.duration,
    p.eligibility, p.scheduleText, p.programType
  ];
  const filledFields = fields.filter(f => f && f !== "unknown" && f !== "").length;
  const completeness = filledFields / fields.length;

  // Tag richness: more tags = better
  const tagScore = Math.min(p.tagCount / 10, 1.0); // 10+ tags = perfect

  // Assertion coverage: more citations = better
  const assertionScore = Math.min(p.assertionCount / 5, 1.0); // 5+ assertions = perfect

  // Overall quality = weighted average
  const quality = (completeness * 0.4) + (tagScore * 0.35) + (assertionScore * 0.25);

  await conn.query(
    "UPDATE programs SET qualityScore = ?, completenessScore = ? WHERE id = ?",
    [Math.round(quality * 100) / 100, Math.round(completeness * 100) / 100, p.id]
  );
  updated++;
}

console.log(`Updated ${updated} program quality scores`);

// Compute facility quality scores based on their programs
const [facilities] = await conn.query(`
  SELECT f.id, f.name, f.lat, f.lng, f.phone, f.website, f.description,
         f.addressLine1, f.city, f.state,
         (SELECT AVG(p.qualityScore) FROM programs p WHERE p.facilityId = f.id) as avgProgramQuality,
         (SELECT COUNT(*) FROM programs p WHERE p.facilityId = f.id) as programCount
  FROM facilities f
`);

console.log(`Computing quality scores for ${facilities.length} facilities...`);

for (const f of facilities) {
  const fields = [f.lat, f.phone, f.website, f.description, f.addressLine1, f.city, f.state];
  const filledFields = fields.filter(v => v && v !== "" && v !== 0).length;
  const completeness = filledFields / fields.length;
  
  const programQuality = f.avgProgramQuality || 0;
  const quality = (completeness * 0.5) + (programQuality * 0.5);

  await conn.query(
    "UPDATE facilities SET qualityScore = ?, completenessScore = ? WHERE id = ?",
    [Math.round(quality * 100) / 100, Math.round(completeness * 100) / 100, f.id]
  );
}

console.log(`Updated ${facilities.length} facility quality scores`);

// Print summary
const [avgQ] = await conn.query("SELECT AVG(qualityScore) as avg, MIN(qualityScore) as min, MAX(qualityScore) as max FROM programs WHERE qualityScore IS NOT NULL");
const [avgFQ] = await conn.query("SELECT AVG(qualityScore) as avg, MIN(qualityScore) as min, MAX(qualityScore) as max FROM facilities WHERE qualityScore IS NOT NULL");

console.log(`\n========== QUALITY SUMMARY ==========`);
console.log(`Programs: avg=${avgQ[0].avg?.toFixed(2)}, min=${avgQ[0].min?.toFixed(2)}, max=${avgQ[0].max?.toFixed(2)}`);
console.log(`Facilities: avg=${avgFQ[0].avg?.toFixed(2)}, min=${avgFQ[0].min?.toFixed(2)}, max=${avgFQ[0].max?.toFixed(2)}`);

await conn.end();
process.exit(0);
