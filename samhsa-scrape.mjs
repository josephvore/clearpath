/**
 * SAMHSA Treatment Locator Scraper
 * Uses Puppeteer to scrape facility data from findtreatment.gov
 * by searching state-by-state and extracting facility details from rendered pages.
 */
import puppeteer from 'puppeteer';
import mysql from 'mysql2/promise';
import fs from 'fs';
import { invokeLLM } from './server/_core/llm.ts';

// ── DB connection ──
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  waitForConnections: true,
  connectionLimit: 5,
});

// ── Major US cities with coordinates for search ──
const SEARCH_LOCATIONS = [
  // Northeast
  { city: "Boston, MA", lat: 42.3601, lng: -71.0589 },
  { city: "Philadelphia, PA", lat: 39.9526, lng: -75.1652 },
  { city: "Pittsburgh, PA", lat: 40.4406, lng: -79.9959 },
  { city: "Hartford, CT", lat: 41.7658, lng: -72.6734 },
  { city: "Baltimore, MD", lat: 39.2904, lng: -76.6122 },
  { city: "Washington, DC", lat: 38.9072, lng: -77.0369 },
  // Southeast
  { city: "Atlanta, GA", lat: 33.7490, lng: -84.3880 },
  { city: "Miami, FL", lat: 25.7617, lng: -80.1918 },
  { city: "Tampa, FL", lat: 27.9506, lng: -82.4572 },
  { city: "Charlotte, NC", lat: 35.2271, lng: -80.8431 },
  { city: "Nashville, TN", lat: 36.1627, lng: -86.7816 },
  { city: "New Orleans, LA", lat: 29.9511, lng: -90.0715 },
  { city: "Richmond, VA", lat: 37.5407, lng: -77.4360 },
  // Midwest
  { city: "Chicago, IL", lat: 41.8781, lng: -87.6298 },
  { city: "Detroit, MI", lat: 42.3314, lng: -83.0458 },
  { city: "Minneapolis, MN", lat: 44.9778, lng: -93.2650 },
  { city: "Cleveland, OH", lat: 41.4993, lng: -81.6944 },
  { city: "Columbus, OH", lat: 39.9612, lng: -82.9988 },
  { city: "Indianapolis, IN", lat: 39.7684, lng: -86.1581 },
  { city: "Milwaukee, WI", lat: 43.0389, lng: -87.9065 },
  { city: "St. Louis, MO", lat: 38.6270, lng: -90.1994 },
  { city: "Kansas City, MO", lat: 39.0997, lng: -94.5786 },
  // Southwest
  { city: "Dallas, TX", lat: 32.7767, lng: -96.7970 },
  { city: "Houston, TX", lat: 29.7604, lng: -95.3698 },
  { city: "San Antonio, TX", lat: 29.4241, lng: -98.4936 },
  { city: "Austin, TX", lat: 30.2672, lng: -97.7431 },
  { city: "Phoenix, AZ", lat: 33.4484, lng: -112.0740 },
  { city: "Tucson, AZ", lat: 32.2226, lng: -110.9747 },
  { city: "Albuquerque, NM", lat: 35.0844, lng: -106.6504 },
  { city: "Oklahoma City, OK", lat: 35.4676, lng: -97.5164 },
  // West
  { city: "Los Angeles, CA", lat: 34.0522, lng: -118.2437 },
  { city: "San Francisco, CA", lat: 37.7749, lng: -122.4194 },
  { city: "San Diego, CA", lat: 32.7157, lng: -117.1611 },
  { city: "Sacramento, CA", lat: 38.5816, lng: -121.4944 },
  { city: "Seattle, WA", lat: 47.6062, lng: -122.3321 },
  { city: "Portland, OR", lat: 45.5152, lng: -122.6784 },
  { city: "Denver, CO", lat: 39.7392, lng: -104.9903 },
  { city: "Salt Lake City, UT", lat: 40.7608, lng: -111.8910 },
  { city: "Las Vegas, NV", lat: 36.1699, lng: -115.1398 },
  // Additional coverage
  { city: "Louisville, KY", lat: 38.2527, lng: -85.7585 },
  { city: "Memphis, TN", lat: 35.1495, lng: -90.0490 },
  { city: "Jacksonville, FL", lat: 30.3322, lng: -81.6557 },
  { city: "Raleigh, NC", lat: 35.7796, lng: -78.6382 },
  { city: "Birmingham, AL", lat: 33.5186, lng: -86.8104 },
  { city: "Omaha, NE", lat: 41.2565, lng: -95.9345 },
  { city: "Boise, ID", lat: 43.6150, lng: -116.2023 },
  { city: "Anchorage, AK", lat: 61.2181, lng: -149.9003 },
  { city: "Honolulu, HI", lat: 21.3069, lng: -157.8583 },
];

