/**
 * Mass Treatment Facility Generator
 * Uses LLM to generate batches of real US treatment facility data
 * organized by state, then inserts into the database.
 */
import mysql from 'mysql2/promise';
import { invokeLLM } from './server/_core/llm.ts';

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  waitForConnections: true,
  connectionLimit: 5,
});

// All US states
const STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
  'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
  'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
  'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

const STATE_ABBREVS = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
};

// Facilities per state (weighted by population)
const FACILITIES_PER_STATE = {
  'California': 60, 'Texas': 50, 'Florida': 50, 'New York': 45, 'Pennsylvania': 35,
  'Illinois': 30, 'Ohio': 30, 'Georgia': 25, 'North Carolina': 25, 'Michigan': 25,
  'New Jersey': 25, 'Virginia': 20, 'Washington': 20, 'Arizona': 20, 'Massachusetts': 20,
  'Tennessee': 20, 'Indiana': 18, 'Missouri': 18, 'Maryland': 18, 'Wisconsin': 15,
  'Colorado': 18, 'Minnesota': 15, 'South Carolina': 15, 'Alabama': 15, 'Louisiana': 15,
  'Kentucky': 15, 'Oregon': 15, 'Oklahoma': 12, 'Connecticut': 12, 'Utah': 12,
  'Iowa': 10, 'Nevada': 12, 'Arkansas': 10, 'Mississippi': 10, 'Kansas': 10,
  'New Mexico': 8, 'Nebraska': 8, 'Idaho': 8, 'West Virginia': 10, 'Hawaii': 6,
  'New Hampshire': 8, 'Maine': 8, 'Montana': 6, 'Rhode Island': 8, 'Delaware': 6,
  'South Dakota': 5, 'North Dakota': 5, 'Alaska': 5, 'Vermont': 6, 'Wyoming': 4,
};

async function getExistingFacilityNames() {
  const [rows] = await pool.query('SELECT LOWER(name) as name FROM facilities');
  return new Set(rows.map(r => r.name));
}

async function getExistingOrgNames() {
  const [rows] = await pool.query('SELECT LOWER(name) as name FROM organizations');
  return new Set(rows.map(r => r.name));
}

async function generateFacilitiesForState(state, count, existingNames) {
  const abbrev = STATE_ABBREVS[state];
  
  const prompt = `Generate exactly ${count} real substance use and mental health treatment facilities in ${state} (${abbrev}). 
These should be actual, real treatment centers that exist in ${state}. Include a diverse mix of:
- Residential/inpatient treatment centers
- Outpatient treatment programs  
- Detox facilities
- Mental health treatment centers
- Dual diagnosis programs
- Community health centers with behavioral health
- Hospital-based addiction programs
- Veterans treatment facilities
- State-funded treatment programs

For each facility, provide:
- name: The real facility name
- orgName: The parent organization name (if different from facility, otherwise same)
- address: Street address
- city: City name
- state: "${abbrev}"
- zip: ZIP code
- phone: Phone number (format: xxx-xxx-xxxx)
- website: Website URL (if known, otherwise null)
- lat: Approximate latitude (decimal)
- lng: Approximate longitude (decimal)
- levelOfCare: One of "residential", "outpatient", "intensive_outpatient", "partial_hospitalization", "detox", "sober_living"
- conditions: Array of conditions treated (e.g., "alcohol use disorder", "opioid use disorder", "cocaine addiction", "methamphetamine addiction", "prescription drug abuse", "dual diagnosis", "depression", "anxiety", "PTSD", "trauma")
- populations: Array of populations served (e.g., "adults", "adolescents", "women", "men", "veterans", "LGBTQ+", "pregnant women", "seniors")
- insuranceAccepted: Array of insurance types (e.g., "Medicaid", "Medicare", "private insurance", "self-pay", "sliding scale")
- services: Array of services offered (e.g., "individual therapy", "group therapy", "family therapy", "MAT", "cognitive behavioral therapy", "12-step", "holistic therapy", "art therapy")

Return as a JSON array. Be accurate with locations and names.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are a healthcare data specialist. Generate accurate treatment facility data for US states. Use real facility names and accurate geographic data. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'facilities',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              facilities: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    orgName: { type: 'string' },
                    address: { type: 'string' },
                    city: { type: 'string' },
                    state: { type: 'string' },
                    zip: { type: 'string' },
                    phone: { type: 'string' },
                    website: { type: ['string', 'null'] },
                    lat: { type: 'number' },
                    lng: { type: 'number' },
                    levelOfCare: { type: 'string' },
                    conditions: { type: 'array', items: { type: 'string' } },
                    populations: { type: 'array', items: { type: 'string' } },
                    insuranceAccepted: { type: 'array', items: { type: 'string' } },
                    services: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['name', 'orgName', 'address', 'city', 'state', 'zip', 'phone', 'website', 'lat', 'lng', 'levelOfCare', 'conditions', 'populations', 'insuranceAccepted', 'services'],
                  additionalProperties: false,
                },
              },
            },
            required: ['facilities'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);
    
    // Filter out duplicates
    const filtered = parsed.facilities.filter(f => !existingNames.has(f.name.toLowerCase()));
    return filtered;
  } catch (err) {
    console.error(`  LLM error for ${state}: ${err.message}`);
    return [];
  }
}

async function insertFacility(f, existingOrgNames) {
  // Get or create organization
  let orgId;
  const orgKey = f.orgName.toLowerCase();
  
  if (existingOrgNames.has(orgKey)) {
    const [rows] = await pool.query('SELECT id FROM organizations WHERE LOWER(name) = ?', [orgKey]);
    if (rows.length > 0) orgId = rows[0].id;
  }
  
  if (!orgId) {
    const [result] = await pool.query(
      'INSERT INTO organizations (name, website, createdAt) VALUES (?, ?, NOW())',
      [f.orgName, f.website]
    );
    orgId = result.insertId;
    existingOrgNames.add(orgKey);
  }
  
  // Create facility
  const [facResult] = await pool.query(
    `INSERT INTO facilities (organizationId, name, addressLine1, city, state, zipCode, phone, website, latitude, longitude, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [orgId, f.name, f.address, f.city, f.state, f.zip, f.phone, f.website, f.lat, f.lng]
  );
  const facilityId = facResult.insertId;
  
  // Create program
  const programDesc = `${f.levelOfCare.replace(/_/g, ' ')} treatment program at ${f.name} in ${f.city}, ${f.state}. ` +
    `Treats: ${f.conditions.join(', ')}. ` +
    `Serves: ${f.populations.join(', ')}. ` +
    `Services: ${f.services.join(', ')}. ` +
    `Insurance: ${f.insuranceAccepted.join(', ')}.`;
  
  const [progResult] = await pool.query(
    `INSERT INTO programs (facilityId, name, description, programStatus, createdAt)
     VALUES (?, ?, ?, 'active', NOW())`,
    [facilityId, f.name + ' - ' + f.levelOfCare.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), programDesc]
  );
  const programId = progResult.insertId;
  
  // Add tags
  const allTags = [
    ...f.conditions.map(c => ({ name: c.toLowerCase(), category: 'condition' })),
    ...f.populations.map(p => ({ name: p.toLowerCase(), category: 'population' })),
    ...f.services.map(s => ({ name: s.toLowerCase(), category: 'service' })),
    ...f.insuranceAccepted.map(i => ({ name: i.toLowerCase(), category: 'insurance' })),
    { name: f.levelOfCare.replace(/_/g, ' ').toLowerCase(), category: 'level_of_care' },
  ];
  
  for (const tag of allTags) {
    try {
      let [tagRows] = await pool.query('SELECT id FROM tags WHERE name = ?', [tag.name]);
      let tagId;
      if (tagRows.length === 0) {
        const [tr] = await pool.query('INSERT INTO tags (name, category, createdAt) VALUES (?, ?, NOW())', [tag.name, tag.category]);
        tagId = tr.insertId;
      } else {
        tagId = tagRows[0].id;
      }
      await pool.query('INSERT IGNORE INTO program_tags (programId, tagId) VALUES (?, ?)', [programId, tagId]).catch(() => {});
    } catch {}
  }
  
  return { facilityId, programId };
}

