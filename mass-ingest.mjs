// Mass ingestion script - ingest a large number of treatment providers
// Targeting 80+ URLs from 40+ new organizations

import { ingestUrl } from "./server/ingestion.ts";

const urls = [
  // ===== LARGE NATIONAL PROVIDERS =====
  "https://americanaddictioncenters.org/treatment",
  "https://americanaddictioncenters.org/rehab-guide/residential",
  "https://americanaddictioncenters.org/rehab-guide/outpatient-treatment",
  "https://www.acadia-healthcare.com/treatment-services/",
  "https://www.acadiahealthcare.com/facilities/",
  "https://www.sunrisehouse.com/addiction-treatment-programs/",
  "https://www.sunrisehouse.com/",
  "https://www.promises.com/treatment-programs/",
  "https://www.promises.com/",
  "https://www.elementsbehavioralhealth.com/",
  "https://www.therecoveryvillage.com/treatment-programs/",
  "https://www.therecoveryvillage.com/treatment-programs/inpatient-rehab/",
  "https://www.therecoveryvillage.com/treatment-programs/outpatient-rehab/",
  "https://www.centerstone.org/services/substance-use/",
  "https://www.centerstone.org/services/mental-health/",
  "https://www.sheppardpratt.org/care-services/residential-structured-day-services/",
  "https://www.sheppardpratt.org/care-services/",
  
  // ===== LUXURY / SPECIALTY REHABS =====
  "https://www.thebluffs.com/programs/",
  "https://www.thebluffs.com/",
  "https://www.cottonwoodtucson.com/programs/",
  "https://www.cottonwoodtucson.com/",
  "https://www.pasadenacenter.com/programs/",
  "https://www.pasadenacenter.com/",
  "https://www.menningerclinic.org/patient-care",
  "https://www.menningerclinic.org/patient-care/treatment-programs",
  "https://www.mcleanhospital.org/treatment",
  "https://www.mcleanhospital.org/treatment/substance-use-disorders",
  "https://www.rosecrance.org/treatment/",
  "https://www.rosecrance.org/",
  "https://www.crchealth.com/treatment-programs/",
  "https://www.crchealth.com/",
  
  // ===== HOSPITAL-BASED PROGRAMS =====
  "https://www.upmc.com/services/behavioral-health/programs/addiction",
  "https://www.upmc.com/services/behavioral-health",
  "https://www.hopkinsmedicine.org/substance-abuse-center/treatment",
  "https://www.hopkinsmedicine.org/psychiatry/specialty-areas/substance-use-disorders",
  "https://www.mayoclinic.org/departments-centers/psychiatry-psychology/sections/addiction-services",
  "https://www.clevelandclinic.org/departments/psychiatry-psychology/alcohol-drug-recovery-center",
  "https://www.massgeneral.org/psychiatry/treatments-and-services/addiction-recovery-management-service",
  "https://www.mountsinai.org/care/addiction",
  "https://www.pennmedicine.org/for-patients-and-visitors/find-a-program-or-service/behavioral-health/addiction-services",
  "https://rfrancismedical.com/behavioral-health/",
  
  // ===== REGIONAL TREATMENT CENTERS =====
  "https://www.brightviewhealth.com/services",
  "https://www.brightviewhealth.com/",
  "https://www.marywoodtreatmentcenter.com/",
  "https://www.marywoodtreatmentcenter.com/programs/",
  "https://www.crestviewrecovery.com/programs/",
  "https://www.crestviewrecovery.com/",
  "https://www.banyantreatmentcenter.com/programs/",
  "https://www.banyantreatmentcenter.com/",
  "https://www.pyramidhealthcarepa.com/treatment-programs/",
  "https://www.pyramidhealthcarepa.com/",
  "https://www.sandstonecare.com/programs/",
  "https://www.sandstonecare.com/",
  "https://www.foundationsrecoverynetwork.com/programs/",
  "https://www.foundationsrecoverynetwork.com/",
  "https://www.laguna-treatment.com/programs/",
  "https://www.laguna-treatment.com/",
  "https://www.turnbridge.com/programs/",
  "https://www.turnbridge.com/",
  "https://www.blueprintrecovery.com/programs/",
  "https://www.blueprintrecovery.com/",
  "https://www.newportacademy.com/programs/",
  "https://www.newportacademy.com/",
  "https://www.odysseyhousepa.org/programs/",
  "https://www.odysseyhousepa.org/",
  "https://www.kolmac.com/treatment-programs/",
  "https://www.kolmac.com/",
  
  // ===== FAITH-BASED / NONPROFIT =====
  "https://www.salvationarmyusa.org/usn/adult-rehabilitation-centers/",
  "https://www.teenchallenge.org/programs/",
  "https://www.teenchallenge.org/",
  "https://www.oxfordhouse.org/",
  
  // ===== WOMEN / FAMILY SPECIALTY =====
  "https://www.newdirectionsforwomen.org/programs/",
  "https://www.orchidrecoverycenter.com/programs/",
  "https://www.orchidrecoverycenter.com/",
  "https://www.thewatershed.com/programs/",
  "https://www.thewatershed.com/",
  
  // ===== VETERANS / MILITARY =====
  "https://www.va.gov/health-care/health-needs-conditions/substance-use-problems/",
  
  // ===== ADOLESCENT / YOUNG ADULT =====
  "https://www.paradigmtreatment.com/programs/",
  "https://www.paradigmtreatment.com/",
  "https://www.venturarecoverycenter.com/programs/",
  "https://www.venturarecoverycenter.com/",
  
  // ===== DETOX SPECIALTY =====
  "https://www.riveroaksrecovery.com/programs/",
  "https://www.riveroaksrecovery.com/",
  "https://www.rehabcenter.net/treatment-programs/",
  
  // ===== TELEHEALTH / MODERN =====
  "https://www.workit.health/",
  "https://www.bicyclehealth.com/",
  "https://www.ophelia.com/",
  
  // ===== ADDITIONAL DIVERSE PROVIDERS =====
  "https://www.caron.org/our-programs/addiction-treatment",
  "https://www.caron.org/our-programs/mental-health",
  "https://www.hazeldenbettyford.org/treatment/programs",
  "https://www.hazeldenbettyford.org/treatment/programs/young-adults",
  "https://www.palmerlakerecovery.com/programs/residential-treatment/",
  "https://www.palmerlakerecovery.com/programs/detox/",
  "https://www.gatehousetreatment.com/programs/",
  "https://www.gatehousetreatment.com/",
  "https://www.whitedeerrun.com/treatment-programs/",
  "https://www.whitedeerrun.com/",
  "https://www.clearbrooktreatment.com/programs/",
  "https://www.clearbrooktreatment.com/",
  "https://www.fherehab.com/treatment-programs/",
  "https://www.fherehab.com/",
  "https://www.soba.com/treatment-programs/",
  "https://www.soba.com/",
  "https://www.windwardway.com/programs/",
  "https://www.windwardway.com/",
  "https://www.paxmemphis.com/programs/",
  "https://www.paxmemphis.com/",
  "https://www.journeypure.com/treatment-programs/",
  "https://www.journeypure.com/",
  "https://www.recoveryunplugged.com/programs/",
  "https://www.recoveryunplugged.com/",
  "https://www.springboardrecovery.com/programs/",
  "https://www.springboardrecovery.com/",
  "https://www.pinnacletreatment.com/treatment-programs/",
  "https://www.pinnacletreatment.com/",
  "https://www.delphi.com/treatment-programs/",
  "https://www.delphihealthgroup.com/",
  "https://www.northpointrecovery.com/programs/",
  "https://www.northpointrecovery.com/",
];

