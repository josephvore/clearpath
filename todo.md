# ClearPath - Treatment Program Discovery Platform TODO

- [x] Database schema: organizations, facilities, programs tables
- [x] Database schema: tags, program_tags tables
- [x] Database schema: sources, assertions (provenance) tables
- [x] Database schema: ingestion_jobs table for crawler queue
- [x] Database schema: user_needs_profiles table for guided matching
- [x] Database indexes for search performance
- [x] Run migrations (pnpm db:push)
- [x] Backend: DB query helpers for all entities
- [x] Backend: Search endpoint with filters and ranking
- [x] Backend: Program detail endpoint with citations
- [x] Backend: Match endpoint for guided finder
- [x] Backend: Admin ingest endpoint (seed URL)
- [x] Backend: Admin recrawl endpoint
- [x] Backend: Admin jobs list endpoint
- [x] Backend: Admin stale entities endpoint
- [x] Ingestion worker: URL fetcher with rate limiting and robots.txt
- [x] Ingestion worker: HTML to clean text extraction
- [x] Ingestion worker: LLM extraction pipeline with structured JSON
- [x] Ingestion worker: Entity resolution and deduplication
- [x] Ingestion worker: Write sources, assertions, program_tags
- [x] Frontend: Design system (colors, fonts, theme)
- [x] Frontend: Public navigation layout with crisis banner
- [x] Frontend: Home/Search page with search bar and filters
- [x] Frontend: Interactive map view with facility markers
- [x] Frontend: Search results list with program cards
- [x] Frontend: Program detail page with citations and confidence
- [x] Frontend: Guided finder flow with step-by-step questions
- [x] Frontend: Admin dashboard with sidebar navigation
- [x] Frontend: Admin - add seed URLs and manage ingestion
- [x] Frontend: Admin - review extracted data and job status
- [x] Frontend: Admin - stale entities management
- [x] Safety: Crisis disclaimer banner and 988 routing
- [x] Safety: "Not medical advice" disclaimers
- [x] Safety: Unknown/unverified labeling for low-confidence data
- [x] Write vitest tests for backend procedures
- [x] Rename all "EquipFlow" references to "ClearPath" in frontend
- [x] Rename all "equipflow" references to "clearpath" in config/package
- [x] Update VITE_APP_TITLE to ClearPath (user must update via Settings > General in Management UI)
- [x] Push code to josephvore/clearpath GitHub repo

## Data Engineering Overhaul (v2)

- [x] Schema: Add enriched facility fields (phone, website, insurance, specializations, substances, accreditations, etc.)
- [x] Schema: Add controlled vocabulary/taxonomy tables (canonical terms + synonyms)
- [x] Schema: Add per-field confidence scores and quality scoring columns
- [x] Schema: Add crawl_snapshots table for raw content versioning
- [x] Schema: Add field_changes changelog table
- [x] Schema: Add human_review_queue table
- [x] Schema: Expand programs table with duration, schedule, eligibility fields
- [x] Pipeline: Multi-source discovery (SAMHSA API, Google Places, directories)
- [x] Pipeline: Enhanced AI extraction with controlled vocabulary mapping
- [x] Pipeline: Validation rules (phone, URL, address, insurance normalization)
- [x] Pipeline: Per-field confidence scoring from AI extraction
- [x] Pipeline: Composite quality scoring (confidence + completeness + freshness + validation)
- [x] Pipeline: Tiered recrawl scheduling (weekly/monthly/quarterly)
- [x] Pipeline: Differential updates (only update changed fields)
- [x] Pipeline: Enhanced entity resolution with deterministic + probabilistic matching
- [x] Pipeline: Source priority hierarchy for canonicalization
- [x] API: Enriched search filters (insurance, specializations, substances, accreditations)
- [x] API: Quality metrics endpoint for admin dashboard
- [x] API: Human review queue endpoints (list, approve, reject, merge)
- [x] API: Field-level change history endpoint
- [x] Frontend: Display insurance, specializations, substances on program cards
- [x] Frontend: Display quality/confidence indicators on detail page
- [x] Frontend: Admin quality metrics dashboard with charts
- [x] Frontend: Admin human review queue interface
- [x] Frontend: Admin field change history view
- [x] Tests: Update vitest tests for new endpoints and schema (54 tests passing)

## Full Page Audit (v3)

- [x] Audit: Homepage - no errors
- [x] Audit: Search page - no errors
- [x] Audit: Program detail page - verified
- [x] Audit: Guided finder - all 5 steps work
- [x] Audit: Admin dashboard - all 6 tabs work
- [x] Fix: admin.qualityMetrics/admin.stats 500 error (Drizzle CASE expression GROUP BY mismatch)
- [x] Re-run tests after fixes (54/54 pass, 0 TS errors, 0 console errors, 0 network errors)

## Real Data Ingestion (v4)

- [x] Fix guided finder matching with progressive fallback strategy
- [x] Fix assertions/citations generation in ingestion pipeline
- [x] Geocode all facilities with missing lat/lng
- [x] Link orphaned programs to facilities
- [x] Clean up temporary ingestion scripts

- [x] Ingest real treatment provider websites via admin panel (77 programs, 5 orgs, 6 facilities)
- [x] Verify ingestion jobs complete successfully
- [x] Verify real programs appear in search results (list + map view)
- [x] Verify program detail pages display real data with citations
- [x] Verify admin dashboard shows real stats

## More Providers & Tag Enrichment (v5)

- [x] Ingest additional treatment providers (277 programs from 22 orgs, 24 facilities)
- [x] Find accessible treatment provider URLs (24 URLs successfully ingested)
- [x] Ingest SAMHSA-listed providers and directories
- [x] Ingest individual facility websites with rich program data
- [x] Run LLM-based tag enrichment pass on all existing programs (2,275 new tags)
- [x] Add specific condition tags (209/277 programs now have condition tags)
- [x] Add substance-specific tags (163/277 programs now have substance tags)
- [x] Add population tags (adults, adolescents, veterans, etc.)
- [x] Verify Guided Finder returns precise matches (24 results for Alcohol+Residential)
- [x] Verify search filters work with enriched tags
- [ ] Push updated code and data to GitHub
- [x] Geocode all 10 facilities missing coordinates
- [x] Link all 28 orphaned programs to facilities (0 remaining)
- [x] Compute quality scores for all 277 programs and 24 facilities
- [x] All 54 vitest tests passing