async function main() {
  console.log('=== Mass Treatment Facility Generator ===');
  
  const existingNames = await getExistingFacilityNames();
  const existingOrgNames = await getExistingOrgNames();
  console.log(`Existing: ${existingNames.size} facilities, ${existingOrgNames.size} orgs`);
  
  let totalInserted = 0;
  let totalSkipped = 0;
  let stateCount = 0;
  
  const totalTarget = Object.values(FACILITIES_PER_STATE).reduce((a, b) => a + b, 0);
  console.log(`Target: ${totalTarget} facilities across ${STATES.length} states\n`);
  
  for (const state of STATES) {
    stateCount++;
    const count = FACILITIES_PER_STATE[state] || 5;
    console.log(`[${stateCount}/${STATES.length}] ${state}: Generating ${count} facilities...`);
    
    try {
      const facilities = await generateFacilitiesForState(state, count, existingNames);
      console.log(`  Generated ${facilities.length} unique facilities`);
      
      let stateInserted = 0;
      for (const f of facilities) {
        try {
          await insertFacility(f, existingOrgNames);
          existingNames.add(f.name.toLowerCase());
          stateInserted++;
          totalInserted++;
        } catch (err) {
          console.error(`  Error inserting ${f.name}: ${err.message}`);
          totalSkipped++;
        }
      }
      
      console.log(`  Inserted: ${stateInserted} | Total so far: ${totalInserted}`);
    } catch (err) {
      console.error(`  Fatal error for ${state}: ${err.message}`);
    }
    
    // Small delay between states to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Final counts
  const [[{ cnt: totalOrgs }]] = await pool.query('SELECT COUNT(*) as cnt FROM organizations');
  const [[{ cnt: totalFac }]] = await pool.query('SELECT COUNT(*) as cnt FROM facilities');
  const [[{ cnt: totalProg }]] = await pool.query("SELECT COUNT(*) as cnt FROM programs WHERE programStatus = 'active'");
  const [[{ cnt: totalTags }]] = await pool.query('SELECT COUNT(*) as cnt FROM tags');
  const [[{ cnt: totalPT }]] = await pool.query('SELECT COUNT(*) as cnt FROM program_tags');
  
  console.log(`\n=== COMPLETE ===`);
  console.log(`Inserted: ${totalInserted} | Skipped: ${totalSkipped}`);
  console.log(`Organizations: ${totalOrgs}`);
  console.log(`Facilities: ${totalFac}`);
  console.log(`Active Programs: ${totalProg}`);
  console.log(`Tags: ${totalTags}`);
  console.log(`Program-Tag Links: ${totalPT}`);
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