// Remove already-ingested URLs
const alreadyIngested = new Set([
  "https://buckheadbh.com/",
  "https://buckheadbh.com/programs/",
  "https://compasshealthcenter.net/",
  "https://compasshealthcenter.net/what-is-php-iop/",
  "https://recoverycentersofamerica.com/",
  "https://recoverycentersofamerica.com/treatment/",
  "https://rogersbh.org/treatment-programs/",
  "https://rogersbh.org/treatment-programs/residential-treatment/",
  "https://sevencounties.org/substance-use/addiction-recovery-getting-started/",
  "https://talbottcampus.com/",
  "https://www.ashleytreatment.org/",
  "https://www.caron.org/our-programs",
  "https://www.cliffsidemalibu.com/",
  "https://www.cliffsidemalibu.com/treatment-programs/",
  "https://www.cornellscott.org/programs-and-services/addiction-treatment",
  "https://www.crestwoodbehavioralhealth.com/location/san-francisco",
  "https://www.discoverynj.org/",
  "https://www.discoverynj.org/programs/",
  "https://www.gatewayfoundation.org/",
  "https://www.hazeldenbettyford.org/locations/center-city",
  "https://www.hazeldenbettyford.org/locations/rancho-mirage",
  "https://www.hazeldenbettyford.org/treatment/models",
  "https://www.lorettohospital.org/our-services/behavioral-health-services/substance-use/",
  "https://www.meadows.com/",
  "https://www.newdirectionsforwomen.org/programs/",
  "https://www.palmerlakerecovery.com/programs/",
  "https://www.rehabcenter.net/treatment-programs/",
  "https://www.sierratucson.com/",
  "https://www.sierratucson.com/treatment/",
  "https://www.silvermistrecovery.com/",
  "https://www.uhhospitals.org/services/addiction-services/addiction-recovery",
]);