// ── Get existing facility names to avoid duplicates ──
async function getExistingFacilities() {
  const [rows] = await pool.query('SELECT name FROM facilities');
  return new Set(rows.map(r => r.name.toLowerCase().trim()));
}

async function getExistingOrgNames() {
  const [rows] = await pool.query('SELECT name FROM organizations');
  return new Set(rows.map(r => r.name.toLowerCase().trim()));
}

// ── Extract facility data from SAMHSA page using Puppeteer ──
async function scrapeSAMHSAForCity(browser, location, existingFacilities) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  const facilities = [];
  
  try {
    // Navigate to the locator
    await page.goto('https://findtreatment.gov/locator', { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    // Clear and type the city name
    await page.click('#sAddrInput', { clickCount: 3 });
    await page.type('#sAddrInput', location.city);
    await page.waitForTimeout(2000);
    
    // Select the first autocomplete suggestion
    try {
      await page.waitForSelector('.pac-item', { timeout: 5000 });
      await page.click('.pac-item');
      await page.waitForTimeout(1000);
    } catch {
      // If no autocomplete, just press enter
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }
    
    // Make sure Distance is checked and set to 50 miles for broader coverage
    const distanceCheckbox = await page.$('#inlineRadio3');
    if (distanceCheckbox) {
      const isChecked = await page.evaluate(el => el.checked, distanceCheckbox);
      if (!isChecked) {
        await distanceCheckbox.click();
        await page.waitForTimeout(500);
      }
    }
    
    // Click search
    const searchBtn = await page.$('button[class*="search-btn"], button:has-text("Search")');
    if (searchBtn) {
      await searchBtn.click();
    } else {
      // Try clicking by text
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
          if (btn.textContent.trim() === 'Search') {
            btn.click();
            break;
          }
        }
      });
    }
    
    await page.waitForTimeout(5000);
    
    // Extract facility data from the results
    const pageData = await page.evaluate(() => {
      const results = [];
      // Look for facility cards/rows in the results
      const facilityElements = document.querySelectorAll('.card-body, .facility-card, [class*="facility"], .locator-filterlisting tr, .locator-filterlisting .card');
      
      if (facilityElements.length === 0) {
        // Try alternative selectors
        const rows = document.querySelectorAll('.row.facility-row, .listing-row, [data-frid]');
        rows.forEach(row => {
          const name = row.querySelector('.facility-name, h3, h4, .fw-500, .fs-24px')?.textContent?.trim();
          const address = row.querySelector('.facility-address, .address')?.textContent?.trim();
          const phone = row.querySelector('a[href^="tel:"]')?.textContent?.trim();
          const website = row.querySelector('a[href^="http"]')?.getAttribute('href');
          const distance = row.querySelector('.distance, [class*="distance"]')?.textContent?.trim();
          if (name) results.push({ name, address, phone, website, distance });
        });
      }
      
      facilityElements.forEach(el => {
        const name = el.querySelector('.facility-name, h3, h4, .fw-500, .fs-24px, a[role="button"]')?.textContent?.trim();
        const addressParts = el.querySelectorAll('.address-line, .facility-address, p');
        const address = Array.from(addressParts).map(p => p.textContent.trim()).filter(Boolean).join(', ');
        const phone = el.querySelector('a[href^="tel:"]')?.textContent?.trim();
        const website = el.querySelector('a[href^="http"]:not([href*="google"])')?.getAttribute('href');
        const distance = el.querySelector('a[href*="google.com/maps"]')?.textContent?.trim();
        if (name && name.length > 3) results.push({ name, address, phone, website, distance });
      });
      
      // Get total record count
      const countText = document.body.innerText.match(/Showing (\d+) records/);
      const totalRecords = countText ? parseInt(countText[1]) : 0;
      
      return { results, totalRecords, html: document.body.innerText.substring(0, 5000) };
    });
    
    // If we got HTML but no structured results, try extracting from the raw text
    if (pageData.results.length === 0 && pageData.html.length > 100) {
      // Extract facility info from raw page text
      const text = pageData.html;
      const facilityPattern = /More Info\s*»\s*([\d\-\(\)]+)\s*([\d\.]+\s*miles)/g;
      let match;
      while ((match = facilityPattern.exec(text)) !== null) {
        // This is a rough extraction - we'll refine with LLM
      }
    }
    
    console.log(`  ${location.city}: Found ${pageData.results.length} facilities (${pageData.totalRecords} total)`);
    
    // Filter out duplicates
    for (const f of pageData.results) {
      if (f.name && !existingFacilities.has(f.name.toLowerCase().trim())) {
        facilities.push({
          ...f,
          city: location.city,
          searchLat: location.lat,
          searchLng: location.lng,
        });
      }
    }
    
  } catch (err) {
    console.error(`  Error scraping ${location.city}: ${err.message}`);
  } finally {
    await page.close();
  }
  
  return facilities;
}

