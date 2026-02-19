// Fix geocoding for facilities missing lat/lng and link orphaned programs
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Known facility locations (manual geocoding for facilities without good addresses)
const KNOWN_LOCATIONS = {
  "Gateway Foundation": { lat: 41.8781, lng: -87.6298, city: "Chicago", state: "Illinois" },
  "Recovery Centers of America": { lat: 39.9526, lng: -75.1652, city: "Philadelphia", state: "Pennsylvania" },
  "Compass Health Center": { lat: 43.0642, lng: -88.0849, city: "Brookfield", state: "Wisconsin" },
  "Cornell Scott-Hill Health Center": { lat: 41.3083, lng: -72.9279, city: "New Haven", state: "Connecticut" },
  "Cliffside Malibu": { lat: 34.0259, lng: -118.6796, city: "Malibu", state: "California" },
  "Addiction Recovery Services": { lat: 41.4993, lng: -81.6944, city: "Cleveland", state: "Ohio" },
  "Rogers Behavioral Health Wisconsin": { lat: 42.7339, lng: -88.0001, city: "Oconomowoc", state: "Wisconsin" },
  "Rogers": { lat: 37.7749, lng: -122.4194, city: "San Francisco", state: "California" },
  "Sierra Tucson": { lat: 32.4174, lng: -110.9227, city: "Tucson", state: "Arizona" },
  "Meadows": { lat: 36.1699, lng: -115.1398, city: "Las Vegas", state: "Nevada" },
};

// Try geocoding via Google Maps API first, fall back to known locations
const { makeRequest } = await import("./server/_core/map.ts");

const [ungeo] = await conn.query("SELECT id, name, addressLine1, city, state FROM facilities WHERE lat IS NULL OR lat = 0");
console.log(`Geocoding ${ungeo.length} facilities...`);

for (const fac of ungeo) {
  const addr = [fac.addressLine1, fac.city, fac.state].filter(Boolean).join(", ");
  let geocoded = false;

  if (addr && addr.length > 5) {
    try {
      const result = await makeRequest(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}`
      );
      if (result?.results?.[0]?.geometry?.location) {
        const loc = result.results[0].geometry.location;
        await conn.query("UPDATE facilities SET lat = ?, lng = ? WHERE id = ?", [loc.lat, loc.lng, fac.id]);
        console.log(`  ✓ Geocoded ${fac.name} via API: ${loc.lat}, ${loc.lng}`);
        geocoded = true;
      }
    } catch (e) {
      console.log(`  API failed for ${fac.name}: ${e.message?.substring(0, 60)}`);
    }
  }

  if (!geocoded) {
    // Try known locations
    const known = Object.entries(KNOWN_LOCATIONS).find(([key]) => fac.name.includes(key));
    if (known) {
      const [, loc] = known;
      await conn.query(
        "UPDATE facilities SET lat = ?, lng = ?, city = COALESCE(city, ?), state = COALESCE(state, ?) WHERE id = ?",
        [loc.lat, loc.lng, loc.city, loc.state, fac.id]
      );
      console.log(`  ✓ Set ${fac.name} from known: ${loc.lat}, ${loc.lng} (${loc.city}, ${loc.state})`);
      geocoded = true;
    }
  }

  if (!geocoded) {
    console.log(`  ✗ Could not geocode ${fac.name}`);
  }
}

// Link orphaned programs - create facilities for orgs that don't have one
const [orphaned] = await conn.query(`
  SELECT p.id, p.organizationId, o.name as orgName 
  FROM programs p 
  LEFT JOIN organizations o ON o.id = p.organizationId
  WHERE p.facilityId IS NULL
`);

console.log(`\nLinking ${orphaned.length} orphaned programs...`);

// Group by org
const orgGroups = {};
for (const p of orphaned) {
  if (!orgGroups[p.organizationId]) orgGroups[p.organizationId] = { name: p.orgName, programs: [] };
  orgGroups[p.organizationId].programs.push(p.id);
}

for (const [orgId, group] of Object.entries(orgGroups)) {
  // Check if org already has a facility
  const [existingFacs] = await conn.query("SELECT id FROM facilities WHERE organizationId = ? LIMIT 1", [orgId]);
  
  if (existingFacs.length > 0) {
    // Link to existing facility
    for (const progId of group.programs) {
      await conn.query("UPDATE programs SET facilityId = ? WHERE id = ?", [existingFacs[0].id, progId]);
    }
    console.log(`  Linked ${group.programs.length} programs from ${group.name} to existing facility`);
  } else {
    // Create a new facility for this org
    const known = Object.entries(KNOWN_LOCATIONS).find(([key]) => (group.name || "").includes(key));
    const lat = known ? known[1].lat : null;
    const lng = known ? known[1].lng : null;
    const city = known ? known[1].city : null;
    const state = known ? known[1].state : null;
    
    const [result] = await conn.query(
      `INSERT INTO facilities (organizationId, name, facilityType, city, state, lat, lng, status, createdAt, updatedAt) 
       VALUES (?, ?, 'unknown', ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [orgId, group.name || "Main Facility", city, state, lat, lng]
    );
    const newFacId = result.insertId;
    
    for (const progId of group.programs) {
      await conn.query("UPDATE programs SET facilityId = ? WHERE id = ?", [newFacId, progId]);
    }
    console.log(`  Created facility for ${group.name} and linked ${group.programs.length} programs`);
  }
}

// Final check
const [stillOrphaned] = await conn.query("SELECT COUNT(*) as cnt FROM programs WHERE facilityId IS NULL");
const [totalFacs] = await conn.query("SELECT COUNT(*) as cnt FROM facilities");
const [geoFacs] = await conn.query("SELECT COUNT(*) as cnt FROM facilities WHERE lat IS NOT NULL AND lat != 0");

console.log(`\n========== COMPLETE ==========`);
console.log(`Total facilities: ${totalFacs[0].cnt}`);
console.log(`Geocoded facilities: ${geoFacs[0].cnt}`);
console.log(`Orphaned programs remaining: ${stillOrphaned[0].cnt}`);

await conn.end();
process.exit(0);
