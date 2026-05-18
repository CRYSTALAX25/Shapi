// Industry briefs — the single source of truth for what makes a world-class CV
// in each sector. Used by both the deep-dive question generator AND the CV writer
// so questions and the resulting CV are anchored to the same rubric.
//
// Each brief is structured for Claude consumption: dense bullets, specific examples,
// the vocabulary recruiters actually use, and the metrics that get attention.
//
// Whitelist of 10 industries must match: cv-parse route, deepdive route INDUSTRY_META,
// cv-ready page INDUSTRY_META, webhook detectIndustry().

export const SUPPORTED_INDUSTRIES = [
  'finance', 'tech', 'creative', 'healthcare', 'legal',
  'marketing', 'operations', 'hospitality', 'education', 'sales',
] as const

export type Industry = typeof SUPPORTED_INDUSTRIES[number]

export const INDUSTRY_BRIEFS: Record<Industry, string> = {
  finance: `FINANCE — what an exceptional CV looks like:

SUB-SEGMENT MATTERS (anchor every story to this):
- Investment banking (IBD, M&A, ECM, DCM, leveraged finance, restructuring)
- Buy-side: PE, VC, hedge fund, asset management, family office
- Sell-side: equity research, fixed income, sales & trading
- Corporate finance / FP&A / treasury / IR
- Accounting & audit (Big 4 vs mid-tier vs in-house)
- Risk, compliance, regulatory (CFO office, Basel/MiFID/SOX)
- Fintech (payments, lending, wealth, crypto)

NUMBERS RECRUITERS WANT (every role needs at least 3):
- AUM, fund size, deal size, transaction value, EBITDA managed, P&L responsibility
- IRR, MOIC, MoM, gross/net returns, alpha generated
- Headcount managed, jurisdictions covered, asset classes
- Cost savings, revenue uplift, efficiency gains
- Audit scope (entities audited, revenue audited)
- Exam pass rates (CFA Level 1/2/3, ACCA papers, CPA)

HIDDEN GOLDMINES (candidates ALWAYS forget):
- Specific deal stories with named buyers/sellers (where confidentiality allows)
- Live mandates vs pitch wins
- Cross-border / multi-jurisdictional experience
- Stress-tested through 2008/2020 — survival is a credential
- Mentored juniors, ran training, contributed to firm-wide initiatives
- Industry sector specialism (TMT, healthcare, energy, real estate, FIG)
- Languages — directly hireable in regional roles (Arabic, Mandarin, French)

VOCABULARY OF EXPERTISE (signals deep knowledge):
- "Lead-left" vs "joint", "buy-side" vs "sell-side"
- "Greenshoe", "indicative range", "book-build", "covered call"
- "Carried interest", "GP/LP economics", "vintage", "MOIC vs IRR trade-off"
- "Run-rate EBITDA", "synergies", "DCF vs multiples", "trading comps vs precedents"
- "Capital adequacy", "Tier 1 ratio", "RWA optimisation"

RED FLAGS / COMMON MISTAKES:
- "Managed budgets" without size = invisible
- Listing software (Bloomberg, Excel) without context of use
- No deal names or deal sizes for client-facing roles
- Vague titles ("Analyst") without context (which group, what AUM)
- Missing certifications status (CFA Level 2 candidate is still credible)

EXEMPLARY ACHIEVEMENT (this is the bar):
"Lead analyst on $1.2B carve-out sale of [Subsidiary] from [Parent] to KKR — built operating model, ran management presentations, negotiated transition services agreement. Closed 4 weeks ahead of LOI deadline at 9.2x EBITDA, 18% above seller's reservation price."`,

  tech: `TECHNOLOGY — what an exceptional CV looks like:

SUB-SEGMENT MATTERS (engineers in different verticals get hired differently):
- Frontend (React/Vue/Svelte, design systems, accessibility, performance)
- Backend (services, APIs, data layer, scalability, distributed systems)
- Full-stack (own end-to-end features, ship to prod)
- Mobile (iOS native, Android native, React Native, Flutter)
- Data (analytics engineer, data scientist, ML engineer, data infra)
- ML/AI (research vs applied, LLMs vs computer vision vs RL)
- Infrastructure / DevOps / SRE / Platform
- Security (offensive, defensive, AppSec, infra)
- Embedded / firmware / hardware
- Engineering management vs Staff/Principal IC track

NUMBERS RECRUITERS WANT (concrete scale matters more than tech jargon):
- Users / DAU / MAU served, requests/second, throughput
- Latency (p50/p95/p99 in ms), uptime % (count the nines)
- Data volume processed, model accuracy/F1/AUC, inference latency
- Deployment frequency, MTTR, change failure rate, lead time
- Cost: AWS spend reduced by X%, capacity efficiency
- Team size led, sprints/quarters owned, eng org reach

HIDDEN GOLDMINES (always forgotten):
- Open-source contributions (PRs merged into known repos > "wrote some OSS")
- Conference talks, blog posts read by industry
- Patents, papers, citations
- Production incidents debugged at 3am — character + skill signal
- Hiring + interviewing — many engineers underplay this
- Internal tools / dev productivity — "saved my team 8 hours/week" is gold
- 0→1 launches vs growth-stage work — different muscles, name which

VOCABULARY OF EXPERTISE:
- "Shipped" (not "worked on"), "owned end-to-end" (not "contributed to")
- "From 0 to 1", "spec to GA", "design partner to scale"
- "On-call rotation", "incident commander", "blameless postmortems"
- "Tech-lead on", "code-owner for", "DRI for"
- Specific things: "Built the auth service in Go with Redis-backed sessions handling 14k RPS"

RED FLAGS / COMMON MISTAKES:
- Listing technologies without context ("React, Node, Postgres, Docker, Kubernetes...")
- No numbers (just "improved performance")
- Job-hopping pattern unexplained
- All "team" achievements with no individual contribution clarity
- Missing GitHub / portfolio link

EXEMPLARY ACHIEVEMENT:
"Tech-lead on payments platform rebuild — migrated 14 services from monolith to event-driven architecture over 9 months. Cut p99 latency from 380ms to 47ms at 12x peak load. Zero customer-impacting incidents during cutover. Led 4 engineers, mentored 2 to senior."`,

  creative: `CREATIVE — what an exceptional CV looks like:

SUB-SEGMENT MATTERS (creative is a vast field):
- Art direction (advertising, editorial, in-house brand, agency)
- Copywriting (long-form, scripts, taglines, B2B, B2C)
- Design: graphic, brand identity, UX/UI, motion, 3D, illustration, packaging, environmental
- Content production (photo, video, audio, livestream)
- Creative direction (briefing teams, owning brand voice, multi-discipline)
- Influencer / social-first creative
- Game / immersive / XR / spatial design

NUMBERS THAT MATTER (creative people often hide these):
- Campaign reach, impressions, engagement rate (vs category avg)
- Brand uplift studies, salience scores, awareness lift
- Awards: Cannes Lions, D&AD, One Show, Webby — list shortlists too
- Production budgets owned, team size led
- Conversion impact (when measurable — landing pages, e-comm, fundraising)
- Pieces produced per month / quarter (high-volume creative)

HIDDEN GOLDMINES:
- PORTFOLIO LINK — non-negotiable, must be first thing on CV after name
- Named brands you've worked on (Nike, BBC, Audi) — specificity = credibility
- Awards SHORTLISTS — not just wins (industry knows shortlists are hard)
- Press coverage of your work (Creative Review, AdAge, Fast Company)
- Cross-discipline range: "directed video shoot + designed key visuals + wrote launch copy"
- Speaking at OFFF, FITC, Brand New Conf, AIGA
- Side projects, zines, exhibitions, books

VOCABULARY OF EXPERTISE:
- "Concept-to-execution", "ideated and shipped", "creative lead on"
- "Briefed against" (not "made a thing")
- "Owned the brand voice for", "evolved the visual system"
- "Pitched and won [budget] account"

RED FLAGS / COMMON MISTAKES:
- No portfolio link = CV gets binned in 3 seconds
- Listing software (Photoshop, Figma) without showing output
- "Worked on Nike campaign" without role or specifics
- No awards or shortlists for senior roles
- Generic personal brand — feels interchangeable with other CVs

EXEMPLARY ACHIEVEMENT:
"Creative Director on Nike 'Move' EMEA campaign — concepted and shipped across film, OOH, social, in-store. Cannes Lions Bronze (Brand Experience). 280M impressions, 4.1% engagement vs 1.2% category avg. Led team of 7 across 3 markets, briefed and bought 4 production companies."`,

  healthcare: `HEALTHCARE — what an exceptional CV looks like:

SUB-SEGMENT MATTERS (very different hiring criteria):
- Clinical: doctor (consultant/specialist/GP/junior), nurse (band/grade), midwife, allied health (physio, OT, SLT, pharmacist, radiographer)
- Specialty: cardiology, oncology, paediatrics, ED, ICU, surgery (sub-spec matters)
- Administrative: hospital admin, clinical operations, service line lead
- Pharma & biotech: R&D, clinical operations, regulatory, MSL, commercial
- Public health / population health / epidemiology
- Mental health: psychiatrist, psychologist, counsellor, social worker
- Dental, optometry, veterinary

NUMBERS THAT MATTER:
- Active licence/registration number with regulator (DOH, MOH, GMC, NMC, HPC)
- Clinical hours / cases performed (especially for surgeons, anaesthetists)
- Patient volumes (e.g. "12,000 OPD consults/year")
- Bed capacity managed, theatre lists run, clinic sessions
- Audit cycle outcomes, CQUIN/QOF achievement, accreditation pass (JCI, NABH)
- Length of stay, readmission rates, infection rates (where applicable)
- CME hours / CPD points per year

HIDDEN GOLDMINES (clinicians underplay constantly):
- Specific procedures performed (with volumes) — "Performed 240 cataract surgeries with 0.4% complication rate"
- Cross-cultural / multilingual practice (huge in GCC, Singapore, US)
- Research papers, conference posters, grand rounds
- Teaching: students mentored, residents trained, lectures given
- Quality improvement projects with measured outcomes
- Difficult cases handled (anonymised) — shows clinical judgement
- Crisis service: Covid surge, mass casualty, disaster response
- Committee work: M&M, clinical governance, infection control

VOCABULARY OF EXPERTISE:
- Use proper clinical terminology (don't say "heart problems" — say "ischaemic cardiomyopathy")
- "Sub-specialist in", "credentialled for", "primary surgeon on"
- "MDT lead", "case manager", "ward round attending"
- Local regulator language (DOH UAE vs MOH KSA vs HAAD historically)

RED FLAGS / COMMON MISTAKES:
- Missing licence info — instant rejection at credentialling stage
- Generic "managed patients" without specialty, volume, complexity
- No CPD record for clinicians (suggests stale practice)
- Hiding gaps in clinical practice (maternity, locum, return after burnout — all explicable)
- Listing every medication you've prescribed (clutter)

EXEMPLARY ACHIEVEMENT:
"Consultant Cardiologist, Cleveland Clinic Abu Dhabi (DOH licence #ABC123) — sub-specialty interventional cardiology. 380 cath lab procedures/year, primary on 142 PCIs with 99.3% TIMI 3 flow, door-to-balloon median 47 min vs unit target 60 min. Mentored 2 fellows to independent practice. Lead author on Gulf STEMI registry paper, Eur Heart J 2025."`,

  legal: `LEGAL — what an exceptional CV looks like:

SUB-SEGMENT MATTERS:
- Corporate / M&A / private equity
- Capital markets (ECM, DCM)
- Banking & finance (real estate finance, project finance, leveraged)
- Litigation & dispute resolution (commercial, white-collar, IP)
- Regulatory (financial services, competition, data protection, sanctions)
- IP (patent prosecution, trademark, copyright, IP litigation)
- Employment & immigration
- Real estate, construction, infrastructure (Middle East nuance: PPP, EPC)
- In-house (general counsel, commercial counsel, compliance)
- Public sector / regulator

NUMBERS THAT MATTER:
- Deal sizes (where confidentiality allows) — name brackets if exact is sensitive
- Billable hours, realisation rates (private practice)
- Cases litigated, win rate, recoveries
- Jurisdictions admitted to (multiple = portable)
- Languages — for arbitration, cross-border, regional roles
- Team size mentored, juniors supervised
- Partnership track / NQ to associate to senior associate timing

HIDDEN GOLDMINES:
- Specific transactions / cases (with consent or anonymised): "Junior counsel on $1.2B IPO of [Issuer] on LSE"
- Secondments to clients (signals commercial maturity)
- Cross-border / multi-jurisdictional matters
- Publications in journals (Lloyd's Law Reports, Construction Law, Asian Disputes Review)
- Speaking at LMA, IBA, in-house panels
- Pro bono work — often substantial, always forgotten
- Tribunal / arbitral experience — DIFC-LCIA, ICC, LCIA
- Sector specialism (TMT, energy, infrastructure, financial services)

VOCABULARY OF EXPERTISE:
- "Advised on" (specific scope: drafting, negotiating, due diligence, structuring)
- "Led the matter" vs "supervised by partner"
- "First-chair counsel" / "junior counsel" / "of counsel"
- "Drafted and negotiated" — much stronger than "involved in"
- "Acted for" the party — name where confidentiality allows

RED FLAGS:
- No jurisdictions listed
- "Managed contracts" with no value, type, or counterparties
- Vague seniority (associate vs senior associate matters)
- Missing professional registration (SRA, BSB, NY Bar, ADGM, DIFC)
- Listing every law school clinic at senior level

EXEMPLARY ACHIEVEMENT:
"Senior Associate, Allen & Overy (Dubai office, England & Wales solicitor + DIFC-registered). Lead drafting counsel on $4.5B Sukuk issuance for sovereign issuer — first benchmark Sukuk of 2025. Negotiated 8 banks' comments over 14 weeks, closed at 47bps tighter than initial guidance. Trained 3 trainees, two retained on qualification."`,

  marketing: `MARKETING — what an exceptional CV looks like:

SUB-SEGMENT MATTERS (very different skill stacks):
- Brand marketing (strategy, positioning, communications)
- Growth / performance (paid acquisition, SEO, CRO, retention)
- Content (blog, video, podcast, gated assets)
- PR & communications (earned media, crisis, exec comms)
- Product marketing (positioning, GTM, sales enablement)
- Lifecycle / CRM / email (cohort analysis, segmentation)
- Community / advocacy / influencer
- B2B vs B2C vs marketplace (channel mix differs hugely)
- Direct-to-consumer (DTC) vs retail vs hybrid

NUMBERS THAT MATTER (every claim must have one):
- ROAS, CAC, LTV, CAC payback, MER (full-funnel, not just paid)
- Conversion rates by stage of funnel
- Pipeline / revenue attributed (with attribution model named)
- MQL→SQL→Closed-Won conversion
- Reach, impressions, share of voice (with category comparison)
- Engagement %, viral coefficient, NPS lift
- Channel mix and budget split
- A/B test wins (lift % + statistical significance)

HIDDEN GOLDMINES:
- Cross-channel orchestration: "Owned the full funnel from paid TikTok to email drip to sales hand-off"
- Launches: product launches with measurable lift on key metric
- Viral moments / earned media wins
- Crisis comms handled
- Repositioning / rebrand — strategic + executional
- Saved a campaign / channel from killed
- Tools mastered (Iterable, Braze, HubSpot, Marketo, Klaviyo, GA4 + BigQuery)

VOCABULARY OF EXPERTISE:
- "Owned the [channel] P&L", "ran point on [launch]"
- "MQL→SQL conversion", "attribution model" (MTA vs MMM vs last-touch)
- "ICP fit", "PMF signal", "creative iteration velocity"
- "Channel mix", "incrementality testing", "CAC payback under [X months]"

RED FLAGS:
- Vanity metrics only (impressions, followers) — no conversion or revenue
- "Increased traffic" without conversion impact
- No specific channels owned
- Generic "ran campaigns" — what brand? what spend? what outcome?
- Listing tools without showing output

EXEMPLARY ACHIEVEMENT:
"Head of Growth, [Series B fintech] — owned EMEA paid acquisition + lifecycle. Scaled MAU from 84k to 412k in 14 months. CAC down from $187 to $89 (52%↓) while volume grew 5x. Daily budget $80k across Meta/Google/TikTok. Built attribution stack (incrementality + MMM), ran weekly creative tests at 12-test cadence. Owned LTV:CAC of 3.7."`,

  operations: `OPERATIONS / TRADES — what an exceptional CV looks like:

SUB-SEGMENT MATTERS:
- Supply chain & logistics (warehouse, distribution, fleet, 3PL/4PL)
- Manufacturing (lean, Six Sigma, continuous improvement)
- Retail operations (multi-site, store-level, regional)
- Restaurant / QSR / food service operations
- Construction site management / civil engineering / trades
- Facilities & FM (hard and soft services)
- E-commerce / fulfilment operations
- Vendor / procurement / category management
- Field operations / service delivery
- Trades: electrician, plumber, HVAC, mechanic — licences matter

NUMBERS THAT MATTER:
- Throughput (units/hour, orders/day, parcels/hour)
- On-time delivery / OTIF, fill rate, cycle time
- Cost per unit (CPU), cost-to-serve
- Sites operated, regions covered, teams managed
- Headcount, span of control, indirect reports
- Safety: LTI rate, days without incident, near-miss reporting
- Inventory: stock turn, days on hand, shrinkage %
- Quality: defect rate, customer complaints, returns %
- OEE, downtime, MTBF, MTTR (manufacturing)

HIDDEN GOLDMINES:
- Process redesigns with measured before/after
- Automation deployed (specific tech: SAP, Manhattan, Blue Yonder, Oracle)
- Safety milestones — often a Big Deal to operators
- Multi-site rollouts (especially openings)
- Crisis ops: peak season, Black Friday, weather event, supply disruption
- Six Sigma / lean certifications (Green Belt vs Black Belt vs MBB)
- ISO compliance (9001, 14001, 45001) achieved
- Project savings (with named methodology — kaizen, A3, DMAIC)
- Trades: specific licences (with grade), apprenticeship completion, on-tools record

VOCABULARY OF EXPERTISE:
- "Lean transformation", "kaizen events", "value-stream mapping"
- "OEE improvement", "SMED", "Andon", "5S", "JIT"
- "P&L responsibility", "cost-to-serve modelling"
- "Single-piece flow", "kanban replenishment"
- For trades: "first-fix", "second-fix", "snagging", "commissioning"

RED FLAGS:
- Generic "managed warehouse" with no size, throughput, headcount
- No specific systems used (every ops role uses something — name it)
- No safety metrics for senior ops roles
- Missing licences for trades roles
- "Reduced costs" without %, baseline, or named project

EXEMPLARY ACHIEVEMENT:
"Operations Manager covering 14 KFC restaurants in UAE — turned around bottom-quartile cluster to top quartile in 9 months. Food cost variance cut from 4.2% to 1.1%, labour cost down 280bps, zero LTI incidents over 18 months. Led 3 BOH retrain rollouts (380 staff total). Stock turn improved 2.4 → 4.1. Owned cluster P&L $32M revenue."`,

  hospitality: `HOSPITALITY — what an exceptional CV looks like:

SUB-SEGMENT MATTERS (recruiters anchor on this in the first 3 seconds):
- Property type: luxury (5★+), upscale (4★), midscale (3★), economy, lifestyle/boutique
- Brand: independent vs branded (Marriott / Hilton / Accor / Hyatt / IHG / Four Seasons / Mandarin Oriental / Aman)
- Setting: urban/business, resort/leisure, airport, conference, integrated resort, members' club
- Department: rooms division, F&B, sales & marketing, revenue, finance, HR, engineering, S&L, openings, conversions
- Service style: full-service vs select-service vs all-suite vs villa/private
- Geography: GCC ops, Asia luxury, US lifestyle, European heritage — each has hiring norms

NUMBERS THAT MATTER (this industry runs on them):
- RevPAR, ADR, occupancy %, RGI / RPI / MPI (vs comp set)
- TRevPAR (for full-service), GOPPAR, NOI
- Covers per service, avg cheque, F&B revenue, GOP%
- Guest satisfaction: TripAdvisor rank, brand index (LRA, REVINATE, Medallia), NPS
- Brand audit scores (LQA, brand standards) — pass rate, audit cycle
- Team size, multi-property count, span of control
- Pre-opening: timeline, FF&E budget, soft/grand opening dates
- Languages spoken (literally on the JD)

HIDDEN GOLDMINES (always forgotten, always critical):
- Pre-opening or rebrand/conversion experience — premium signal
- Brand audits passed at first attempt (LQA, brand standards, mystery shop)
- Royal / VIP / diplomatic / state guest handling
- Crisis recovery (Covid, ownership change, brand conversion, regional events)
- Cross-cultural team leadership (UAE: 70+ nationalities in one hotel)
- F&B concept launches, restaurant openings within hotel, Michelin/Tatler/Time Out recognition
- Owner relations / asset management interface
- TFI / TGI / employer surveys won
- Specific tech: Opera Cloud, IDeaS, Delphi, Salesforce, OTAs

VOCABULARY OF EXPERTISE:
- "Steady-state operations" vs "pre-opening" vs "ramp-up"
- "Owner relations" / "asset management"
- "Cluster role" (multi-property)
- "Forecasting accuracy", "rate parity", "channel mix"
- "Outlet manager", "HoH" (Heart of House) vs "FoH"
- "Brand of one" / "lifestyle positioning"

RED FLAGS / COMMON MISTAKES:
- Missing property star rating + brand affiliation
- Generic "managed F&B" — what outlets? what covers? what cuisine?
- No RevPAR/ADR/occupancy in revenue/ops roles
- Hiding gaps (industry has high churn — explain honestly, don't hide)
- Listing all your training courses (clutter — only flagship ones)
- Photos on CV in markets that screen them out (UK/US/Aus)

EXEMPLARY ACHIEVEMENT:
"Pre-opening Director of F&B, JW Marriott Marquis Dubai (412 rooms, 8 outlets, $42M F&B revenue Y1). Hired and trained 87 culinary + service staff. Signed off FF&E procurement worth AED 6M. All 8 outlets opened on time. Hit ADR target +12% above proforma in first 90 days. TripAdvisor: 4 of 8 outlets ranked top 10 in Dubai within Y1. Languages: English, Arabic, French."`,

  education: `EDUCATION — what an exceptional CV looks like:

SUB-SEGMENT MATTERS:
- Primary / Early Years (EYFS, KG, prep)
- Secondary (curriculum: IB, IGCSE, A-Level, AP, national curriculum)
- Tertiary (lecturer, professor track, research vs teaching focus)
- EdTech (instructional design, learning experience, product)
- Training (corporate L&D, vocational, technical)
- Special needs / SEN / inclusion
- ESL / EAL / TESOL
- Leadership: HoD, deputy head, head, principal, superintendent

NUMBERS THAT MATTER:
- Pass rates by grade boundary (especially 9-7 / A*-A for UK; A grades for IB)
- Value-added scores (Progress 8, MidYIS, ALIS)
- Cohort size, classes taught, subjects covered
- Exam board familiarity (Cambridge, Edexcel, OCR, AQA, IBO)
- Inspection outcomes (OFSTED, ADEK, KHDA — specifically band achieved)
- Student outcomes destinations (Russell Group %, Ivy %, Oxbridge)
- Pastoral caseload, safeguarding referrals handled

HIDDEN GOLDMINES:
- Curriculum design / scheme of work authored
- Trust-wide or regional contributions (departmental leads, moderators, examiners)
- Pastoral roles (head of year, house master, MH first aid)
- Co-curricular: clubs, trips, sports, music, theatre — colour matters
- Technology innovations (LMS implementations, blended learning)
- Teacher training / coaching / observation
- Conference talks, journal articles, professional bodies
- Research with measured impact on practice
- DBS / international vetting clearance

VOCABULARY OF EXPERTISE:
- "Differentiation" (specific strategies), "scaffolding"
- "Assessment for learning" (AfL) vs "of learning"
- "Quality assurance lead", "moderator", "examiner"
- "Value-added", "expected progress", "EBacc"
- "Pastoral lead", "designated safeguarding lead"

RED FLAGS:
- No safeguarding / DBS mention
- Vague "great results" without specific data
- Missing curriculum specificity
- No PD / CPD recent
- Long gaps unexplained
- Generic "passionate about teaching" personal statements

EXEMPLARY ACHIEVEMENT:
"Head of Mathematics, [School] (OFSTED Outstanding 2023, KHDA Outstanding 2024) — led department through 2 inspections. GCSE 9-7 pass rate from 38% to 61% over 3 years (vs national avg 42%). A-Level A*-A from 28% to 47%. Designed Year 7-9 mastery curriculum now adopted trust-wide (12 schools). Mentored 4 NQTs to threshold, 2 to TLR roles. Cambridge Maths examiner."`,

  sales: `SALES — what an exceptional CV looks like:

SUB-SEGMENT MATTERS (commission structures + skill stacks differ):
- SDR / BDR (outbound focus, meetings booked, qualified pipe)
- AE (closing, quota carrying, deal cycle ownership)
- AM / CSM (renewal + expansion vs new logo)
- Sales Engineer / Solutions Consultant (technical + commercial)
- Channel / Partner manager
- Enterprise vs Mid-market vs SMB (very different motions)
- B2B SaaS vs hardware vs services vs pharma vs financial services
- Sales leadership (player-coach → director → VP → CRO)

NUMBERS THAT MATTER (LITERALLY every line needs one):
- Quota attainment % (every single year, named) — this is the single biggest signal
- ACV / TCV / ARR closed
- Deal size: avg, largest, deal range
- Win rate, pipeline coverage (3x is healthy, 5x is conservative)
- Cycle length (and trend — improving = positive signal)
- Logo wins (named where possible), upsell %, NRR
- Top-of-stack metrics: President's Club, Top X% globally
- Quota size (rookie quota vs enterprise quota — context matters)

HIDDEN GOLDMINES:
- Methodology training (MEDDPICC, Challenger, Sandler, SPIN, Solution Selling) — name actually completed
- Specific tools mastered (Salesforce, Outreach, Gong, Clari, Apollo, ZoomInfo, LinkedIn Sales Nav)
- Mentored reps to promotion / hit quota
- Built out a new territory / segment / vertical
- Largest deal: name the buyer logo (with consent), deal size, cycle length
- Cross-functional wins (worked with PM to influence roadmap based on lost-deal analysis)
- Industry vertical specialism (FSI, healthcare, public sector — vertical reps get paid more)

VOCABULARY OF EXPERTISE:
- "Land and expand" / "logo land then expand AUM"
- "ICP" (ideal customer profile), "buying committee"
- "Champion building", "multi-thread"
- "Discovery" vs "demo" vs "POC" — they're not the same
- "Pipeline generation cadence", "TAM penetration"
- "MEDDPICC" components named individually (Metrics, Economic buyer, Decision criteria...)

RED FLAGS:
- Missing quota numbers (instant red flag for any sales hiring manager)
- "Exceeded targets" without specifying by how much
- No deal sizes
- No mention of methodology
- Tenure shorter than typical sales cycle for that ACV range

EXEMPLARY ACHIEVEMENT:
"Enterprise AE — Salesforce Middle East — 142% quota attainment FY25 ($4.2M ACV vs $3M target), top 5% globally. Closed 3 deals over $500k (largest: $1.1M Industries Cloud + Service Cloud to [Bank], 11-month cycle, 7-person buying committee). Mentored 4 SDRs, 3 promoted to AE. President's Club FY24 + FY25. MEDDPICC certified, Force Management trained."`,
}

