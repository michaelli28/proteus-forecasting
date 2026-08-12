# From White Paper to Contract: The Acquisition Path for a Simulate-and-Adjudicate Analytic Platform

**Scope note:** every factual claim below carries a URL. Where I could not verify something from a primary source this session, it is tagged **UNVERIFIED** or labeled by the class of source it came from. Where I am reasoning rather than citing, it is tagged **INFERENCE**.

---

## 0. BLUF

The CIA is the buyer that wrote the solicitation, but **the CIA is structurally the hardest first dollar in this entire landscape** — it is statutorily exempt from SBIR ([15 U.S.C. § 638(e)(2)](https://uscode.house.gov/view.xhtml?req=%28title%3A15+section%3A638+edition%3Aprelim%29) excludes "any agency within the Intelligence Community" from the definition of "Federal agency"), its solicitations mostly live behind a registration wall ([ARC](https://www.cia.gov/tech/arc-faq/) / [ALM Vendor Portal](https://www.cia.gov/partner-with-cia/)), and its data is classified, which means a facility clearance you cannot obtain without a government sponsor first ([DCSA](https://www.dcsa.mil/FCL/): "Contractors cannot sponsor themselves for an FCL").

The honest first move is a **two-step Broad Agency Announcement white paper into an already-open, already-funded, unclassified R&D BAA whose stated scope is analytic reasoning** — concretely, AFRL Rome Research Site (Information Directorate) — run **in parallel** with three cheap, non-exclusive registrations (In-Q-Tel business plan, CDAO Tradewinds video, CIA ARC/VP-U + the cia.gov "private-sector" submission), and **one** SBIR Phase I or Direct-to-Phase-II where a named DoD/NGA/DHS end user will sign a customer memorandum. First real dollars land realistically **9–15 months** after the first white paper; first *classified* work is a **24–36 month** proposition, not a Phase I one.

**In plain English:** nobody in this market buys a promising idea. They buy a measured result on data they can see, from a company another government office has already vouched for. This company has the measured result on synthetic data and no vouching. So the plan is: use one small, unclassified research contract to convert "measured on synthetic worlds" into "measured on real, resolvable world events, scored by someone else" — and use the same 12 months to acquire the boring credentials (registrations, a sponsor, a clearance path) that classified work requires. Trying to skip to the CIA directly wastes a year.

---

## 1. The landscape at a glance

| Pathway | Statutory / vehicle basis | Realistic first award | Realistic elapsed: white paper → first dollar | Hardest gate |
|---|---|---|---|---|
| **Two-step BAA** (AFRL/RI, DARPA, ONR, DTRA) | [FAR 35.016](https://www.acquisition.gov/far/35.016) | $200K–$1.5M, 12–36 mo | **9–15 months** | Program manager must want it; funding availability |
| **DIU CSO** | [10 U.S.C. § 4022](https://s3.us-gov-west-1.amazonaws.com/publicdocs.diu.mil/CSO-Guide-2026.pdf) prototype OT | ~$1M–$5M prototype OT | **6–12 months from AOI**, but only when an AOI matches | An AOI must exist; ~172-day actual award time ([GAO](https://www.gao.gov/assets/gao-25-106856.pdf)) |
| **Defense CSO (non-DIU)** | 10 U.S.C. § 3458 / [DFARS 212.70](https://www.hklaw.com/en/insights/publications/2026/03/an-offerors-legal-guide-to-commercial-solutions-openings) | Varies; FAR-based FFP or OT | 4–9 months | Fewer AOIs relevant to analytic tradecraft |
| **OTA consortium** (IWRP, C5, SOSSEC/ACI, NSTXL S2MARTS) | 10 U.S.C. § 4022 / § 4021 | $250K–$5M prototype | **4–8 months** once a Request for Solutions drops | Membership + CMMC + no RFS may ever match |
| **SBIR/STTR** (DoD, DHS, NGA — *not* CIA/DIA/NSA) | [15 U.S.C. § 638](https://www.law.cornell.edu/uscode/text/15/638) | Phase I ≤ $323,090; Phase II ≤ $2,153,927 ([SBA guideline, Apr 2026](https://www.sbir.gov/about)) | **6–11 months** | Topic fit; per-firm proposal caps from FY27 |
| **IARPA** (BAA / seedling / ETA) | FAR 35.016 | Seedling **< $1M, 9–12 mo** ([IARPA](https://www.iarpa.gov/engage-with-us/seedlings)) | 6–14 months | *No open R&D opportunities as of this session* |
| **In-Q-Tel** | Non-profit strategic investor + work program | ~$500K–$3M work program (third-party figures, **UNVERIFIED**) | 6–18 months, no revenue guarantee | Must have venture backing and a shipping product |
| **Tradewinds (CDAO)** | 10 U.S.C. 4021/4022/3458, DFARS 212.70 | No award; **"awardable" status** for 24 months | **~60 days to awardable**; dollars only when a buyer appears | Buyer still needs funds and a requirement |
| **DHS SVIP** | Innovation Other Transaction Solicitation | $50–200K/phase, 4 phases to $800K | **~45 days** award average ([DHS](https://www.dhs.gov/archive/science-and-technology/svip-how-apply)) | Must be an open topic call; DHS ≠ CIA |
| **AFWERX / xTech / SOFWERX** | SBIR + prize authority | $2K–$250K entry; $1.9M D2P2 | 4–12 months | Front doors, not contracts |
| **GSA MAS / OASIS+ / Alliant 3 / SITE III** | FAR Part 8/16 IDIQ | $0 — it is a hunting license | **9–15 months to get on**, then indefinite | Requires prior past performance you don't have |
| **Unsolicited proposal** | [FAR 15.6](https://www.acquisition.gov/far/subpart-15.6) | Rare; sole-source needs a J&A | 6–24 months, low hit rate | "Closely resembles a pending competitive acquisition" → auto-return |

---

## 2. Broad Agency Announcements (FAR 35.016) — the white paper's native habitat

### What the regulation actually says

[FAR 35.016](https://www.acquisition.gov/far/35.016) authorizes BAAs for "basic and applied research and that part of development not related to the development of a specific system or hardware procurement." Two clauses matter enormously to a small company:

- **35.016(d):** proposals are evaluated "through a peer or scientific review process" and **"need not be evaluated against each other since they are not submitted in accordance with a common work statement."** You are not in a bake-off; you are being judged against the program's own goals. (Confirmed verbatim in [BARDA's solicitation-methods briefing](https://www.medicalcountermeasures.gov/media/35770/cohen.baa_and_rfp.pdf) and the [DARPA BAA Guide](https://www.darpa.mil/sites/default/files/attachment/2024-12/darpa-guide-broad-agency-announcements-research-announcements.pdf).)
- **35.016(e):** selection rests on "technical merit, importance to agency programs, and fund availability." **Fund availability is a named selection factor.** A technically excellent white paper submitted against a BAA with no money in that technical area is a lawful rejection.

### The white paper as first gate — the mechanics, from government guidance

The [Air Force BAA Guide for Industry](https://neilsmiller.github.io/Contract_opps_database/files/bf3b59bda4814397b37a3c96c302178e_BAA+Ind+Guide+2025.pdf) (v2.2, Jan 2025; [2020 version on afrl.af.mil](https://www.afrl.af.mil/Portals/90/Documents/HQ/BAA%20Ind%20Guide%202020.pdf)) is the most explicit public statement of how the gate works:

- **Purpose:** "to preclude unwarranted effort on the part of an offeror whose work is not of interest to the Government."
- **Length:** white papers are defined in the guide's glossary as "usually 2–5 pages." AFRL/RI's AI & Next-Gen C2 BAA was amended to require **one copy of a 3-page white paper** ([SAM.gov FA8750-23-S-7006](https://sam.gov/workspace/contract/opp/5cd1dec3f39b44eb87cae4bd15984120/view)).
- **Required structure:** Section A (BAA number, company, business size, UEI, POCs — *plus clearance level, cognizant security office and FSO name if the submission is classified*); Section B (period of performance + task objectives); Section C (technical summary + proposed deliverables); Section D (**ROM cost only — "a time-phased bottom line figure," no detailed cost support**).
- **Explicitly NOT wanted at this stage:** "Resumes, descriptions of facilities and equipment, a proposed Statement of Work are not required at this point."
- **Response guarantee:** "All offerors submitting white papers will be contacted by the Government; either informing them the effort proposed is not of interest… or requesting a formal cost and technical proposal by a specified date."
- **The bar-out clause:** "The BAA must state whether an unfavorable white paper review will bar the offeror from further consideration," and "Offerors that submit a proposal without first submitting a white paper may not be eligible for award."

DARPA runs the same gate with softer semantics: its guide requires that "all conforming abstracts must receive consideration and a written response either **encouraging or discouraging** submission of a proposal," and notes a discouragement is usually guidance, not a bar — "should the abstract become a hard decision point that does preclude a proposer from submitting a proposal, the BAA should clearly describe this process" ([DARPA BAA Guide](https://www.darpa.mil/sites/default/files/attachment/2024-12/darpa-guide-broad-agency-announcements-research-announcements.pdf)).

### The timeline nobody advertises

The Air Force guide's cost-proposal instructions contain the single most useful scheduling fact in this report:

> "For pricing purposes, offerors should assume a contract or agreement start date of approximately **one hundred and fifty (150) days after submission of the proposal**." ([BAA Guide for Industry, Part IV](https://neilsmiller.github.io/Contract_opps_database/files/bf3b59bda4814397b37a3c96c302178e_BAA+Ind+Guide+2025.pdf))

That 150 days is measured from *proposal* submission — after the white paper round. **INFERENCE:** white paper submission → written response typically 4–12 weeks → invited proposal preparation 4–8 weeks → 150 days to start ⇒ **9–15 months from white paper to first invoice** is the realistic planning number for a BAA. Anyone promising 90 days on a BAA is describing an OT, not a BAA.

### Live, open, directly relevant BAAs (as of this session)

AFRL's Rome Research Site / Information Directorate (FA8750) runs **open, two-step BAAs where only white papers are accepted as initial submissions and proposals are by invitation only**:

| BAA | Scope | Ceiling | Typical award | Open until |
|---|---|---|---|---|
| [FA8750-23-S-7006](https://sam.gov/workspace/contract/opp/5cd1dec3f39b44eb87cae4bd15984120/view) — AI & Next-Gen Distributed C2 | AI applied to C2 planning/execution, incl. "how the use of AI by adversaries can be considered in the C2 planning and execution process" | ~$99M | $200K–$20M, ≤48 mo | 30 Aug 2028 |
| [FA8750-23-S-7008](https://sam.gov/workspace/contract/opp/6cf7570de9eb4429895bd99266b15c03/view) — AFAR (Adaptive Fusion, Analysis & Reasoning of multi-source data) | multi-source fusion/reasoning; includes "Publicly Available Information (PAI) Ensemble Fusion" | ~$25M | **$500K–$1.5M**, ≤36 mo | 29 Aug 2028 |
| [FA8750-25-S-7001](https://sam.gov/opp/332267b22ce548e3a06ad1a1400e708f/view) — Foundations of Trusted Systems | trusted/resilient C4I and cyber information processing | ~$99.9M | $100K–$5M, ≤36 mo | 4 Dec 2028 |
| [FA8750-23-S-7005](https://sam.gov/opp/e2525b7295334755924422f1c9ffe08c/view) — SIGINT Solutions for Evolving Scenarios | real-time processing "in support of the Intelligence Community" | ~$99.9M | $250K–$15M, ≤36 mo | 25 Sep 2028 |
| [FA8750-21-S-7006](https://sam.gov/opp/f6dac217c58545578b6dff242335e997/view) — GeoPEX | GEOINT processing/exploitation, analytic services | ~$99.9M | $250K–$10M, ≤24 mo | 30 Sep 2026 |

**Who it fits:** a company whose product *is* research — a method with a measurable claim. That is exactly this product. The AFAR BAA's $500K–$1.5M / 36-month band is the closest match to a first award for a calibration-and-adjudication engine.

**Deliverables by phase:** (1) 3–5 page white paper + ROM; (2) if encouraged, full technical + cost proposal with SOW, key personnel, facilities, and data-rights assertions; (3) on award, monthly/quarterly technical reports plus CDRLs, a final report, and whatever demonstration the SOW names.

**The trap that kills small companies:** treating the BAA as a mailing list. These BAAs publish *suggested submission dates aligned to projected fiscal-year funding* — FA8750-23-S-7008 explicitly narrowed FY24 to two focus areas. A white paper that arrives outside the funding window against a technical area with no money is rejected on FAR 35.016(e) grounds regardless of merit, and the company concludes (wrongly) that the technology was rejected. The second trap: BAAs are the **only** pathway here where the government can award "only those portions or tasks of the proposal that are of interest," and can rank a proposal Not Selectable overall while funding one slice of it — small companies routinely price a monolithic effort that cannot be partially awarded.

---

## 3. Commercial Solutions Openings (10 U.S.C. § 3458) and DIU's CSO

### Two different things share the name

1. **DIU's CSO** is built on **10 U.S.C. § 4022** (prototype Other Transaction authority), not § 3458. The [2026 DIU CSO Guidebook](https://s3.us-gov-west-1.amazonaws.com/publicdocs.diu.mil/CSO-Guide-2026.pdf) says so directly and warns: "This should not be confused with 'The Defense CSO' authorized by Section 803 of the NDAA for FY 2022, implemented in DFARS 212.70." DIU asserts its process "satisfies 'competitive procedures to the maximum extent practicable' in accordance with 10 U.S.C. 4022(b)(2)."
2. **The Defense CSO** under **10 U.S.C. § 3458 / DFARS 212.70** is a FAR-adjacent commercial-solutions mechanism used by many other offices. Per [Holland & Knight (Mar 2026)](https://www.hklaw.com/en/insights/publications/2026/03/an-offerors-legal-guide-to-commercial-solutions-openings), the FY2026 NDAA made two changes: it **removed the "innovative" limitation**, turning CSOs into a general commercial acquisition tool, and it **allows a production OT to be awarded directly from a CSO**, skipping the prototype stage.

### DIU's actual process, timings, and evaluation logic (primary source)

From the [2026 CSO Guidebook](https://s3.us-gov-west-1.amazonaws.com/publicdocs.diu.mil/CSO-Guide-2026.pdf):

- **Before the solicitation:** Problem Curation (produces a "concise, jargon-free paragraph defining the precise mission gap") → Project Diligence, a director-level **go/no-go** that must confirm four things, one of which is **"Transition Path: Active fielding route + follow-on funding."** If there is no transition path and no follow-on money, the AOI never publishes.
- **Area of Interest (AOI):** "generally no longer than a page," live on diu.mil for **about 14 days**.
- **Phase 1 — Solution Brief:** "5 pages or 15 slides." Strict **binary** evaluation applied "in strict order: Relevance → Innovation → Technical Merit." Timeline: **10 days**. Published instant-kill triggers include "Generic tech searching for a problem," "Cosmetic tweak to legacy tech," "Single-digit improvement at best," "Buzzwords with no proof," "Theory slides, no demo or data," "Integration hurdles ignored."
- **Phase 2 — Pitch:** 60 minutes — "20-minute pitch and 40-minute rapid-fire questioning." A Business Intelligence team pre-screens "ownership and capital for foreign influence." Timeline: **30 days**. Three outcomes: advance, **Portal Hold (180 days)** ("Concept of interest, resources constrained"), or non-selection.
- **Phase 3 — Request for Prototype Proposal:** SOW co-written, **commercial pricing baseline**, "Vendor terms, lightly tailored" on IP. Timeline: **30–60 days**.
- **Award funnel** (from the [DIU Quick Look](https://www.secnav.navy.mil/rda/DASN-P/Shared%20Documents/DIU%20Quick%20Look%20-%20Acquisition%20.pdf)): 20–110+ vendors at Phase 1 → 5–20 pitch → 1–5 proposals → 1–5 awards → 1–2 transition. Prototyping period **12–24 months**.

### The dollars and the odds

- FY16–FY23: **450 prototype OT awards, ~$1.7B obligated** (mean ≈ **$3.8M**), across 389 unique vendors; **51% of completed prototypes transitioned**, with $5.5B in follow-on ceiling ([GAO-25-106856](https://www.gao.gov/assets/gao-25-106856.pdf), [DIU FY23 Annual Report](https://s3.us-gov-west-1.amazonaws.com/publicdocs.diu.mil/DIU_Annual_Report_FY2023.pdf)).
- FY23 alone: 33 solicitations, 1,768 proposals, 90 prototype contracts worth $298M — i.e. **~5% of submitted proposals became prototype contracts.**
- **The 60–90 day promise is not real:** GAO found "85 percent of DIU's awards exceeded the 90-day goal, averaging about **172 days**." DIU's own FY22 review reported an average of 142 days.
- Composition: **88% nontraditional, 68% small business, 40% first-time DoD vendors** ([DIU Quick Look](https://www.secnav.navy.mil/rda/DASN-P/Shared%20Documents/DIU%20Quick%20Look%20-%20Acquisition%20.pdf)).

### Cost share and follow-on production

10 U.S.C. § 4022(d) requires one of four conditions, reproduced in the guidebook: (A) a nontraditional defense contractor or nonprofit research institution participating "to a significant extent"; (B) all significant non-government participants are small businesses or NDCs; (C) **at least one-third of total prototype cost from non-federal funds**; or (D) a senior procurement executive written exception. A small nontraditional software company clears (A)/(B) and never needs the one-third match — **but only if its NDC status is verified**, which DIU does by searching FPDS-NG for CAS-covered DoW contracts in the preceding 12 months.

§ 4022(f) allows a follow-on production contract or OT **without further competition** on a successfully completed prototype, and per the guidebook, "**Multiple DoW organizations can issue follow-on production awards based on a single successful prototype**." This is the strongest scaling mechanic in the entire landscape.

**Who it fits:** a shipping product with live pilot data and a named DoD end user. **Not** a research claim.

**The trap:** the Phase 1 kill-list is written against exactly this company's current position — "Theory slides, no demo or data" and "Buzzwords with no proof" are the two most common failure modes for a system whose only measured results are on synthetic oracles. DIU's Phase 1 wants "Working prototype or live pilot data." Synthetic-oracle Brier skill is data, but it is not *pilot* data, and 40 minutes of rapid-fire questioning will find that seam in about four minutes. Second trap: waiting for a perfect AOI. AOIs are one page, live 14 days, and there may be no AOI for adversary-decision simulation for a year.

---

## 4. Other Transaction Authority and consortium vehicles

### How a consortium actually works

A government sponsor awards a single OTA to a consortium manager; members compete for **Requests for Solutions (RFS)** issued under it. The [NSTXL RFS anatomy](https://nstxl.org/request-for-solutions-anatomy-of-an-rfs/) describes the sequence: "coming soon" notice → teaming events (Innovator NETWORX, Industry Days) → full RFS with technical requirements and evaluation criteria → question deadline → published Q&A → live "Project TALX" → firm submission deadline ("Late or incomplete submissions are often disqualified") → optional down-select → award notice.

### The vehicles, with real fees

From [MITRE's AiDA consortium registry](https://aida.mitre.org/ota/existing-ota-consortia/):

| Consortium | Sponsor | Manager | Annual fee | Relevance |
|---|---|---|---|---|
| **IWRP** (Information Warfare Research Project) | NAVWAR / NIWC Atlantic | Advanced Technology International | **Large $750 / small $250 / academia free** | Information warfare, cyber, **AI/ML**, assured comms — the closest fit |
| **C5** (Command, Control & Communications in Cyberspace) | Army CCDC (also USMC MCSC) | Consortium Management Group | **$500 (waived first year; academia exempt)** | C4ISR, cyber, AI, data analytics |
| **ACI** (AFLCMC Consortium Initiative) | AFLCMC | **SOSSEC** | **$500** | C4ISR prototype development |
| **S²MARTS Research** | NSWC Crane | NSTXL | **$250–$10,000** | Microelectronics, spectrum, strategic missions — poor fit |
| **SpEC** (Space Enterprise Consortium) | USSF SSC | NSTXL | $250–$10,000 | Space; requires an active **DD2345** |
| **NSC** (National Spectrum Consortium) | OUSD(R&E) | member-led | $500 | 5G, ML, autonomy |

IWRP is the one worth reading closely: NIWC Atlantic awarded **IWRP 2** to ATI in Nov 2019 with a **$500M ceiling / 5-year PoP**, later boosted by [$400M](https://www.c4isrnet.com/information-warfare/2020/08/18/navy-information-warfare-project-received-400-million-funding-boost/); **IWRP 3** was awarded to ATI for a **10-year ordering period running through 30 Sep 2034 with an "undefined ceiling"** ([OrangeSlices](https://orangeslices.ai/niwc-atlantic-awards-ota-to-advanced-technology-international-ati-to-manage-the-information-warfare-research-project-iwrp-3-consortium-for-10-years/), [DVIDS](https://www.dvidshub.net/news/410658/niwc-atlantic-awards-information-warfare-research-project-2-advanced-technology-international)). IWRP has executed **171 prototype awards** since 2018. **UNVERIFIED:** whether the AiDA fee schedule ($750/$250/free) reflects IWRP 3 or IWRP 2 — confirm with ATI before budgeting.

### Membership mechanics and speed

[NSTXL](https://nstxl.org/how-to-join-an-ota-consortium/) states applications are "reviewed by our membership team, and typically approved in just a few business days," fees "start at just $250," and that NSTXL "can take opportunities from solicitation to award in **less than 120 days**." Required credentials: CAGE code, UEI, sometimes DD2345, and a **CMMC Level 1 self-assessment now, with CMMC Level 2 certification required by 10 November 2026 for continued NSTXL membership**. Holland & Knight independently flags CMMC Level 2 as "typically requiring **6–18 months** to achieve."

**Who it fits:** a company that can wait for the right RFS and wants a low-cost standing seat at the table. Membership is genuinely cheap — under $1,000/year buys visibility into IWRP and C5 RFS flow.

**Typical first award:** RFS prototype awards commonly land in the **$250K–$5M** band. **INFERENCE** from the IWRP/C5 award pattern; specific values vary per RFS.

**The trap:** paying $500 and waiting. Consortium membership generates zero pipeline by itself; the winners are members who attend Industry Days and "Project TALX," ask questions during the Q&A window (which is *published to all members*, so a well-crafted question is also positioning), and pre-team before the RFS drops. The second trap is the § 4022(f) follow-on production clause: Holland & Knight notes the statute "doesn't define 'participants,'" so a subcontractor on someone else's prototype may inherit sole-source follow-on standing — **write your teaming agreement before you need it.**

---

## 5. SBIR/STTR — and the CIA's absence from it

### The IC exemption is statutory, not discretionary

[15 U.S.C. § 638(e)(2)](https://uscode.house.gov/view.xhtml?req=%28title%3A15+section%3A638+edition%3Aprelim%29): "the term 'Federal agency' means an executive agency… **except that it does not include any agency within the Intelligence Community** (as the term is defined in section 3.4(f) of Executive Order 12333 or its successor orders)." The [SBA policy directive glossary](https://www.sbir.gov/about/policies) repeats it verbatim.

Consequences:
- **CIA, DIA, NSA, NRO, ODNI/IARPA do not run SBIR programs.** [sbir.gov's participating-agency list](https://www.sbir.gov/participating-agencies) shows eleven departments/agencies; no IC element appears as an independent participant.
- **NGA is the exception.** NGA states that IC members are exempt but that it "has found that the SBIR/STTR program is valuable enough to warrant voluntary participation and is the only member of the IC that participates" ([NGA SBIR/STTR Program Guidance](https://www.nga.mil/resources/SBIR_STTR_PROGRAM_GUIDANCE.html) — quoted from search indexing; **the page returned HTTP 403 to direct fetch this session, so treat the exact wording as reported-not-fetched**). NGA appears under the DoW umbrella on sbir.gov, and DoW's SBIR budget is listed at **$2.3B**.
- DHS participates at **$15M** — small, but SVIP sits beside it (§ 9 below).

### The 2026 reauthorization reset the rules

Per [Crowell & Moring](https://www.crowell.com/en/insights/client-alerts/sbirsttr-programs-reauthorized-after-six-month-lapse): the Small Business Innovation and Economic Security Act of 2026 was signed **13 April 2026**, extending both programs through **30 September 2031**, after a **six-month lapse** following expiration on 30 September 2025 (Senate 3 March 2026, House 17 March 2026). Key changes, corroborated by the [AFWERX post-reauthorization deck](https://afwerx.com/wp-content/uploads/Post-Reauth-Webinar_CLEARED_AFRL-2026-1966-2.pdf):

- **Direct-to-Phase-II extended to STTR.**
- **Strategic Breakthrough Awards:** a new sequential Phase II track, **up to $30M, ≤48-month PoP, 100% matching funds required**, available only at agencies spending >$100M/yr on SBIR and capped at 0.5% of extramural R&D budget. AFWERX notes this "is not intended to replace the STRATFI/TACFI Program."
- **Mandatory foreign-affiliation disclosure**, including venture backing and IP licenses, with scrutiny of ties to "countries of concern."
- **Per-firm Phase I proposal caps** — agencies must publish limits; effective FY2027.

### Current dollar ceilings

[sbir.gov](https://www.sbir.gov/about): "as of April 2026, agencies may issue a **Phase I award (including modifications) up to $323,090** and a **Phase II award up to $2,153,927** without seeking SBA approval." AFWERX's own published bands are lower: Phase I up to $75,000 (SBIR) / $110,000 (STTR) over ~3 months; Phase II up to $2,000,000 over 21 months; **Direct-to-Phase-II up to $1,250,000**, requiring "a prototype-ready solution, an identified Air Force end-user and customer, and a signed Customer Memorandum" (third-party compilations: [Cada](https://www.getcada.com/insights/afwerx-sbir-guide), [BW&CO](https://www.bwcoconsulting.com/fod/afwerx) — **the specific AFWERX figures are third-party, not primary**).

### Phase III — the real prize, and a live legal question

[15 U.S.C. § 638(r)(4)](https://www.law.cornell.edu/uscode/text/15/638) and the SBA Policy Directive establish that "the competitions for SBIR/STTR Phase I and Phase II awards satisfy any competition requirement of the Armed Services Procurement Act, the Federal Property and Administrative Services Act, and the Competition in Contracting Act," so an agency funding a Phase III "is not required to conduct another competition." DOE's guidance adds: "it is sufficient to state for purposes of a Justification and Approval, if one is deemed required… **Further justification is not needed**" ([DOE Phase III Provisions](https://science.osti.gov/-/media/sbir/pdf/Phase-III-Guidance/Phase-III-Provisions-2022_2_27.pdf); [Army SBIR](https://armysbir.army.mil/phase/phase-iii/); [NASA Phase III Guide](https://www.nasa.gov/wp-content/uploads/2024/01/phase-iii-guide-external-022624.pdf)). Phase III has **no dollar ceiling and no duration limit**, and NASA's guide notes "Any agency can award a Phase III. It does not matter where the SBIR or STTR work originated."

**Open question — flag for counsel, UNVERIFIED:** § 638(r)(4)'s Phase III preference runs to "Federal agencies," a term the same statute defines to **exclude** IC agencies. NASA's "any agency" framing is agency guidance, not statute. Whether the CIA can invoke § 638(r)(4) as its no-competition basis, or must instead rely on FAR 6.302 / the CIA Act of 1949 (50 U.S.C. § 3507) procurement authorities, is not something I could resolve from public sources. **This is materially important**: it determines whether a DoD SBIR Phase II is a genuine sole-source bridge *into* the CIA or only into DoD/DHS/NGA customers.

### The data-rights reason to prefer SBIR over almost everything else

[DFARS 252.227-7018](https://acquisition.gov/dfars/252.227-7018-rights-other-commercial-technical-data-and-computer-software%E2%80%94small-business-innovation-research-program-and-small-business-technology-transfer-program.) now provides a **single, non-extendable 20-year SBIR/STTR data protection period** beginning at contract award, after which the government gets **perpetual government purpose rights** (not unlimited rights). DoD's final rule codifying this took effect **17 January 2025** ([Crowell](https://www.crowell.com/en/insights/client-alerts/final-dod-rule-codifies-20-year-sbir-data-protection-period-and-other-sbir-program-protections); [DoW Office for Small Business Innovation](https://www.defensesbirsttr.mil/Data-Rights/)). During the protection period, "the Government may not release or disclose" the data — which is itself the mechanical basis of the Phase III sole-source mandate.

**Who it fits:** exactly this company — small, nontraditional, product is software with a measurable claim, and the 20-year clock on the deterministic kernel + calibration layer is worth more than the Phase I money.

**Deliverables by phase:** Phase I — feasibility study + final report + identified end user (~3–6 months). Phase II — working prototype, test data, transition plan, customer memorandum (~21–24 months). Phase III — production/services, funded by the customer's own money.

**The trap:** the "valley of death." NPS research on AFWERX Phase III transition found the dominant failure causes are not technical — they are "wrong organization, no funding available, or no military application," plus the fact that "the SBIR/STTR structure does not specifically prepare the small business in any meaningful way for this transition" ([NPS-AM-24-191](https://dair.nps.edu/bitstream/123456789/5178/1/NPS-AM-24-191.pdf)). A Phase II with no programmed Phase III money in the sponsor's budget is a 24-month subsidy that ends in nothing. **Do not accept a Phase II whose end user cannot name the program element that would fund Phase III.**

---

## 6. IARPA — the most technically aligned buyer, currently closed

IARPA is the IC's research funding organization, formed by consolidating NSA's Disruptive Technology Office, NGA's National Technology Alliance, and **CIA's Intelligence Technology Innovation Center**. It does not run SBIR (IC exemption above) and buys via **FAR Part 35 BAAs**.

Three entry modes ([IARPA Engage With Us](https://www.iarpa.gov/engage-with-us)):

1. **Program BAAs** — full multi-year research programs, typically preceded by a **Proposers' Day** where "the IARPA Program Manager presents his/her vision for the program, outlining the material in the BAA before it is formally issued" ([Proposers' Days](https://www.iarpa.gov/engage-with-us/proposers-days)). Attending the Proposers' Day is close to mandatory: it is where teaming forms and where you learn the evaluation metric before it is written down.
2. **Seedlings** — "typically **9–12 month research efforts that are less than $1M** in cost… intended to address highly innovative ideas… high-risk but with the potential for a high payoff. Seedling research takes an idea from disbelief to doubt, with the potential for a follow-on effort" ([Seedlings](https://www.iarpa.gov/engage-with-us/seedlings)).
3. **Emerging Technology Accelerator (ETA)** — new as of 2026. IARPA released **five ETA efforts on 29 April 2026** — ARCADE, COSMIC, DECIPHER, LOCUS, MOVES — described as "lean, agile programs scoped to deliver capabilities directly applicable to intelligence needs with **rigorous assessment of relevant performance**," with a proposers' day on 7 January 2026 ([announcement](https://www.iarpa.gov/newsroom/article/iarpa-releases-five-new-innovation-programs-to-enhance-national-security-capabilities), [ETA proposers' day](https://www.iarpa.gov/newsroom/article/iarpa-eta-proposers-day-arcade-cosmic-decipher-locus-moves-jan-7-2026)).

**Current status, verified this session:** [IARPA's R&D Opportunities page](https://www.iarpa.gov/engage-with-us/open-r-d-opportunities) states "There are currently no open R&D Opportunities," and the Proposers' Days page states "No Upcoming Proposers' Days Are Scheduled." Of the ETA topics, ARCADE shows **CLOSED** while COSMIC and DECIPHER show **OPEN**. Unclassified proposals go through **IDEAS**, IARPA's submission tool.

### Why IARPA matters disproportionately to *this* product

IARPA is the organization that **invented the evaluation standard this product should be measured against**. Its ACE program (Aggregative Contingent Estimation) ran a four-year geopolitical forecasting tournament scored by **Brier score**, with hundreds of resolvable real-world questions; HFC (Hybrid Forecasting Competition) then integrated human and machine forecasters and set a target of "a 10 percent increase in accuracy over baseline" ([ACE](https://www.iarpa.gov/research-programs/ace), [HFC](https://www.iarpa.gov/research-programs/hfc)). FOCUS evaluated counterfactual reasoning by "having hundreds of people make predictions about outcomes in complex simulations" — i.e., **IARPA has already accepted simulated worlds as a legitimate evaluation substrate when reality cannot be re-run** ([FOCUS](https://www.iarpa.gov/research-programs/focus)).

The academic record from ACE is the template for a Phase I evaluation plan: Brier decomposed into **calibration and resolution** per Murphy, questions weighted so "each question counted equally," reliability curves binned by forecast probability ([Mellers et al.](https://faculty.wharton.upenn.edu/wp-content/uploads/2015/07/2014---psychological-strategies-for-winning-a-tournament.pdf); [Moore et al.](https://escholarship.org/content/qt1700r340/qt1700r340.pdf); [Merkle, weighted Brier decompositions](https://www.cambridge.org/core/journals/judgment-and-decision-making/article/weighted-brier-score-decompositions-for-topically-heterogenous-forecasting-tournaments/8172E04F2DBC601DA5D953D4685CA346)). **INFERENCE:** a metrics package built on Brier, Brier skill vs. explicit baselines, Murphy decomposition, ECE/reliability diagrams and sharpness is not merely defensible to this buyer — it is *the buyer's own house metric*, and saying so in the first paragraph of any white paper is free credibility.

**Who it fits:** a research claim with a novel evaluation methodology. Best possible technical fit; worst possible timing right now.

**The trap:** IARPA programs are PM-driven and episodic. There is no standing open door. The correct posture is **monitor + be ready in 30 days**: subscribe to IARPA announcements, attend the next Proposers' Day regardless of topic, and have a seedling-shaped 9–12 month / <$1M concept written and sitting on the shelf. Companies that start writing when the BAA drops lose to teams formed at the Proposers' Day.

---

## 7. In-Q-Tel — equity plus work program

### The model

IQT is "a unique—and uniquely powerful—not-for-profit global investment platform" whose partners include "CIA, NSA, NGA, FBI, DIA, NRO, DHS, U.S. Cyber Command, Space Force, and Space Command, plus international partners from the U.K. and Australia" ([iqt.org](https://www.iqt.org/)). CIA's own site describes the relationship: "CIA partners with IQT to find and assess startup companies that meet the Agency's specific strategic technology needs" ([CIA Technology Collaboration](https://www.cia.gov/tech/tech-collaboration/)).

The documented process, from an AFIT case study and a University of Texas thesis:

1. Conduct a strategic needs assessment with IC partners ("problem sets");
2. Survey the commercial market;
3. Due diligence — three legs: **government-need fit, technical validation, and commercial/venture viability**;
4. **Develop a work program to adapt the company's technology to specific customer requirements**;
5. Deploy capital into the work program, "largely non-dilutive";
6. Evaluate deliverables and transfer the solution to IC partner agencies.
([UT Austin](https://repositories.lib.utexas.edu/bitstreams/57535159-c892-4662-a84a-013330b5f3ed/download); [Belko, AFIT](https://scholar.afit.edu/context/etd/article/4950/viewcontent/AFIT_GAQ_ENV_04M_01_Belko_M_ADA423132.pdf))

Belko's account of the original screening is still the clearest statement of the bar: a proposal must (1) map to a government problem set, then be assessed on (a) uniqueness of the technology, (b) economic viability, and (c) **whether there is a customer within the IC who may have an interest**. Critically: "a company in which In-Q-Tel invests must not only have a product that is useful to the Agency, but it must also have **commercial utility**. Without a commercial audience for the technology, In-Q-Tel will not consider an investment."

IQT's own playbook adds a piece of advice that reads as a requirements list: "get a commercial product, in whatever form it exists, into the hands of stakeholders at the start"; "**start conversations about pricing up front** because the government budgeting process is long"; and "make an enhanced product available long enough for a public-sector customer to do the necessary testing" ([IQT Playbook](https://www.iqt.org/library/inside-the-iqt-playbook-five-keys-to-successful-public-private-tech-partnerships)). IQT states it "reviews over 1,000 startups a year."

### How you get in front of them

Directly: [iqt.org/submit-a-business-plan](https://www.iqt.org/submit-a-business-plan). The form asks for company info, technology description, technical summary, target markets, **current investors**, and **current government customers**, and it screens on stage: "If your company has **venture backing** and technology ready to launch, or is already on the market, we want to hear from you."

**Read the submission terms before submitting.** IQT's form states: "we may share information you submit with the CIA, the Intelligence Community, and others in the US Government… **you should provide only information that you consider non-confidential. Information you submit should not be marked 'Proprietary', 'Confidential'… If your submission is so marked, we will treat it as non-confidential notwithstanding the markings.**"

**Money:** third-party sources put typical IQT investments at $1–4M, with technology development agreements "between $500,000 and $3 million," structured as development-and-licensing agreements, IQT taking a small equity stake and board-observer status. **These figures are third-party and UNVERIFIED against IQT primary sources** — IQT does not publish deal sizes.

**Who it fits:** a venture-backed company with a shipping commercial product and at least one paying non-government customer. **It does not fit a pre-revenue research prototype**, and IQT's own diligence explicitly screens out "conceptual but unproven technology," which it says belongs to DARPA.

**The trap:** treating IQT as a funding source. IQT is a *routing* mechanism — the work program only has value if an IC customer is on the other end, and the customer relationship is what you are actually buying. Companies that take IQT money without an identified end user get an adaptation contract and no revenue. Second trap: the non-confidentiality terms mean the submission is a marketing document, not a technical disclosure. Do not put the kernel design in it.

---

## 8. Service innovation arms: AFWERX, xTech, SOFWERX, NSIN, DIU

### AFWERX / SpaceWERX

The SBIR execution arm of the Department of the Air Force. Post-reauthorization, AFWERX's FY26 posture is **named topics, not open topics**: the FY26 solicitation schedule shows six monthly release cycles (Release 1 pre-release 13 Apr 2026 / open 6 May / close 3 Jun; through Release 6 closing 21 Oct 2026), and the listed opportunities are all specific topics (DAF26BZ01-DV001 Homeland Convoy Counter Drone, DAF26BZ01-DV005 AI Framework for Multimodal Scene Construction, etc.) ([AFWERX post-reauth deck](https://afwerx.com/wp-content/uploads/Post-Reauth-Webinar_CLEARED_AFRL-2026-1966-2.pdf)). A third-party analysis states "there will be a decrease in the number of Open Topic proposals available, with companies advised to consider aligning more tightly to specific priorities" ([BW&CO](https://www.bwcoconsulting.com/fod/afwerx)). **INFERENCE, medium confidence:** the FY26 AFWERX Open Topic is materially narrower than in FY22–FY24; plan for topic-matched submissions, not an open door.

Submissions go through **DSIP** at dodsbirsttr.mil. FY26 focus areas are autonomous mass, C2/battle management, counter-incursion, agile combat & readiness — **none of which are analytic-tradecraft shaped.** The DoW Critical Technology Area "Applied Artificial Intelligence" is the only plausible hook.

### Army xTech

Prize competitions under prize authority, feeding SBIR:
- **xTechSearch 8:** up to 50 finalists at **$2,000** each, up to 20 winners at **$35,000** each plus "the potential opportunity to submit for a Phase I SBIR award of up to $250,000" ([xTechSearch 8](https://xtech.army.mil/competition/xtechsearch-8/)).
- **xTechSearch 9:** "$900,000 in cash prizes and a pathway to $6 million in potential follow-on Army SBIR contract awards" ([xTechSearch 9](https://xtech.army.mil/competition/xtechsearch-9/)).
- **xTechPrime:** "$1M in cash prizes and up to **$28.5M in follow-on awards**"; entry is a **Concept White Paper** with up to $5,000 for advancing, $20,000 team prizes, and small businesses on winning teams eligible for **Direct-to-Phase-II up to $1.9M each** ([xTechPrime](https://xtech.army.mil/announcement/xtechprime-winners-cash-prizes-follow-on-awards/)).

**Who it fits:** anyone — entry cost is a white paper. **The trap:** a $35,000 prize is not revenue and consumes a quarter of a small team's business-development capacity; only enter when the challenge statement genuinely matches, and treat the prize as marketing spend, not as a funding round.

### SOFWERX

"An innovation platform for the United States Special Operations Command as a 501(c)(3)" ([sofwerx.org](https://www.sofwerx.org/)). Engagement modes: Collaboration Events, **Tech Tuesday** ("30-minute presentation slots to showcase capabilities to government stakeholders"), rapid prototyping via "The Foundry," SBIR/STTR support, and USSOCOM technical experimentation events. Participation begins by joining the Ecosystem via a form.

**The trap:** SOFWERX is a *door*, not a *vehicle*. The site does not describe a contracting instrument. Presenting at Tech Tuesday produces awareness; converting it requires a separate SOCOM contracting action. Companies confuse a warm reception with a pipeline.

### NSIN

NSIN's "work was fully incorporated into DIU" in **fall 2024**, creating a unified team ([NSIN](https://nsin.mil/); [Wikipedia summary](https://en.wikipedia.org/wiki/National_Security_Innovation_Network)) — **reported, not independently verified against a DoD memorandum**. Treat NSIN's university/talent programs as a DIU sub-brand rather than a separate acquisition pathway.

### DIU as a front door

CIA's own site lists DIU among its "Affiliated Partners" and states DIU's "streamlined process delivers prototypes to DoD partners, along with scalable revenue opportunities for commercial vendors, **within 12 to 24 months**" ([CIA Technology Collaboration](https://www.cia.gov/tech/tech-collaboration/)). That the CIA points industry at DIU is itself a routing signal.

---

## 9. Tradewinds Solutions Marketplace (CDAO) — the cheapest option in this report

Run by the DoW Chief Digital and Artificial Intelligence Office with the Applied Research Institute. You submit a **5-minute pitch video** plus intake documentation. A peer panel of government, industry and academic SMEs scores it against a published rubric; a Government Selecting Official rates it **awardable / non-awardable**. Awardable solutions are "considered 'post-competitive' under 10 USC 4021, 10 USC 4022, 10 USC 3458, FAR/DFARS Part 35, and DFARS Subpart 212.70, and will be eligible for award of further research, prototyping, procurement for experimental purposes, and even production" ([TSM Announcement](https://replicate.delivery/pbxt/M9lE653pyLnXBk7P0VrmymcjqvQyXKsBBUgNkLz3YN2Y9wdw/Tradewinds%2BMarketplace%2BAnnouncement%2BRevision%2B6.pdf); [Tradewinds](https://www.tradewindai.com/tw-marketplace); [ai.mil](https://www.ai.mil/Industry/Tradewinds/)).

Mechanics from the announcement:
- Continuously open; **monthly collection periods**; assessment results "within 30 days of the end of the relevant collection period."
- Five required video elements: problem addressed; solution and its application; potential DoD impact; **differentiation from other solutions addressing the same problem**; pricing model.
- "Fully negotiable award terms including payment, **intellectual property and data rights license terms**, schedule, milestones, and pricing."
- "Potential for multiple awards with single customer, or across multiple customers with **no funding ceilings or limits to duration** of effort, based on a single video solution submission."
- Awardable videos stay in the marketplace **24 months**, then expire.
- Explicit disclaimer: "**does not guarantee any current or future award.**"

There is also a **SBIR/STTR Aisle** (Phase III-eligible solutions, awardable "without further competition") and a **Prototype Transition Aisle** for completed competitive 10 U.S.C. 4022 prototypes ([Tradewinds Opportunities](https://www.tradewindai.com/tradewinds-opportunity)).

**Who it fits:** literally any AI/data/analytics vendor. Cost is a video and a week of work.

**The trap:** awardable ≠ funded. A third-party integrator claims "roughly 30% of submissions succeed" and quotes ~60 days from kickoff to awardable ([Clipper Defense](https://www.clipperdefense.com/tradewinds-solutions-marketplace)) — **vendor marketing, UNVERIFIED**. The real trap is treating awardability as a milestone: without a program office that has money and a requirement, the listing simply expires in 24 months. Use it as an accelerant behind an existing customer conversation, not as a lead-generation strategy.

---

## 10. DHS SVIP — the fastest small first check

The [Silicon Valley Innovation Program](https://www.dhs.gov/science-and-technology/svip) uses "the Innovation Other Transaction Solicitation (OTS) — SVIP OTS 70RSAT21R00000006 to engage with organizations that do not usually work with the government."

Two different published funding figures exist and should be reconciled before relying on either:
- The main SVIP page: "up to **$2M in non-dilutive funding over 24 months**."
- The [S&T Innovation Programs & Tools booklet](https://www.dhs.gov/sites/default/files/publications/st_innovation_programs_and_tools_booklet.pdf): "up to **$800K over four phases** of funding at **$50–$200K each**, with each phase lasting **three to six months**" — Phase 1 demo proof of concept; Phase 2 pilot-ready prototype; Phase 3 pilot-test in operation; Phase 4 test in various operational scenarios.

**Eligibility is restrictive and favorable to a first-time vendor:** "fewer than 200 employees" and "**not have been a party to any FAR-based contracts and/or federally awarded grants totaling more than $1M in the past 12 months**."

**Speed:** "Award timeframe average is **45 days**" ([SVIP how to apply](https://www.dhs.gov/archive/science-and-technology/svip-how-apply)); FAQs reference a "30- to 45-day window." Process: identify an open topic call → submit application by email to DHS-Silicon-Valley@hq.dhs.gov → **15-minute oral pitch** if selected → OTA.

**The trap:** the [SVIP FAQs](https://www.dhs.gov/science-and-technology/svip-faqs) list mechanical, unforgiving non-compliance reasons: "Total phase value proposed is greater than the funding level assigned by phase," "Total number of pages submitted does not comply with the page count limitations," "Using an incorrect or outdated application," "The application is incomplete — please ensure you complete every section even if you state 'Not-applicable'." And: "If there are no open technical calls, we cannot accept applications." Also: "No" — you cannot skip to a later phase. Submit a week early so a compliance rejection is recoverable.

---

## 11. GSA schedules and IDIQs — necessary later, useless now

| Vehicle | Status | What it takes |
|---|---|---|
| **GSA MAS SIN 54151S** (IT Professional Services) | Always open | **Two years in business** performing the services, verifiable past performance, labor-category structure with defensible rates, mandatory **TDR** under Refresh 31 (2 Apr 2026). Package "commonly runs 200–400 pages"; "**plan for 9–15 months** from kickoff to award" ([third-party guide](https://rfpsnapshot.com/gsa-mas-54151s-requirements-guide) — **not a GSA primary source**) |
| **OASIS+** | **Continuously open, no closing date**; six MACs (Total SB, 8(a), HUBZone, SDVOSB, WOSB, Unrestricted), 13 domains, **no contract ceiling**, rolling awards with "no fixed timeline for award" ([GSA](https://www.gsa.gov/buy-through-us/products-and-services/professional-services/buy-services/oasis-plus/sellers-guide/solicitations-continuously-open), [Fact Sheet](https://www.gsa.gov/system/files/OASIS%2B%20Fact%20Sheet%2002272026.pdf)) | Self-score against the Domain Qualifications Matrix; **qualifying threshold 36 points (SB/socioeconomic), 42/45 (Unrestricted)**; up to five Qualifying Projects per domain, each meeting a minimum Average Annual Value, ongoing ≥6 months or completed within five years ([GSA](https://www.gsa.gov/buy-through-us/products-and-services/professional-services/buy-services/oasis-plus/sellers-guide/do-i-qualify-to-be-an-oasis-vendor)) |
| **Alliant 3** | **Live.** Notice to Proceed issued 10 Mar 2026; PoP to 9 Mar 2031 + one 5-yr option; **no maximum ceiling**, $2,500 minimum guarantee. 133 proposals received; 43 Phase One awards; 76 total planned ([GSA](https://www.gsa.gov/technology/it-contract-vehicles-and-purchasing-programs/gwacs/alliant-3), [SAM.gov](https://sam.gov/workspace/contract/opp/53796105de7a403ea3522166d70a2099/view), [FedScoop](https://fedscoop.com/general-services-administration-alliant-3-contract-award-gwac-governmentwide-acquisition/)) | Closed to new offerors; the door was the 2024–25 RFP |
| **DIA SITE III** | 10-yr IDIQ, **$12.6B**, awarded Mar 2021 to **144 contractors (107 small businesses)**, running to 1 Mar 2031; serves **DIA and NGA** ([DIA](https://www.dia.mil/Business/SITE-III/), [MeriTalk](https://www.meritalk.com/articles/dia-awards-12-6-billion-to-144-contractors-for-site-iii/), [FedScoop](https://fedscoop.com/dia-awards-12-6b-enterprise-contract/)) | **Closed.** The route is subcontracting to one of the 144 holders |
| **NGA Luno A / Luno B** | Luno A: **$290M**, 5-yr, 10 vendors; Luno B: **$200M**, 5-yr, 13 vendors; combined ~$490M for "unclassified commercial analytic service capabilities." Task orders competed full-and-open among selectees ([Luno A](https://www.nga.mil/news/NGA_awards_$290_million_Luno_A_commercial_data_con.html), [Luno B](https://www.nga.mil/news/NGA_announces_selectees_for_$200M_Luno_B_IDIQ.html), [Breaking Defense](https://breakingdefense.com/2025/05/nga-hopes-to-award-up-to-10-luno-commercial-analytics-task-orders-this-year/)) | Pools are set; NGA has stood up a **Rapid Capabilities Office** to "reduce timelines from years or months to weeks or days," with initial focus on "rapid prototyping of commercial AI tools, particularly computer vision systems and **large language models that can automate time-sensitive analytic tasks**," and is pushing its Mentor-Protégé Program and a "small business collider" ([SpaceNews, May 2026](https://spacenews.com/national-geospatial-intelligence-agency-to-open-programs-to-more-vendors/)) |
| **NGA IGAPP** | Continuously open app-delivery vehicle managed by SAIC, feeding the NGA GEOINT App Store; explicitly aimed at "individuals, startups, small businesses, and academia" new to federal work; publishes **Vendor Opportunity Packages** describing what users want ([IGAPP](https://igapp.com/about)) | Low barrier; narrow to app-shaped deliverables |

**The trap common to all of these:** a schedule or IDIQ is a *hunting license*, not a customer. Getting on MAS costs 9–15 months and six figures of proposal labor and produces exactly $0 of revenue by itself; with "over 1,800 contractors holding the SIN," task orders still require full capture. **INFERENCE:** for a company at this stage, the correct sequence is *customer first, vehicle second* — let the first customer's contracting officer tell you which vehicle they want to buy through, and get on that one.

---

## 12. Unsolicited proposals (FAR 15.6) — the pathway that looks easiest and is hardest

[FAR 15.603(c)](https://www.acquisition.gov/far/subpart-15.6) requires a valid unsolicited proposal to be: innovative and unique; independently originated and developed by the offeror; prepared without government supervision, endorsement or direction; include sufficient detail to permit a determination that support would benefit the agency; **not an advance proposal for a known agency requirement** that could be acquired competitively; and **not address a previously published agency requirement**.

FAR 15.607(a) then requires the agency to **return** a proposal when its substance: is available to the government without restriction from another source; **closely resembles a pending competitive acquisition requirement**; does not relate to the agency's mission; or does not demonstrate an innovative and unique method (see the FBI's plain-language restatement at [biz.fbi.gov](https://biz.fbi.gov/fits/unsolicited-proposals)).

FAR 15.607(b): sole-source negotiation may begin only when there is a favorable comprehensive evaluation **and** a J&A under FAR 6.302-1 or 6.3 **and** the sponsoring technical office furnishes funds **and** the CO has complied with synopsis requirements.

Two protections worth knowing: **FAR 15.608** — government personnel may not use proposal data "as the basis, or part of the basis, for a solicitation or in negotiations with other firms" without the offeror's consent; **FAR 15.609** — the offeror may apply a restrictive legend, and agencies must require non-government evaluators to sign written confidentiality agreements.

FAR 15.604(a) also directs agencies toward the alternatives: "Guidance on preferred methods for submitting ideas/concepts to the Government, such as any agency: upcoming solicitations; **Broad Agency Announcements**; Small Business Innovation Research programs…"

**Who it fits:** almost nobody as a first move. **The trap is fatal and specific:** if the CIA has issued a solicitation on this subject — which it has — then a proposal on the same subject "closely resembles a pending competitive acquisition requirement" and **must be returned**. Submitting an unsolicited proposal against a live solicitation topic is the single fastest way to be told no in writing.

---

## 13. The CIA's own front doors (registration is free; do it this month)

| Door | What it is | Notes |
|---|---|---|
| **ALM Vendor Portal (VP-U)** | "industry's access point for acquisition information, new business opportunities, and outreach activity" | Register at the unclassified portal; **Industry Outreach event announcements are posted here** ([Partner with CIA](https://www.cia.gov/partner-with-cia/)) |
| **ARC — Acquisition Resource Center** | "industry's unclassified and classified access point"; posts Business Opportunities, Market Surveys, Solicitations, Industry Events, Capabilities Briefings; lets you "Advertise Capabilities" and "Share Innovative Ideas" | At **https://acq.westfields.net**; **administered by the NRO** (acehelpdesk@westfields.net, 703-230-6300) ([ARC FAQ](https://www.cia.gov/tech/arc-faq/)) |
| **Office of the Procurement Executive (OPE)** | Runs OPE Industry Day, Industry Partner Exchange (IPX), Industry Connections capability briefs to Directorate/Mission Center stakeholders, Strategic Partnerships Events | ([Partner with CIA](https://www.cia.gov/partner-with-cia/)) |
| **Digital Gateway** | "charged with vendor engagement… to drive innovation, understand mission needs, identify unique solutions, and reduce program risk through effective dialogue" | ([Technology Collaboration](https://www.cia.gov/tech/tech-collaboration/)) |
| **CIA Labs** | "a federal laboratory and CIA's in-house research and development arm… builds partnerships and sponsors consortium research projects with universities, labs, and even companies doing research in emerging technology verticals including AI…" | ([Technology Collaboration](https://www.cia.gov/tech/tech-collaboration/)) |
| **Strategic Vendor Management** | DDI / Office of Acquisition Management; maintains an **SVM Vendor Database** (two POCs per company) | ([SVM](https://www.cia.gov/tech/tech-collaboration/strategic-vendor-management/)) |
| **The contact form** | The literal instruction: "Enter keyword – '**private-sector**' in your submission to speed the process… you will receive an acknowledgement and unique Submission Reference ID. **CIA will reply to your submission within 45 days if our partners have interest**" | ([Partner with CIA](https://www.cia.gov/partner-with-cia/)) |

**INFERENCE:** the "45 days *if* our partners have interest" phrasing means silence is the default rejection. There is no debrief. Registering on ARC/VP-U and submitting via the form costs a day and is strictly dominant — but nobody should build a plan on it.

---

## 14. The gates that sit under every pathway

1. **SAM.gov registration + UEI + CAGE.** Required for every vehicle here; Holland & Knight calls it "nuanced and time-consuming." NSTXL lists CAGE + UEI as membership prerequisites.
2. **Facility Clearance (FCL).** [DCSA](https://www.dcsa.mil/FCL/) is unambiguous: "Any facility awarded a classified contract, as the prime or subcontractor, must hold an active FCL"; "**Contractors cannot sponsor themselves for an FCL**"; sponsorship must come from a Government Contracting Activity or a cleared prime, submitted through NISS with a DD Form 254 and justification. DCSA "is unable to provide a timeline"; Cooley's practitioner guide says "typically processing takes **three to six months**… If FOCI mitigation is required, it could add **six months to one year**" ([Cooley GO](https://www.cooleygo.com/facility-security-clearance-basics-a-primer-on-the-process/)). DCSA's own 2023 data: sponsorship packages cycled **1.93 times on average with a 53% rejection rate**; initial/upgrade FCL packages **2.5 times with a 70% rejection rate** ([DCSA news](https://www.dcsa.mil/About-Us/News/Article/Article/3312124/updated-sponsorship-and-facility-clearance-package-submission-procedures/)). **The FCL is downstream of a contract, not upstream of one — you cannot pre-clear yourself into eligibility.**
3. **CMMC.** Level 1 self-assessment is the current floor for many opportunities; **NSTXL requires CMMC Level 2 certification by 10 November 2026 for continued membership**; H&K estimates 6–18 months to achieve Level 2.
4. **Data rights.** Three regimes will be proposed to you and they are not equivalent: SBIR/STTR (DFARS 252.227-7018, 20-year protection then perpetual GPR); noncommercial software (DFARS 252.227-7014); and **commercial computer software**, where "the license customarily provided to the public governs." OT agreements are fully negotiable — DIU's guidebook says terms are "Vendor terms, lightly tailored." **INFERENCE:** for a config-driven platform whose value is the kernel + calibration layer, the correct posture is a commercial EULA for the platform, SBIR data rights on anything developed under a funding agreement, and government purpose rights only on the mission-specific configs.
5. **Foreign ownership/influence.** DIU's Business Intelligence team "prescreens vendor's ownership and capital for foreign influence" before the pitch; SBIR reauthorization now mandates disclosure of "all foreign affiliations, including venture backing and IP licenses."

---

## 15. The phasing recommendation

### The honest read on where this technology sits

**Confirmed by the company's own measurement:** Brier skill vs. base rate tracks evidence quality monotonically across 15,832 simulations (+0.44 / +0.42 / +0.11 / −0.46); abstention gate fires 80/80 on a provably-unanswerable arm and 0–7/80 on answerable ones; byte-identical artifact hashes on seed replay. **Not measured:** real-world forecasting skill.

In the language of DIU's Phase 1 kill-list, that is "Working prototype" ✓ and "live pilot data" ✗. In the language of TRL, that is a **system validated in a simulated environment** — and the NASA guidance on TRL scoring is brutally clear that "TRL of the system cannot be higher than the lowest component TRL," that "**New and/or unique approaches that are implemented in software must also be demonstrated**," and that claiming heritage to work you did not do "only demonstrates that such technology is feasible but **not that this design is at TRL 6**" ([NASA, Common Causes of TRL Weaknesses](https://soma.larc.nasa.gov/SIMPLEx/pdf_files/Common-causes-TRL-Weaknesses-Ver02.pdf)).

### The recommendation

**Primary pathway: a two-step BAA white paper to AFRL Rome Research Site, Information Directorate.** Specifically FA8750-23-S-7008 (AFAR — "Adaptive Fusion, Analysis & Reasoning of multi-source data," $500K–$1.5M typical, open through 29 Aug 2028) with FA8750-23-S-7006 (AI & Next-Gen Distributed C2, $200K–$20M, through 30 Aug 2028) as the alternate.

Why this and not the CIA directly:

1. **It is open, funded, and unclassified.** $25M and ~$99M of announced ceiling respectively, with published per-award bands. No FCL required to start.
2. **Its first gate is a 3-page white paper with a ROM** — the cheapest possible test of whether a government technical POC finds the claim interesting. Cost: one week.
3. **A written response is guaranteed** ("All offerors submitting white papers will be contacted by the Government"). That is more feedback than the CIA contact form, an unsolicited proposal, or a Tradewinds video will ever produce.
4. **AFRL/RI is the Air Force's information/analytics laboratory and the SESS BAA explicitly names "support of the Intelligence Community."** A performance record with AFRL/RI is legible to every buyer on the adjacent list.
5. **BAA proposals are not scored against each other** (FAR 35.016(d)) — you are not competing against Palantir's past performance, only against the program's own goals and its funding.

**Run these five in parallel because they are nearly free:**

| Action | Cost | Why |
|---|---|---|
| Register SAM.gov/UEI/CAGE, ARC (acq.westfields.net), ALM VP-U | days | Prerequisite for everything; ARC is where CIA market surveys post |
| Submit the cia.gov contact form with keyword "**private-sector**" | hours | 45-day reply if there's interest; generates a Submission Reference ID |
| Submit an IQT business plan | days | Non-exclusive; routes to CIA/NSA/NGA/DIA/DHS simultaneously. **Mark nothing proprietary** |
| Submit a 5-minute Tradewinds video | ~1 week | ~60 days to "awardable," post-competition status for 24 months, no ceiling on subsequent awards |
| Join **IWRP** ($250 small) and **C5** ($500, first year waived) | <$1,000/yr | Standing visibility into information-warfare and C4ISR RFS flow |

**Second wave (months 3–9), conditional on finding a named end user:** one SBIR — DoD (DSIP, monthly releases) or NGA (the only IC SBIR participant) or DHS SVIP if an open topic call matches. Prefer **Direct-to-Phase-II if and only if** an end user will sign the customer memorandum; otherwise Phase I. The reason to bother despite the small money is the **20-year DFARS 252.227-7018 data protection period** and the **Phase III no-further-competition bridge**, which is the only mechanism in this landscape that converts a small win into an uncapped, uncompeted follow-on.

**Third wave (months 9–24):** DIU CSO when a matching AOI publishes, and IARPA when a Proposers' Day is announced. Both are episodic; neither is a plan.

**Do not do now:** GSA MAS (needs two years of past performance you don't have and 9–15 months you shouldn't spend), Alliant 3 (closed), SITE III (closed), or an unsolicited proposal to the CIA (returns automatically as resembling a pending competitive acquisition).

### What Phase I must deliver

Phase I has exactly one job: **convert "measured on synthetic oracles" into "measured on real, resolvable outcomes, scored by someone other than us."** Everything else is decoration.

**The core deliverable — a pre-registered, live post-cutoff forecasting evaluation on unclassified data.** Concretely:

1. **Pre-register the question set and scoring plan before any run.** Publish the hash of the question set, the resolution sources, and the scoring code to a timestamped location on day one. This is what makes the result third-party-checkable, and it is the single strongest differentiator against every LLM vendor claiming forecasting skill.
2. **Three evaluation regimes, reported separately, never pooled** — matching the platform's existing `synthetic_oracle | historical_backtest | live_post_cutoff` tag:
   - *synthetic_oracle*: the existing 15,832-run result, reported as-is with its regime tag, as a **construct-validity** result, not a skill result.
   - *historical_backtest*: as-of corpus retrieval with the hard date filter, plus the runtime assertion that throws on any post-as-of evidence reference. **Report the count of leakage-guard violations as a first-class metric** — a measured zero is more persuasive than a claim of "no leakage."
   - *live_post_cutoff*: ~150–300 resolvable socio-political questions on outcome bands, opened after the model's training cutoff, resolving inside the period of performance. This is the only regime that supports a skill claim.
3. **Score with the buyer's own metrics.** Brier as the headline; **Brier skill score against three explicitly named baselines** — (a) the historical base rate, (b) a single-call LLM baseline with no framing/adjudication/calibration layer, (c) a public crowd or market consensus where one exists; **Murphy decomposition** into calibration and resolution (this is the decomposition IARPA's own ACE literature uses); **ECE/MCE with reliability diagrams**; **sharpness**, to prove the system is not buying calibration with hedging; **coverage@N**; **tail recall**; **inter-run stability** across seeds; **Krippendorff's α** across judges.
4. **Report abstention as a two-sided measured quantity.** False-abstention rate on answerable questions and true-abstention rate on unanswerable ones, with the unanswerable arm constructed adversarially by someone outside the team. The INSUFFICIENT_EVIDENCE verdict is the most credible thing in this system to an IC audience — but only if its error rates are measured on questions the team did not design.
5. **An ablation table that proves the architecture earns its cost.** Full system vs. (a) no adjudication panel, (b) no calibration layer (mean instead of weakest-link confidence aggregation), (c) no deterministic kernel (LLM does the simulating), (d) no abstention gate. If the panel and the calibration layer do not move Brier skill and ECE measurably, the buyer will notice before you do.
6. **ICD 203 conformance evidence, not assertion.** The product already separates likelihood and confidence as distinct fields with no `(Judgment) => number` collapse; Phase I should deliver an independent tradecraft review of a sample of finished products against ICD 203's analytic standards, plus the measured **unsupported-assertion rate** and **provenance completeness** on that sample. **INFERENCE:** for this buyer, a measured provenance-completeness number is worth more than another decimal place of Brier.
7. **A human-in-the-loop time-and-accuracy study**, sized 6–12 analysts with IC or equivalent backgrounds, measuring time-to-assessment and assessment quality with and without the system. This is the only deliverable that speaks directly to the solicitation's stated benefit categories (a) increased efficiency and accuracy and (b) reduced time to analyze complex phenomena.
8. **One worked adversary-decision scenario built as the unclassified analogue of the customer's own example.** The customer named Iran/US and critical-infrastructure targeting. Build the unclassified twin: an adversary-decision question expressed as outcome bands over a resolvable quantity, driven by the riskTolerance × escalationPropensity actor profiles, with the full I&W set, key assumptions each carrying its required falsifier, and the red team's bounded-rerun record attached. Deliver it as a finished product, not a demo.
9. **A deployment and classification annex.** Air-gapped operation with no external calls; model-agnostic backend including government-hosted models; the leakage guard operating without internet; the deterministic kernel's seeded PRNG (no wall clock, no `Math.random`) documented as the reproducibility guarantee; and an explicit statement of what changes when the corpus is classified (retrieval adapter swap, config file, no code change — which is the whole point of "a new scenario is a new config file").
10. **A data-rights assertion table and a named transition partner** — see §16.

**The first line of every Phase I deliverable should say what the system already says at runtime:** real-world forecasting skill is not yet measured, and here is the regime tag on every number that follows. **INFERENCE, high confidence:** in a market where every AI vendor overclaims, a system that refuses to pool evaluation regimes and prints its own limitation first is doing the single most differentiating thing available to it. That posture is also exactly what FAR 35.016 peer reviewers and IARPA program managers are trained to reward.

---

## 16. Why white papers get binned

Ordered by how often the government's own guidance names them.

### 1. No named transition partner

The [DARPA BAA Guide](https://www.darpa.mil/sites/default/files/attachment/2024-12/darpa-guide-broad-agency-announcements-research-announcements.pdf) instructs program managers to answer, before a BAA is even written: "**Who are the possible transition partners? Has sustainment been discussed?**" DIU makes it a formal gate: Project Diligence must confirm "Transition Path: Active fielding route + follow-on funding" before the AOI publishes, and GAO reports that in moving to DIU 3.0, DIU is "focusing on the potential transition partner **earlier** in the CSO process" — five of six projects GAO reviewed had pre-award documents identifying a transition path ([GAO-25-106856](https://www.gao.gov/assets/gao-25-106856.pdf)).

The NPS study of AFWERX Phase III found the three government-stated reasons work fails to transition are "wrong organization, no funding available, or no military application" ([NPS-AM-24-191](https://dair.nps.edu/bitstream/123456789/5178/1/NPS-AM-24-191.pdf)).

**Fix:** name a person, an office, and a funding line. "AFRL/RIG, [PM name], with intended transition to [named program]" beats three paragraphs of market analysis. If you cannot name one, say so and propose the Phase I task that identifies one — reviewers respect that more than a fabricated one.

### 2. TRL overclaim

NASA's catalogue of "Common TRL Major Weaknesses" is the best public list of how this fails: "TRL of the system is either not provided or is inadequately supported"; "Only component level TRL assessment is performed and component TRL is either explicitly equated with System Level TRL or System Level TRL assessment is omitted"; "**TRL of the systems cannot be higher than lowest component TRL**"; "Software development is not addressed and only hardware is considered"; "Heritage is claimed to elements designed and built by other institutions not included on the proposing team"; "Statement that institutional evaluation establishes TRL 6 without explanation" ([NASA](https://soma.larc.nasa.gov/SIMPLEx/pdf_files/Common-causes-TRL-Weaknesses-Ver02.pdf)).

DIU's Phase 1 instant-kill triggers say the same thing in commercial language: "Theory slides, no demo or data," "Buzzwords with no proof," "Single-digit improvement at best," "Cosmetic tweak to legacy tech."

**Fix:** state the TRL for the *integrated system in the relevant environment*, not the best component, and state what would have to be true to raise it. For this product: 663 passing tests and a deterministic kernel are component evidence; the system-level claim in an operational IC environment is unvalidated, and saying so converts an overclaim into a credible Phase I objective.

### 3. No measurable evaluation plan

FAR 35.016(e) makes technical merit the primary selection factor, and BAA proposals are categorized only **Selectable / Not Selectable** by peer or scientific review ([BAA Guide, Ch. 8](https://neilsmiller.github.io/Contract_opps_database/files/bf3b59bda4814397b37a3c96c302178e_BAA+Ind+Guide+2025.pdf)). IARPA's ETA framework is explicitly built around "**rigorous assessment of relevant performance**." DIU rewards "Mission impact quantified up front" and "Step-change performance (10×, not 10%)."

**Fix:** state the metric, the baseline, the target delta, and *who scores it*, in the white paper. "Brier skill score ≥ +0.15 against a base-rate baseline on a pre-registered set of 200 post-cutoff resolvable questions, scored by [third party]" is a sentence a peer reviewer can grade. "Improves analytic quality" is not.

### 4. Ignoring the stated evaluation criteria

The BAA Guide: "Proposals are reviewed **solely on the criteria published in the BAA**. The proposal must stand on its own merits as submitted." DIU: each brief "must stand entirely on its own merits — **no cross-references, no assumed context** — and tie explicitly to the AOI-defined gap," and evaluators apply the three factors "in strict order: Relevance → Innovation → Technical Merit." DARPA: requests for clarification "do not include giving a proposer a chance to provide substantive information that, per the BAA, should have been included."

Mechanical variants of this kill submissions outright: the BAA Guide states that if a submittal "exceeds the [page limit]" the excess is "not considered in the review"; SVIP rejects for page-count non-compliance, using an outdated application form, or leaving a section blank instead of writing "N/A"; NSTXL notes "Late or incomplete submissions are often disqualified."

**Fix:** write the white paper against the BAA's own section headings and evaluation-factor order, and have someone who has not seen the technology check compliance against the instructions before submission.

### 5. Security and classification hand-waving

DARPA's pre-BAA checklist asks: "Are there security clearance requirements? If so, what level will be required and **when** (at time of preproposal or proposal submission, time of award, later phase of the program)? Are there any compilation concerns?" The Air Force white-paper format requires classified submitters to state, in Section A, "Classified level at which company is cleared, contractor address for forwarding classified material, cognizant security office, and offeror's security officer's name."

A company with no FCL that writes "we will process classified data" has made an unexecutable promise — DCSA cannot clear you without a sponsor and a DD-254, and 53% of sponsorship packages get rejected on first submission.

**Fix:** state the security posture truthfully and turn it into an advantage: "No FCL currently held; the Phase I effort is scoped entirely to unclassified data. The architecture requires no code change to operate on classified corpora — the retrieval adapter and as-of date filter are configuration. We request sponsorship for a Secret FCL at Phase II if the government elects to proceed." That is a plan. "Classification is not an issue for our platform" is a bin.

### 6. No data-rights position

DARPA's checklist: "Are there any anticipated intellectual property issues (e.g., **open source encouraged to facilitate transition**)?" DIU's Business Clearance Memorandum requires a documented "Intellectual Property & Data Rights" discussion. Holland & Knight warns offerors to "assess IP/data rights involvement and determine optimal timing to assert restrictions." FAR 15.609 requires the restrictive legend to be applied by the offeror — it is not automatic — and H&K notes proprietary/FOIA-exempt marking under 5 U.S.C. § 552(b)(4) is likewise "essential, not automatic."

A silent white paper invites the government to assume unlimited rights; an over-restrictive one invites a reviewer to conclude the technology cannot transition.

**Fix:** include a three-line assertion table — what is commercial (platform, kernel, calibration layer: commercial license, developed exclusively at private expense), what will be developed under the agreement (mission configs, adapters: government purpose rights), and what the government gets unlimited rights in (final reports, metrics, evaluation artifacts). For SBIR, mark with the DFARS 252.227-7018 legend including the 20-year expiration date, per the clause's explicit marking instruction.

### 7. Two that don't appear on official lists but appear in every debrief

- **Solving a problem the office does not have.** DIU's top kill trigger is "Generic tech searching for a problem" and "Solves a different issue than the one asked." A general-purpose adjudication platform pitched as general-purpose reads as unfocused; the same platform pitched as "the abstention gate and calibration layer for [this office's named analytic problem]" reads as targeted.
- **No pre-submission contact.** FAR 15.604(a): "Preliminary contact with agency technical or other appropriate personnel before preparing a detailed unsolicited proposal… may save considerable time and effort for both parties." Every AFRL/RI BAA names a Technical Point of Contact and directs that "All white paper submissions and any questions of a technical nature shall be directed to the cognizant TPOC." **INFERENCE:** a five-minute conversation with the TPOC before writing costs nothing and is the highest-leverage act available on the BAA pathway; companies that skip it write into a void.

---

## 17. What I could not verify

| Item | Status |
|---|---|
| Exact NGA wording on being "the only member of the IC that participates" in SBIR | Reported via search indexing of [nga.mil](https://www.nga.mil/resources/SBIR_STTR_PROGRAM_GUIDANCE.html); page returned HTTP 403 to direct fetch. Statutory exemption itself is **CONFIRMED** at 15 U.S.C. § 638(e)(2) |
| Whether CIA (an IC agency, excluded from "Federal agency" in § 638) may award an SBIR Phase III under § 638(r)(4) | **UNVERIFIED — material. Needs procurement counsel.** |
| IWRP 3 membership fees | AiDA lists $750/$250/free; may reflect IWRP 2. **UNVERIFIED** for IWRP 3 |
| In-Q-Tel deal sizes ($1–4M; TDA $500K–$3M) | Third-party only; IQT publishes no figures. **UNVERIFIED** |
| Tradewinds ~30% acceptance rate | Vendor-consultant marketing claim. **UNVERIFIED** |
| AFWERX Open Topic volume reduction in FY26 | **INFERENCE** from the AFWERX FY26 deck (named topics only) plus a third-party analysis; no primary AFWERX statement of reduction found |
| DHS SVIP funding cap ($2M/24 months vs. $800K over four phases) | Two DHS sources conflict; the $800K/four-phase figure comes from an undated booklet, the $2M figure from the current program page. **Confirm with the current OTS on SAM.gov before proposing** |
| AFRL/RI BAA current amendment status | SAM.gov listings show amendments through Jul 2026 (e.g., FA8750-23-S-7006 Amend 13 adding TA11). **Re-read the current conformed attachment before drafting** — technical areas are added and removed |
| DIU FY24/FY25 award statistics | Only FY23 annual report and GAO's FY16–23 analysis were retrievable. FY24/FY25 figures **not verified** |

---

## Sources

[FAR 35.016](https://www.acquisition.gov/far/35.016) · [FAR Subpart 15.6](https://www.acquisition.gov/far/subpart-15.6) · [AF BAA Guide for Industry v2.2 (Jan 2025)](https://neilsmiller.github.io/Contract_opps_database/files/bf3b59bda4814397b37a3c96c302178e_BAA+Ind+Guide+2025.pdf) · [AFRL BAA Guide 2020](https://www.afrl.af.mil/Portals/90/Documents/HQ/BAA%20Ind%20Guide%202020.pdf) · [DARPA BAA/RA Guide](https://www.darpa.mil/sites/default/files/attachment/2024-12/darpa-guide-broad-agency-announcements-research-announcements.pdf) · [BARDA BAA vs RFP briefing](https://www.medicalcountermeasures.gov/media/35770/cohen.baa_and_rfp.pdf) · AFRL/RI BAAs: [FA8750-23-S-7006](https://sam.gov/workspace/contract/opp/5cd1dec3f39b44eb87cae4bd15984120/view), [FA8750-23-S-7008](https://sam.gov/workspace/contract/opp/6cf7570de9eb4429895bd99266b15c03/view), [FA8750-25-S-7001](https://sam.gov/opp/332267b22ce548e3a06ad1a1400e708f/view), [FA8750-23-S-7005](https://sam.gov/opp/e2525b7295334755924422f1c9ffe08c/view), [FA8750-21-S-7006](https://sam.gov/opp/f6dac217c58545578b6dff242335e997/view) · [DIU CSO Guidebook 2026](https://s3.us-gov-west-1.amazonaws.com/publicdocs.diu.mil/CSO-Guide-2026.pdf) · [DIU Quick Look](https://www.secnav.navy.mil/rda/DASN-P/Shared%20Documents/DIU%20Quick%20Look%20-%20Acquisition%20.pdf) · [DIU FY23 Annual Report](https://s3.us-gov-west-1.amazonaws.com/publicdocs.diu.mil/DIU_Annual_Report_FY2023.pdf) · [DIU FY22 Year-in-Review](https://www.diu.mil/fy22-year-in-review) · [GAO-25-106856 (DIU)](https://www.gao.gov/assets/gao-25-106856.pdf) · [Holland & Knight, Offeror's Legal Guide to CSOs](https://www.hklaw.com/en/insights/publications/2026/03/an-offerors-legal-guide-to-commercial-solutions-openings) · [MITRE AiDA — Existing OT Consortia](https://aida.mitre.org/ota/existing-ota-consortia/) · [NSTXL — How to Join an OTA Consortium](https://nstxl.org/how-to-join-an-ota-consortium/) · [NSTXL — Anatomy of an RFS](https://nstxl.org/request-for-solutions-anatomy-of-an-rfs/) · [S²MARTS](https://nstxl.org/s2marts-ota/) · [S2MARTS Membership](https://s2marts.org/membership/) · [ATI — IWRP 2](https://www.ati.org/news/niwc-atlantic-awards-information-warfare-research-project-2-to-ati/) · [IWRP 3 (OrangeSlices)](https://orangeslices.ai/niwc-atlantic-awards-ota-to-advanced-technology-international-ati-to-manage-the-information-warfare-research-project-iwrp-3-consortium-for-10-years/) · [DVIDS — IWRP 2 award](https://www.dvidshub.net/news/410658/niwc-atlantic-awards-information-warfare-research-project-2-advanced-technology-international) · [C4ISRNET — IWRP ceiling increase](https://www.c4isrnet.com/information-warfare/2020/08/18/navy-information-warfare-project-received-400-million-funding-boost/) · [C5 Consortium](https://cmgnetworks.org/c5-overview/) · [15 U.S.C. § 638 (House)](https://uscode.house.gov/view.xhtml?req=%28title%3A15+section%3A638+edition%3Aprelim%29) · [15 U.S.C. § 638 (LII)](https://www.law.cornell.edu/uscode/text/15/638) · [SBIR — About](https://www.sbir.gov/about) · [SBIR — Participating Agencies](https://www.sbir.gov/participating-agencies) · [SBIR — Policies](https://www.sbir.gov/about/policies) · [Crowell — SBIR/STTR Reauthorized](https://www.crowell.com/en/insights/client-alerts/sbirsttr-programs-reauthorized-after-six-month-lapse) · [Crowell — 20-Year SBIR Data Protection](https://www.crowell.com/en/insights/client-alerts/final-dod-rule-codifies-20-year-sbir-data-protection-period-and-other-sbir-program-protections) · [DFARS 252.227-7018](https://acquisition.gov/dfars/252.227-7018-rights-other-commercial-technical-data-and-computer-software%E2%80%94small-business-innovation-research-program-and-small-business-technology-transfer-program.) · [DFARS 252.227-7018 (Cornell)](https://www.law.cornell.edu/cfr/text/48/252.227-7018) · [DoW OSBI — Data Rights](https://www.defensesbirsttr.mil/Data-Rights/) · [DOE Phase III Provisions](https://science.osti.gov/-/media/sbir/pdf/Phase-III-Guidance/Phase-III-Provisions-2022_2_27.pdf) · [NASA Phase III Guide](https://www.nasa.gov/wp-content/uploads/2024/01/phase-iii-guide-external-022624.pdf) · [Army SBIR Phase III](https://armysbir.army.mil/phase/phase-iii/) · [NPS — SBIR/STTR Phase III Transition Barriers](https://dair.nps.edu/bitstream/123456789/5178/1/NPS-AM-24-191.pdf) · [AFWERX Post-Reauthorization deck](https://afwerx.com/wp-content/uploads/Post-Reauth-Webinar_CLEARED_AFRL-2026-1966-2.pdf) · [AFWERX Reauthorization Q&A](https://afwerx.com/wp-content/uploads/26-0423-SBIR_STTR-Reauthorization-Webinar-QA-_Final-1.pdf) · [AFRL — AFWERX/SpaceWERX new solicitations](https://www.afrl.af.mil/News/Article-Display/Article/4473004/afwerx-spacewerx-open-new-sbirsttr-solicitations-following-reauthorization/) · [NGA SBIR/STTR Program Guidance](https://www.nga.mil/resources/SBIR_STTR_PROGRAM_GUIDANCE.html) · [IARPA — Engage With Us](https://www.iarpa.gov/engage-with-us) · [IARPA — Seedlings](https://www.iarpa.gov/engage-with-us/seedlings) · [IARPA — Proposers' Days](https://www.iarpa.gov/engage-with-us/proposers-days) · [IARPA — Open R&D Opportunities](https://www.iarpa.gov/engage-with-us/open-r-d-opportunities) · [IARPA — Five ETA programs](https://www.iarpa.gov/newsroom/article/iarpa-releases-five-new-innovation-programs-to-enhance-national-security-capabilities) · [IARPA ETA Proposers' Day](https://www.iarpa.gov/newsroom/article/iarpa-eta-proposers-day-arcade-cosmic-decipher-locus-moves-jan-7-2026) · [IARPA ACE](https://www.iarpa.gov/research-programs/ace) · [IARPA HFC](https://www.iarpa.gov/research-programs/hfc) · [IARPA FOCUS](https://www.iarpa.gov/research-programs/focus) · [Mellers et al., Psychological Strategies for Winning a Forecasting Tournament](https://faculty.wharton.upenn.edu/wp-content/uploads/2015/07/2014---psychological-strategies-for-winning-a-tournament.pdf) · [Moore et al., Confidence Calibration in a Multiyear Geopolitical Forecasting Competition](https://escholarship.org/content/qt1700r340/qt1700r340.pdf) · [Merkle, Weighted Brier Score Decompositions](https://www.cambridge.org/core/journals/judgment-and-decision-making/article/weighted-brier-score-decompositions-for-topically-heterogenous-forecasting-tournaments/8172E04F2DBC601DA5D953D4685CA346) · [IQT](https://www.iqt.org/) · [IQT — Submit a Business Plan](https://www.iqt.org/submit-a-business-plan) · [IQT Playbook](https://www.iqt.org/library/inside-the-iqt-playbook-five-keys-to-successful-public-private-tech-partnerships) · [Belko, Government Venture Capital: A Case Study of the In-Q-Tel Model (AFIT)](https://scholar.afit.edu/context/etd/article/4950/viewcontent/AFIT_GAQ_ENV_04M_01_Belko_M_ADA423132.pdf) · [UT Austin — Bridging the Gap Between Silicon Valley and the Capital](https://repositories.lib.utexas.edu/bitstreams/57535159-c892-4662-a84a-013330b5f3ed/download) · [DHS S&T — IQT](https://www.dhs.gov/science-and-technology/iqt) · [CIA — Partner with CIA](https://www.cia.gov/partner-with-cia/) · [CIA — Technology Collaboration](https://www.cia.gov/tech/tech-collaboration/) · [CIA — ARC FAQ](https://www.cia.gov/tech/arc-faq/) · [CIA — Strategic Vendor Management](https://www.cia.gov/tech/tech-collaboration/strategic-vendor-management/) · [FBI — Unsolicited Proposals Instructions](https://biz.fbi.gov/fits/unsolicited-proposals) · [DCSA — Facility Clearances](https://www.dcsa.mil/FCL/) · [DCSA — Updated FCL sponsorship procedures](https://www.dcsa.mil/About-Us/News/Article/Article/3312124/updated-sponsorship-and-facility-clearance-package-submission-procedures/) · [Cooley GO — FCL Primer](https://www.cooleygo.com/facility-security-clearance-basics-a-primer-on-the-process/) · [DHS SVIP](https://www.dhs.gov/science-and-technology/svip) · [DHS S&T Innovation Programs & Tools booklet](https://www.dhs.gov/sites/default/files/publications/st_innovation_programs_and_tools_booklet.pdf) · [SVIP — How to Apply](https://www.dhs.gov/archive/science-and-technology/svip-how-apply) · [SVIP FAQs](https://www.dhs.gov/science-and-technology/svip-faqs) · [Tradewinds Marketplace](https://www.tradewindai.com/tw-marketplace) · [Tradewinds Opportunities](https://www.tradewindai.com/tradewinds-opportunity) · [TSM Announcement Rev. 6](https://replicate.delivery/pbxt/M9lE653pyLnXBk7P0VrmymcjqvQyXKsBBUgNkLz3YN2Y9wdw/Tradewinds%2BMarketplace%2BAnnouncement%2BRevision%2B6.pdf) · [ai.mil — Tradewinds](https://www.ai.mil/Industry/Tradewinds/) · [xTechSearch 8](https://xtech.army.mil/competition/xtechsearch-8/) · [xTechSearch 9](https://xtech.army.mil/competition/xtechsearch-9/) · [xTechPrime](https://xtech.army.mil/announcement/xtechprime-winners-cash-prizes-follow-on-awards/) · [SOFWERX](https://www.sofwerx.org/) · [NSIN](https://nsin.mil/) · [GSA OASIS+ — Continuously Open Solicitations](https://www.gsa.gov/buy-through-us/products-and-services/professional-services/buy-services/oasis-plus/sellers-guide/solicitations-continuously-open) · [GSA OASIS+ — Do I Qualify](https://www.gsa.gov/buy-through-us/products-and-services/professional-services/buy-services/oasis-plus/sellers-guide/do-i-qualify-to-be-an-oasis-vendor) · [GSA OASIS+ Fact Sheet](https://www.gsa.gov/system/files/OASIS%2B%20Fact%20Sheet%2002272026.pdf) · [GSA Alliant 3](https://www.gsa.gov/technology/it-contract-vehicles-and-purchasing-programs/gwacs/alliant-3) · [Alliant 3 RFP / award notices (SAM.gov)](https://sam.gov/workspace/contract/opp/53796105de7a403ea3522166d70a2099/view) · [FedScoop — Alliant 3 first awards](https://fedscoop.com/general-services-administration-alliant-3-contract-award-gwac-governmentwide-acquisition/) · [DIA SITE III](https://www.dia.mil/Business/SITE-III/) · [MeriTalk — SITE III](https://www.meritalk.com/articles/dia-awards-12-6-billion-to-144-contractors-for-site-iii/) · [FedScoop — SITE III](https://fedscoop.com/dia-awards-12-6b-enterprise-contract/) · [NGA Luno A](https://www.nga.mil/news/NGA_awards_$290_million_Luno_A_commercial_data_con.html) · [NGA Luno B](https://www.nga.mil/news/NGA_announces_selectees_for_$200M_Luno_B_IDIQ.html) · [NGA Luno delivery orders](https://www.nga.mil/news/NGA_announces_new_Luno_A_and_Luno_B_delivery_order.html) · [Breaking Defense — Luno task orders](https://breakingdefense.com/2025/05/nga-hopes-to-award-up-to-10-luno-commercial-analytics-task-orders-this-year/) · [SpaceNews — NGA Rapid Capabilities Office](https://spacenews.com/national-geospatial-intelligence-agency-to-open-programs-to-more-vendors/) · [IGAPP](https://igapp.com/about) · [NASA — Common Causes of TRL Weaknesses](https://soma.larc.nasa.gov/SIMPLEx/pdf_files/Common-causes-TRL-Weaknesses-Ver02.pdf) · [GAO-06-883 — DoD Technology Transition](https://www.gao.gov/products/gao-06-883)