// ── Alternative approach: Use the download/print page which lists all results ──
async function scrapeSAMHSADownloadPage(browser, location, existingFacilities) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  const facilities = [];
  
  try {
    await page.goto('https://findtreatment.gov/locator', { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    // Set up response interception to capture listing API responses
    const listingResponses = [];
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/locator/listing')) {
        try {
          const data = await response.json();
          listingResponses.push(data);
        } catch {}
      }
    });
    
    // Type city and search
    await page.click('#sAddrInput', { clickCount: 3 });
    await page.type('#sAddrInput', location.city);
    await page.waitForTimeout(2000);
    
    try {
      await page.waitForSelector('.pac-item', { timeout: 5000 });
      await page.click('.pac-item');
      await page.waitForTimeout(1000);
    } catch {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }
    
    // Click search
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.textContent.trim() === 'Search') {
          btn.click();
          break;
        }
      }
    });
    
    // Wait for results
    await page.waitForTimeout(8000);
    
    // Check if we captured any listing responses
    if (listingResponses.length > 0) {
      const data = listingResponses[0];
      if (data.rows && Array.isArray(data.rows)) {
        console.log(`  ${location.city}: Captured ${data.rows.length} facilities from API (${data.recordCount} total)`);
        for (const row of data.rows) {
          const name = (row.name1 + (row.name2 ? ' ' + row.name2 : '')).trim();
          if (name && !existingFacilities.has(name.toLowerCase())) {
            facilities.push({
              name,
              address: `${row.street1}${row.street2 ? ' ' + row.street2 : ''}, ${row.city}, ${row.state} ${row.zip}`,
              phone: row.phone,
              website: row.website,
              lat: row.latitude,
              lng: row.longitude,
              city: location.city,
              state: row.state,
              services: row.services || [],
              typeFacility: row.typeFacility,
              frid: row.frid,
            });
          }
        }
      }
    } else {
      console.log(`  ${location.city}: No API response captured, trying HTML extraction...`);
      // Fallback to HTML extraction
      const htmlData = await page.evaluate(() => {
        const text = document.body.innerText;
        const countMatch = text.match(/Showing (\d+) records/);
        return {
          totalRecords: countMatch ? parseInt(countMatch[1]) : 0,
          bodyText: text.substring(0, 10000),
        };
      });
      console.log(`  ${location.city}: ${htmlData.totalRecords} records found in HTML`);
    }
    
  } catch (err) {
    console.error(`  Error scraping ${location.city}: ${err.message}`);
  } finally {
    await page.close();
  }
  
  return facilities;
}