// Compact one-liner version — used when token budget is tight or for the main interview
// where Claude shouldn't try to do full gap-analysis (just industry flavour).
export const INDUSTRY_FOCUS_SHORT: Record<Industry, string> = {
  finance: 'P&L responsibility, deal sizes, AUM, IRR, audit scope, certifications (CFA/ACCA/CPA), regulatory frameworks',
  tech: 'tech stack in context, scale (users/QPS/uptime/latency), ownership ("shipped" not "worked on"), 0→1 vs growth-stage, OSS/talks',
  creative: 'portfolio link, named brands and campaigns, awards/shortlists (Cannes/D&AD), reach and engagement, concept-to-execution',
  healthcare: 'licence/registration number, sub-specialty, patient volumes and procedure counts, audit outcomes, CPD/CME hours',
  legal: 'jurisdictions admitted, deal/case sizes (with consent), practice area depth, named transactions, partnership track',
  marketing: 'ROAS/CAC/LTV/CAC-payback, channel ownership, attribution model named, launches with lift %, cohort analysis',
  operations: 'throughput, OTIF, headcount, sites, safety record (LTI), systems used (SAP/NetSuite), lean/Six Sigma certs',
  hospitality: 'property type + star rating + brand, RevPAR/ADR/occupancy, pre-opening experience, F&B covers, brand audits passed, languages',
  education: 'curriculum (IB/IGCSE/A-Level), pass rates with comparison, value-added scores, inspection outcomes, pastoral roles, DBS',
  sales: 'quota attainment % every year, ACV/TCV, win rate, methodology trained (MEDDPICC), named logos, President\'s Club',
}

// Industry display metadata — single source for emoji + label used across UI
export const INDUSTRY_META: Record<Industry, { label: string; emoji: string }> = {
  finance: { label: 'Finance', emoji: '📊' },
  tech: { label: 'Tech', emoji: '💻' },
  creative: { label: 'Media & Creative', emoji: '🎬' },
  healthcare: { label: 'Healthcare', emoji: '🏥' },
  legal: { label: 'Legal', emoji: '⚖️' },
  marketing: { label: 'Marketing', emoji: '📣' },
  operations: { label: 'Operations', emoji: '⚙️' },
  hospitality: { label: 'Hospitality', emoji: '🏨' },
  education: { label: 'Education', emoji: '🎓' },
  sales: { label: 'Sales', emoji: '🤝' },
}