const newUrls = urls.filter(u => !alreadyIngested.has(u));
console.log(`Total URLs: ${urls.length}, New (not yet ingested): ${newUrls.length}`);

let totalStats = {
  entitiesCreated: 0,
  entitiesUpdated: 0,
  assertionsCreated: 0,
  sourcesCreated: 0,
  pagesProcessed: 0,
  succeeded: 0,
  failed: 0,
  failedUrls: [],
};

// Process in batches of 5 with delays between batches
const BATCH_SIZE = 5;
for (let i = 0; i < newUrls.length; i += BATCH_SIZE) {
  const batch = newUrls.slice(i, i + BATCH_SIZE);
  console.log(`\n===== Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(newUrls.length/BATCH_SIZE)} =====`);
  
  for (const url of batch) {
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
      totalStats.failedUrls.push(url);
      console.log(`  ✗ Failed: ${error.message?.substring(0, 100)}`);
    }
  }
  
  // Brief pause between batches
  if (i + BATCH_SIZE < newUrls.length) {
    console.log("  [Pausing 2s between batches...]");
    await new Promise(r => setTimeout(r, 2000));
  }
}

console.log("\n========== MASS INGESTION COMPLETE ==========");
console.log(`Succeeded: ${totalStats.succeeded}/${newUrls.length}`);
console.log(`Failed: ${totalStats.failed}/${newUrls.length}`);
console.log(`Entities created: ${totalStats.entitiesCreated}`);
console.log(`Assertions created: ${totalStats.assertionsCreated}`);
console.log(`Sources created: ${totalStats.sourcesCreated}`);
console.log(`Pages processed: ${totalStats.pagesProcessed}`);
if (totalStats.failedUrls.length > 0) {
  console.log(`\nFailed URLs:`);
  for (const u of totalStats.failedUrls) console.log(`  - ${u}`);
}

// Print final DB stats
import mysql from "mysql2/promise";
const c = await mysql.createConnection(process.env.DATABASE_URL);
const [orgs] = await c.query("SELECT COUNT(*) as cnt FROM organizations");
const [facs] = await c.query("SELECT COUNT(*) as cnt FROM facilities");
const [progs] = await c.query("SELECT COUNT(*) as cnt FROM programs");
const [tags] = await c.query("SELECT COUNT(*) as cnt FROM tags");
const [asserts] = await c.query("SELECT COUNT(*) as cnt FROM assertions");
const [pt] = await c.query("SELECT COUNT(*) as cnt FROM program_tags");
console.log(`\nDB Totals: ${orgs[0].cnt} orgs, ${facs[0].cnt} facilities, ${progs[0].cnt} programs, ${tags[0].cnt} tags, ${asserts[0].cnt} assertions, ${pt[0].cnt} program_tags`);
await c.end();

process.exit(0);