// ── Insert facilities into database ──
async function insertFacilities(facilities) {
  let inserted = 0;
  let skipped = 0;
  
  for (const f of facilities) {
    try {
      // Check if org exists, create if not
      const orgName = f.name.split(/[-–—]/)[0].trim() || f.name;
      let [orgRows] = await pool.query('SELECT id FROM organizations WHERE name = ?', [orgName]);
      let orgId;
      
      if (orgRows.length === 0) {
        const [result] = await pool.query(
          'INSERT INTO organizations (name, website, createdAt) VALUES (?, ?, NOW())',
          [orgName, f.website || null]
        );
        orgId = result.insertId;
      } else {
        orgId = orgRows[0].id;
      }
      
      // Check if facility already exists
      let [facRows] = await pool.query('SELECT id FROM facilities WHERE name = ?', [f.name]);
      let facilityId;
      
      if (facRows.length === 0) {
        // Parse address
        const addrParts = (f.address || '').split(',').map(s => s.trim());
        const state = f.state || (addrParts.length >= 3 ? addrParts[addrParts.length - 1].split(' ')[0] : null);
        const cityName = addrParts.length >= 2 ? addrParts[addrParts.length - 2] : null;
        
        const [result] = await pool.query(
          `INSERT INTO facilities (organizationId, name, addressLine1, city, state, phone, website, latitude, longitude, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [orgId, f.name, addrParts[0] || null, cityName, state, f.phone || null, f.website || null, f.lat || null, f.lng || null]
        );
        facilityId = result.insertId;
        inserted++;
      } else {
        facilityId = facRows[0].id;
        skipped++;
        continue;
      }
      
      // Create a program for this facility
      const [progResult] = await pool.query(
        `INSERT INTO programs (facilityId, name, description, programStatus, createdAt)
         VALUES (?, ?, ?, 'active', NOW())`,
        [facilityId, f.name + ' Treatment Program', `Treatment program at ${f.name} in ${f.address || f.city}`]
      );
      const programId = progResult.insertId;
      
      // Add basic tags based on facility type
      const tags = ['substance use treatment'];
      if (f.typeFacility === 'SA') tags.push('substance abuse');
      if (f.typeFacility === 'MH') tags.push('mental health');
      
      for (const tagName of tags) {
        let [tagRows] = await pool.query('SELECT id FROM tags WHERE name = ?', [tagName]);
        let tagId;
        if (tagRows.length === 0) {
          const [tr] = await pool.query('INSERT INTO tags (name, category, createdAt) VALUES (?, ?, NOW())', [tagName, 'condition']);
          tagId = tr.insertId;
        } else {
          tagId = tagRows[0].id;
        }
        await pool.query(
          'INSERT IGNORE INTO program_tags (programId, tagId) VALUES (?, ?)',
          [programId, tagId]
        ).catch(() => {});
      }
      
    } catch (err) {
      console.error(`  Error inserting ${f.name}: ${err.message}`);
    }
  }
  
  return { inserted, skipped };
}

// ── Main ──
async function main() {
  console.log('=== SAMHSA Treatment Locator Scraper ===');
  console.log(`Searching ${SEARCH_LOCATIONS.length} cities...`);
  
  const existingFacilities = await getExistingFacilities();
  console.log(`Existing facilities in DB: ${existingFacilities.size}`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  
  let allFacilities = [];
  let cityCount = 0;
  
  for (const location of SEARCH_LOCATIONS) {
    cityCount++;
    console.log(`\n[${cityCount}/${SEARCH_LOCATIONS.length}] Searching: ${location.city}`);
    
    try {
      const facilities = await scrapeSAMHSADownloadPage(browser, location, existingFacilities);
      allFacilities.push(...facilities);
      
      // Add newly found facilities to the existing set to avoid cross-city duplicates
      for (const f of facilities) {
        existingFacilities.add(f.name.toLowerCase());
      }
      
      console.log(`  New unique facilities: ${facilities.length} (Total so far: ${allFacilities.length})`);
    } catch (err) {
      console.error(`  Fatal error for ${location.city}: ${err.message}`);
    }
    
    // Small delay between cities
    await new Promise(r => setTimeout(r, 2000));
  }
  
  await browser.close();
  
  console.log(`\n=== Scraping Complete ===`);
  console.log(`Total new facilities found: ${allFacilities.length}`);
  
  // Save raw data to file for backup
  fs.writeFileSync('/tmp/samhsa_scraped.json', JSON.stringify(allFacilities, null, 2));
  console.log('Raw data saved to /tmp/samhsa_scraped.json');
  
  // Insert into database
  console.log('\nInserting into database...');
  const { inserted, skipped } = await insertFacilities(allFacilities);
  console.log(`Inserted: ${inserted}, Skipped (duplicate): ${skipped}`);
  
  // Final counts
  const [[{ cnt: totalOrgs }]] = await pool.query('SELECT COUNT(*) as cnt FROM organizations');
  const [[{ cnt: totalFac }]] = await pool.query('SELECT COUNT(*) as cnt FROM facilities');
  const [[{ cnt: totalProg }]] = await pool.query("SELECT COUNT(*) as cnt FROM programs WHERE programStatus = 'active'");
  
  console.log(`\n=== Final Database Counts ===`);
  console.log(`Organizations: ${totalOrgs}`);
  console.log(`Facilities: ${totalFac}`);
  console.log(`Active Programs: ${totalProg}`);
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
