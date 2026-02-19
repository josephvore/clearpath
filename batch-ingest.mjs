// Batch ingestion script - ingest diverse treatment providers
// Uses the ingestUrl function directly

import { ingestUrl } from "./server/ingestion.ts";

const urls = [
  // Large national providers
  "https://www.gatewayfoundation.org/",
  "https://www.gatewayfoundation.org/treatment-programs/",
  "https://recoverycentersofamerica.com/",
  "https://recoverycentersofamerica.com/treatment/",
  "https://talbottcampus.com/",
  "https://talbottcampus.com/treatment-programs/",
  "https://www.discoverynj.org/",
  "https://www.discoverynj.org/programs/",
  // Regional providers
  "https://buckheadbh.com/",
  "https://buckheadbh.com/programs/",
  "https://compasshealthcenter.net/",
  "https://compasshealthcenter.net/what-is-php-iop/",
  "https://www.cornellscott.org/programs-and-services/addiction-treatment",
  "https://www.cliffsidemalibu.com/",
  "https://www.cliffsidemalibu.com/treatment-programs/",
  // Hospital-based programs
  "https://www.hopkinsmedicine.org/substance-abuse-center/treatment/settings",
  "https://www.lorettohospital.org/our-services/behavioral-health-services/substance-use/",
  "https://www.uhhospitals.org/services/addiction-services/addiction-recovery",
  // Specialty providers
  "https://rogersbh.org/treatment-programs/residential-treatment/",
  "https://rogersbh.org/treatment-programs/",
  "https://sevencounties.org/substance-use/addiction-recovery-getting-started/",
  "https://www.crestwoodbehavioralhealth.com/location/san-francisco",
  // Additional diverse providers
  "https://americanaddictioncenters.org/treatment",
  "https://americanaddictioncenters.org/rehab-guide/outpatient-treatment/partial-hospitalization-programs",
  "https://www.sunrisehouse.com/",
  "https://www.sunrisehouse.com/addiction-treatment-programs/",
  "https://www.therecoveryvillage.com/treatment-programs/",
  "https://www.therecoveryvillage.com/treatment-programs/inpatient-rehab/",
  "https://www.ashleytreatment.org/",
  "https://www.ashleytreatment.org/treatment-programs/",
  "https://www.silvermistrecovery.com/",
  "https://www.silvermistrecovery.com/programs/",
  "https://www.marywoodtreatmentcenter.com/",
  "https://www.promises.com/",
  "https://www.promises.com/treatment-programs/",
  "https://www.sierratucson.com/",
  "https://www.sierratucson.com/treatment/",
  "https://www.meadows.com/",
  "https://www.meadows.com/treatment/",
  "https://www.elementsbehavioralhealth.com/",
];

let totalStats = {
  entitiesCreated: 0,
  entitiesUpdated: 0,
  assertionsCreated: 0,
  sourcesCreated: 0,
  pagesProcessed: 0,
  reviewItemsCreated: 0,
  succeeded: 0,
  failed: 0,
};

for (const url of urls) {
  try {
    console.log(`\n--- Processing: ${url} ---`);
    const stats = await ingestUrl(url);
    totalStats.entitiesCreated += stats.entitiesCreated;
    totalStats.entitiesUpdated += stats.entitiesUpdated;
    totalStats.assertionsCreated += stats.assertionsCreated;
    totalStats.sourcesCreated += stats.sourcesCreated;
    totalStats.pagesProcessed += stats.pagesProcessed;
    totalStats.succeeded++;
    console.log(`  ✓ Entities: ${stats.entitiesCreated}, Assertions: ${stats.assertionsCreated}`);
  } catch (error) {
    totalStats.failed++;
    console.log(`  ✗ Failed: ${error.message?.substring(0, 80)}`);
  }
}

console.log("\n========== BATCH COMPLETE ==========");
console.log(`Succeeded: ${totalStats.succeeded}/${urls.length}`);
console.log(`Failed: ${totalStats.failed}/${urls.length}`);
console.log(`Entities created: ${totalStats.entitiesCreated}`);
console.log(`Assertions created: ${totalStats.assertionsCreated}`);
console.log(`Sources created: ${totalStats.sourcesCreated}`);
console.log(`Pages processed: ${totalStats.pagesProcessed}`);

// Print final DB stats
import mysql from "mysql2/promise";
const c = await mysql.createConnection(process.env.DATABASE_URL);
const [orgs] = await c.query("SELECT COUNT(*) as cnt FROM organizations");
const [facs] = await c.query("SELECT COUNT(*) as cnt FROM facilities");
const [progs] = await c.query("SELECT COUNT(*) as cnt FROM programs");
const [tags] = await c.query("SELECT COUNT(*) as cnt FROM tags");
const [asserts] = await c.query("SELECT COUNT(*) as cnt FROM assertions");
console.log(`\nDB Totals: ${orgs[0].cnt} orgs, ${facs[0].cnt} facilities, ${progs[0].cnt} programs, ${tags[0].cnt} tags, ${asserts[0].cnt} assertions`);
await c.end();

process.exit(0);
