# Compliance, Classification and Evaluation Reality
## What a simulate-and-adjudicate analytic platform must satisfy to be credible and deployable to the CIA and adjacent buyers

**Research date:** 10 August 2026. Every factual claim carries a URL. Claims I could not verify against a primary source are marked **UNVERIFIED**. Inferences about how a rule applies to this specific architecture are marked **INFERENCE**.

---

## 0. Bottom line up front

Five findings dominate everything else in this report:

1. **The IC already has a directive that this architecture was, by accident, built to satisfy.** ICD 505 (*Artificial Intelligence*, signed 17 Jan 2025) requires AI provenance tracked in an IC AI model registry, auditability "reviewable and verifiable by IC element personnel," human accountability for every judgment, a watermark on AI-influenced products, and — critically — that "IC AI shall be designed and deployed to enable IC personnel to adhere to analytic standards, including those established in ICD 203 and ICD 206." A deterministic seeded kernel producing byte-identical artifact hashes is the strongest available technical answer to "auditable and verifiable." ([ICD 505](https://www.dni.gov/files/documents/ICD/ICD-505-Artificial-Intelligence.pdf))

2. **ICD 203 Tradecraft Standard 8 is in direct tension with the abstention gate, and that tension is the single sharpest thing to get right.** ICD 203 says products "should not avoid difficult judgments in order to minimize the risk of being wrong." An INSUFFICIENT_EVIDENCE verdict is prima facie a violation of Standard 8 unless its false-abstention rate is *measured*. The measured 80/80 vs 0–7/80 result is not a nice-to-have; it is the compliance argument. ([ICD 203](https://irp.fas.org/dni/icd/icd-203.pdf), text extracted below)

3. **The governing national-security AI policy changed three months ago and the implementing artifacts do not exist yet.** NSM-25 (Oct 2024) was rescinded and replaced by **NSPM-11**, signed 5 June 2026. The standardized national-security **TEVV methodologies** it orders are due to the White House ~3 October 2026, and the CNSS/OMB **AI governance policy for national security systems** was due ~3 September 2026. ICD 505 §D.5.b still textually incorporates "the risk management framework, AI use restrictions, and minimum risk management practices established in the NSM-25 and the AI Framework" — a rescinded document. That is a live, citable governance gap. ([NSPM-11](https://www.whitehouse.gov/presidential-actions/2026/06/national-security-presidential-memorandum-nspm-11/); [govinfo PDF](https://www.govinfo.gov/content/pkg/DCPD-202600387/pdf/DCPD-202600387.pdf))

4. **Model portability is now a hard requirement, not an architectural preference.** Between February and August 2026 the U.S. Government attempted to remove one frontier vendor from every federal and defense-industrial network; the designation is partly enjoined, partly in force, and the wind-down is proceeding anyway with a 29–30 September 2026 removal deadline. Any system whose value is welded to one model provider is one Truth Social post away from being un-deployable. ([Reuters, 27 Feb 2026](https://www.reuters.com/world/us/trump-says-he-is-directing-federal-agencies-cease-use-anthropic-technology-2026-02-27/); [Mayer Brown, 15 Jul 2026](https://www.mayerbrown.com/en/insights/publications/2026/07/dows-anthropic-ban-goes-live-a-confusing-patchwork-of-certification-demands-for-contractors); [MeriTalk, 31 Jul 2026](https://www.meritalk.com/articles/judge-questions-pentagon-evidence-behind-anthropic-supply-chain-risk-designation/))

5. **The right T&E regime for this product is not "AI T&E" — it is M&S VV&A.** DoDI 5000.61 and DoDM 5000.102 require models and simulations used to support DoD decisions to be *accredited for a specific intended use*, and DoDM 5000.102 states flatly that "**M&S may not be validated using data which was used to create, fit, or train it**." That is the government's own words for the leakage guard already implemented. ([DoDI 5000.61](https://pdf4pro.com/file/8a5d5/Portals_54_Documents_DD_issuances_dodi_500061p.pdf.pdf); [DoDM 5000.102, 9 Dec 2024](https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodm/5000102m.PDF))

---

# PART 1 — ANALYTIC STANDARDS

## 1.1 ICD 203 — Analytic Standards (the governing document)

**Status:** Signed 2 January 2015 by DNI James Clapper, superseding the 21 June 2007 version. A technical amendment was applied conforming to DNI Memorandum ES 2022-01273 (signed 22 Aug 2022), designating the ODNI Analytic Ombuds as head of the IC Analytic Ombuds Community of Practice reporting to the DD/MI. The University of Virginia's IC data policy reference guide lists ICD 203 as "Revised 2023." ([ICD 203 as amended](https://irp.fas.org/dni/icd/icd-203.pdf); [IC Data Policy Map, UVA](https://nationalsecurity.virginia.edu/sites/default/files/files/2026-04/intelligence_community_data_policy_map_and_reference_guide.pdf))

**Authority chain:** National Security Act of 1947; IRTPA 2004; EO 12333; PPD-28. The statutory root is IRTPA §1019, codified at **50 U.S.C. §3364**, which requires the DNI to ensure finished intelligence is "timely, objective, independent of political considerations, based upon all sources of available intelligence, and employ the standards of proper analytic tradecraft," and to perform regular detailed product reviews with an **annual report to the congressional intelligence committees not later than December 1**. ([50 U.S.C. §3364](https://uscode.house.gov/view.xhtml?req=%28title%3A50+section%3A3364+edition%3Aprelim%29))

### The five Analytic Standards

Verbatim from the directive, §D.6:

- **a. Objective** — "Analysts must perform their functions with objectivity and with awareness of their own assumptions and reasoning. They must employ reasoning techniques and practical mechanisms that reveal and mitigate bias."
- **b. Independent of political consideration** — "Analytic assessments must not be distorted by, nor shaped for, advocacy of a particular audience, agenda, or policy viewpoint."
- **c. Timely** — "Analysis must be disseminated in time for it to be actionable by customers."
- **d. Based on all available sources of intelligence information** — "Analytic elements should identify and address critical information gaps."
- **e. Implements and exhibits Analytic Tradecraft Standards** — the nine below.

### The nine Analytic Tradecraft Standards, mapped to what this system must emit

| # | ICD 203 Tradecraft Standard | What the directive actually demands | What the platform must produce |
|---|---|---|---|
| 1 | Properly describes quality and credibility of underlying sources, data, **and methodologies** | Identify sources *and methodologies*; use ICD 206 source descriptors; source summary statements "strongly encouraged" | Per-claim provenance record **plus** a methodology descriptor: kernel version, seed, actor-profile parameters (riskTolerance, escalationPropensity), model+version. The word "methodologies" is in the standard — a simulation *is* a methodology and must be described |
| 2 | Properly expresses and explains uncertainties associated with major analytic judgments | Likelihood **and** confidence, causes of uncertainty, how uncertainty affects analysis, and "as appropriate, products should identify indicators that would alter the levels of uncertainty" | BLUF with separate likelihood/confidence fields + Indicators & Warnings. The prohibition on combining them in one sentence must be enforced at render time, not by prompt |
| 3 | Properly distinguishes between underlying intelligence information and analysts' assumptions and judgments | "Products should state assumptions explicitly when they serve as the linchpin of an argument"; "explain the implications for judgments if assumptions prove to be incorrect"; "identify indicators that, if detected, would alter judgments" | Key-assumptions block with **required falsifier** — this is a superset of what the standard demands, and is defensible as such |
| 4 | Incorporates analysis of alternatives | "systematic evaluation of differing hypotheses"; "particularly important when major judgments must contend with significant uncertainties, or complexity (e.g., forecasting future trends), or when low probability events could produce high-impact results" | The Framer's N mutually-exclusive outcome bands + the ACH panel. Note the directive's own language names *forecasting future trends* as the case where AoA matters most |
| 5 | Demonstrates customer relevance and addresses implications | Prospects, context, threats, factors affecting opportunities for action | The "response options" framing the solicitation asked for |
| 6 | Uses clear and logical argumentation | Main analytic message up front; internally consistent; acknowledge contrary information | BLUF; contradiction precision/recall metric is a machine-checkable proxy for "internally consistent" |
| 7 | Explains change to or consistency of analytic judgments | State how judgments differ from previous analysis; "avoid using boilerplate language"; "Significant differences in analytic judgment, such as between two IC analytic elements, should be fully considered and brought to the attention of customers" | Inter-run stability metric + a diff against prior runs of the same question config. Devil's advocate / red team output is the machine analogue of "significant differences … brought to the attention of customers" |
| 8 | **Makes accurate judgments and assessments** | "should present all judgments that would be useful to customers, and **should not avoid difficult judgments in order to minimize the risk of being wrong**"; "express judgments as clearly and precisely as possible, reducing ambiguity by addressing the likelihood, timing, and nature of the outcome" | **This is the standard the abstention gate has to survive.** See §1.2 |
| 9 | Incorporates effective visual information where appropriate | Visual info to clarify the analytic message; "Analytic content in visual information should also adhere to other analytic tradecraft standards" | Reliability diagrams and ensemble-diversity plots are analytic content and are themselves subject to standards 1–8 |

### The probability lexicon (verbatim table, §D.6.e.(2)(a))

An analytic product **must** use one of these two rows:

| almost no chance | very unlikely | unlikely | roughly even chance | likely | very likely | almost certain(ly) |
|---|---|---|---|---|---|---|
| remote | highly improbable | improbable | roughly even odds | probable | highly probable | nearly certain |
| **01–05%** | **05–20%** | **20–45%** | **45–55%** | **55–80%** | **80–95%** | **95–99%** |

"Analysts are strongly encouraged not to mix terms from different rows. Products that do mix terms must include a disclaimer clearly noting the terms indicate the same assessment of probability."

### The likelihood/confidence separation rule (verbatim, §D.6.e.(2)(b))

> "To avoid confusion, products that express an analyst's confidence in an assessment or judgment using a 'confidence level' (e.g., 'high confidence') **must not combine a confidence level and a degree of likelihood, which refers to an event or development, in the same sentence**."

**INFERENCE:** The architecture's claim that there is "structurally no function of type `(Judgment) => number`" is the strongest possible implementation of this rule — it makes the violation *unrepresentable* rather than merely discouraged. This is a differentiator worth stating in exactly those terms, because every competitor implements it as a prompt instruction and every prompt instruction fails some fraction of the time.

**A caution on the lexicon.** The 7-bin lexicon is a compliance requirement and an accuracy cost. Friedman, Baker, Mellers, Tetlock & Zeckhauser, analysing 764,448 forecasts from IARPA's ACE program, found that "rounding forecasts to seven bins according to current DNI guidance reduces performance on **72 percent** of questions in our data set" (p<.001). ([NBER paper](https://conference.nber.org/confer/2015/SI2015/PENS/Friedman_Baker_Mellers_Tetlock_Zeckhauser.pdf))

**INFERENCE / design requirement:** the system must retain the underlying continuous probability in the artifact for Brier/ECE scoring, and emit the ICD 203 bin only at the product surface. Scoring the binned value would import a measured 72%-of-questions accuracy penalty into your own metrics. State this explicitly — it is exactly the kind of technical judgment that signals you have read the directive rather than skimmed it.

## 1.2 The Standard 8 problem — abstention vs. "do not avoid difficult judgments"

This deserves its own section because it is the most likely place a government reviewer pushes back.

ICD 203 Standard 8, verbatim: *"analytic products should present all judgments that would be useful to customers, and should not avoid difficult judgments in order to minimize the risk of being wrong."*

A first-class INSUFFICIENT_EVIDENCE verdict looks, on its face, like institutionalised hedging — precisely what Standard 8 forbids. Three defences, in descending strength:

1. **The false-abstention rate is measured, on a benchmark, and reported.** 80/80 abstention on a provably-unanswerable arm and 0–7/80 on answerable arms is a *measured* discrimination claim. Standard 8 forbids avoiding difficult judgments; it does not forbid declining to answer questions that are not answerable from the evidence — and it is silent on how you would ever know the difference. This system knows the difference and can show its work. No competitor and no human review board can produce that number.
2. **ICD 203 Standard 2 requires products to "note causes of uncertainty (e.g., type, currency, and amount of information, knowledge gaps…)."** An abstention with a named evidence gap is Standard-2 compliance, not Standard-8 evasion.
3. **The abstention gate runs *before* scoring**, so it cannot be used to launder a bad forecast into a non-forecast after the fact. That ordering is a structural anti-gaming property and should be described as one.

**Do not** present abstention as a safety feature. Present it as a *measured discrimination capability* whose error rates in both directions are reported. Framed as safety, it reads as Standard 8 non-compliance; framed as measurement, it reads as the only system in the field that can tell an unanswerable question from a hard one.

## 1.3 ICD 206 — Sourcing Requirements for Disseminated Analytic Products

**Status:** 2015 revision, superseding the 17 October 2007 version. ([full text extracted from the combined ICD PDF](https://www.bmbs.org/salamanca/readings/ODNI_ICDs_203-206-208.pdf))

**Scope trap:** ICD 206 applies to *"covered analytic products"* — a subset designated by IC elements in consultation with the DDNI/II and maintained in a central listing. Not every output is covered. But per ICD 208 §D.2.c(2), "**All** analytic products shall employ proper sourcing in accordance with ICD 206."

**Four sourcing mechanisms, and what each requires:**

**(a) Source Reference Citation (SRC)** — mandatory. Sequentially numbered endnotes keyed to superscripts. Critically:

> "An SRC shall be generated each time a source is directly cited in product text (e.g., 'according to …') **or a specific aspect of analysis (i.e., judgment, assessment, estimate, alternative hypothesis or view, confidence level) depends on a source**."

Note the enumerated list includes **alternative hypothesis** and **confidence level**. In this architecture, every hypothesis band and every confidence assignment is an "aspect of analysis" requiring its own SRC. The nine required SRC elements are: portion marking; information originator/author/producer/owner; an unambiguous source identifier; title (with volume/issue, and title classification if included); date of issuance/publication/posting (or date of online access if posting date unknown); page number if applicable; classification of the extracted information; overall classification of the source document; and a source descriptor.

**(b) Appended Reference Citation (ARC)** — optional; for supplemental/background material that does not support a specific outcome of analysis. Explicitly: "ARCs are an appropriate method for identifying insights or other data gleaned from **analytic outreach**." **INFERENCE:** panel deliberation transcripts, devil's-advocate memos, and premortem outputs that inform but do not directly support a judgment are naturally ARC material — this is where the adjudication panel's working product belongs in a compliant product.

**(c) Source descriptor** — a narrative on quality/credibility factors: "accuracy and completeness, possible denial and deception, age and continued currency of information, and technical elements of collection as well as source access, validation, motivation, possible bias, or expertise." Analysts may devise their own descriptors for PAI not obtained from an IC open-source report.

**(d) Source summary statement** — strongly encouraged; "should cover strengths and weaknesses of the source base, which sources are most important to key judgments, what sources are meaningfully corroborative or conflicting."

**Retention rules that bind the artifact store:**

> "If citing a source that is dynamic (e.g., from an Internet posting), ephemeral (e.g., an analyst phone conversation), or not subject to an IC element's policy for systematic storage for analyst access (e.g., a chat session transcript or briefing), **a record of the source shall be preserved for retention by the IC element producing the covered analytic product for at least one year**. … For products with a specified time horizon … applicable source information shall be retained for the period of the time horizon **or five years, whichever is shorter**."

**INFERENCE — this is a direct architectural requirement.** An as-of corpus snapshot is not merely a leakage guard; under ICD 206 §D.5 it is *the record of source* that must be preserved for at least one year, and for forecast products, for the forecast horizon or five years. The as-of retrieval design already satisfies a retention mandate the buyer has to meet anyway. Say so.

**Grace period:** §D.8 — if full sourcing isn't feasible before dissemination (crisis, time-sensitive ops), the product "shall be re-issued with all appropriate sourcing information as soon as feasible, but **not more than 30 days** thereafter."

**Where the unsupported-assertion rate fits.** ICD 206 has no numeric compliance metric — the IC has no way to measure sourcing completeness at scale today. A reported *unsupported-assertion rate* and *provenance-completeness* metric is a machine-checkable proxy for ICD 206 compliance that does not currently exist anywhere in the IC. That is a QA benefit category (c) claim with a number attached.

## 1.4 ICS 206-01 — the AI citation standard (this is the one most competitors will miss)

**Intelligence Community Standard 206-01**, *Citation and Reference for Publicly Available Information, Commercially Available Information, and Open Source Intelligence*, effective **2 December 2024**, substantially revising the 2017 version; further technical amendment in 2025 to conform to EOs 14148/14151/14168. ([UVA IC Data Policy Map](https://nationalsecurity.virginia.edu/sites/default/files/files/2026-04/intelligence_community_data_policy_map_and_reference_guide.pdf))

For the first time, the IC established **citation requirements for artificial intelligence**, including machine learning, computer vision, and generative AI. Per secondary analysis (I could not retrieve the primary ICS text — treat the element list as **secondary-sourced**), when AI contributes to an analytic product the analyst must document:

- the specific tool name **and version**
- what the model was trained on
- system settings / configuration choices affecting output
- **the exact prompt phrasing**, for generative AI
- the model's documented **accuracy rate**
- any **confidence thresholds** applied to filter results
- known limitations, failure modes, and biases

([Pangea Research, *Sourcing for OSINT: ICS 206-01*](https://pangearesearch.substack.com/p/sourcing-for-osint-icd-206-01); [OSINT Ambition analysis](https://publication.osintambition.org/ics-206-01-the-new-standard-every-osint-professional-must-know-0bbaaa698846))

**This is the single strongest compliance argument the architecture has, and it is nearly free.** A config-driven system with a deterministic seeded kernel emits every one of those seven elements *as a byproduct of running*. The config file **is** the citation. Every competitor built on ad-hoc prompting has to reconstruct this after the fact, from logs, imperfectly, per product. Position it as: *ICS 206-01 requires you to cite the model, version, settings, prompt, accuracy rate, and confidence threshold for every AI contribution; our artifact hash is that citation, and it is verifiable by re-execution.*

The "accuracy rate" element deserves emphasis: **ICS 206-01 requires an analyst to state the model's documented accuracy rate.** For a bare LLM, no such number exists for the analytic task. For this system, Brier skill vs. an explicit baseline *is* that number, per evaluation regime. That is a compliance obligation the field currently cannot meet.

## 1.5 ICD 208 — Maximizing the Utility of Analytic Products

**Status:** 9 January 2017, superseding ICD 208 *Write for Maximum Utility* (2008). ([ODNI PDF](https://www.dni.gov/files/documents/ICD/ICD-208-Maximizing-the-Utility-of-Analytic-Products-2017-01-09.pdf))

Five principles applied as a **hierarchy** (first is foremost): Know Your Customers; Meet Analytic Standards; Produce for Tailored Re-Use; Make Analytic Products Discoverable and Accessible; Demonstrate Transparency.

**The clause that governs the entire dual-tier architecture** (§D.2.c(3)):

> "Sanitized products should never render facts or judgments in a manner inconsistent with their higher-classified version; **facts, judgments, confidence levels, and probabilistic language must be congruent**."

**INFERENCE — this is the hardest single engineering requirement in the dual-tier design.** If the unclassified-tier run and the classified-tier run of the same question produce different likelihood bins or different confidence levels, and the unclassified version is disseminated as a tearline of the classified one, ICD 208 is violated. Three consequences:

1. Tier-crossing cannot be a re-run. It must be a **derivation** — the classified product is authoritative, and the unclassified tearline is generated *from* it by redaction, never by an independent low-side execution.
2. Or, if independent low-side execution is required (because the corpora genuinely differ), the two products must be labelled as **distinct products with distinct source bases**, not as versions of each other. The system should refuse to emit a tearline whose bin differs from its parent.
3. This is a testable invariant. A runtime assertion that a sanitized product's likelihood bin, confidence level, and BLUF judgment match its parent — throwing if not — is the ICD 208 analogue of the existing as-of date assertion. **It does not appear to exist yet and should be built.**

Also relevant: §D.2.c(1) tearlines shall be produced at the lowest classification level commensurate with protection of sources and methods, per ICD 209; §D.4.d all elements shall electronically disseminate products to the Library of National Intelligence or successor systems.

## 1.6 ICD 505 — Artificial Intelligence (the IC's AI directive)

**Status:** Signed **17 January 2025**; technical amendment in 2025 conforming to EOs 14148, 14151, 14168. Authority includes **§6702 of the Intelligence Authorization Act for FY2023**. ([ICD 505](https://www.dni.gov/files/documents/ICD/ICD-505-Artificial-Intelligence.pdf))

**Definition of AI** (§D.1.a), per 15 U.S.C. §9401(3): "a machine-based system that can, for a given set of human-defined objectives, make predictions, recommendations or decisions influencing real or virtual environments." A simulate-and-adjudicate platform is squarely within scope.

**Applicability carve-outs worth knowing** (§C.1):
- Does **not** apply (except §D.5.b) to AI that is publicly available free of charge, accessed on public terms, unmodified by the IC, and used per law/policy.
- Does **not** apply to "the testing and evaluation of a potential vendor, commercial capability, or freely available AI capability for the purpose of making a procurement or acquisition decision, so long as the capability is not otherwise used in IC element operations."

**INFERENCE:** that second carve-out is the legal basis for a low-friction evaluation pilot. An IC element can run the platform against benchmark scenarios for procurement purposes without triggering the full ICD 505 governance apparatus — provided it is not used in operations. This is the correct on-ramp to propose.

**§D.4 Accountability — the requirements that map onto this architecture:**
- §D.4.c — "IC element AI, including associated hardware, software, and data, shall be **auditable** for performance and compliance with relevant guidance, shall be **periodically audited** by the IC element, and those audit results shall be **reviewable and verifiable by IC element personnel**."
- §D.4.d — "**AI provenance shall be tracked and monitored throughout the AI's lifecycle.** To facilitate this … the IC CAIO shall designate an **IC AI model registry** to serve as a central inventory for IC AI model information." Registry entries must be electronically discoverable and accessible IC-wide, with a separate registry permitted for entries exempt from discovery under ICPG 501.1.
- §D.4.b — elements must establish processes "for identifying accountability for and responding to unexpected, inaccurate, or unintentionally biased IC element AI outputs."

**§D.5 Risk Management:**
- §D.5.b — the IC AI risk management framework "shall incorporate the risk management framework, AI use restrictions, and minimum risk management practices established in **the NSM-25 and the AI Framework**." **NSM-25 was rescinded on 5 June 2026.** See §2.4 — this is an open gap.
- §D.5.b(2) — element waivers to minimum risk management practices must be **reported to the IC CAIO within 3 days** of issuance or renewal.
- §D.5.c(1) — "IC element personnel shall only use **malicious techniques** against IC element AI when preapproved by their IC element CAIO in pursuit of an authorized activity (e.g., testing)." **INFERENCE:** adversarial/red-team evaluation of the platform requires CAIO pre-approval. Build that into the T&E plan rather than discovering it mid-pilot.
- §D.5.d — "IC element CAIOs shall be **consulted during IC element accreditation and authorization processes** for IC element capabilities that incorporate AI." The CAIO sits in the ATO path alongside the AO.
- §D.5.e — "IC element testing and evaluation of IC element AI to identify **unexpected performance shifts** shall be ongoing or at a periodicity determined by the IC element."
- §D.5.f — 30 days' advance notice to the IC CAIO for changes to IC element AI that could degrade another element's operations.

**§D.6 Centricity of IC Personnel — the human-owns-the-judgment rule, verbatim:**

> "a. AI must enable and enhance the decisions of IC personnel as it becomes integral to the business and mission of the IC. **IC personnel shall remain responsible and accountable for the analysis, decisions, and outcomes derived from insights gleaned using AI.**
> b. Recipients of IC data shall be informed, **such as through a watermark**, when they receive IC data produced or substantially influenced by IC AI, unless operational, sources and methods protection, or security considerations prevent notification.
> (1) IC personnel shall understand appropriate use for each AI instance that they interact with and shall be accountable for adhering to it.
> (2) IC personnel shall be able to **review, challenge, and reject or replace** AI-derived recommendations and findings when appropriate."

**Product requirements this creates:** (i) an AI-provenance watermark on every disseminated product; (ii) a review/challenge/reject/replace workflow that is a first-class part of the product, not an afterthought; (iii) a named accountable human analyst on every product.

**§D.7 — application of analytic standards.** ICD 505 explicitly binds AI to ICD 203 and ICD 206: "When relevant, IC AI shall be designed and deployed to enable IC personnel to adhere to analytic standards, including those established in ICD 203 and ICD 206." ([as summarised in the UVA IC Data Policy Map](https://nationalsecurity.virginia.edu/sites/default/files/files/2026-04/intelligence_community_data_policy_map_and_reference_guide.pdf))

**§D.7 classification of AI outputs:** all security classification of AI, its contents, derived outputs, and processes must be established by an **Original Classification Authority**, potentially documented in a Security Classification Guide, and "considerations shall include **classification by compilation**." Further: element CAIOs "shall determine whether each IC element AI has the reasonable potential to reveal or recreate classified data to which it has been exposed by an authorized recipient of that intelligence."

**INFERENCE — a serious and under-appreciated risk for this architecture.** A simulation ensemble is a compilation engine. Fifteen thousand runs over an actor model derived from classified inputs may aggregate to a higher classification than any single input. The system needs a classification-by-compilation policy hook per domain adapter, and an OCA-approved SCG covering the *outputs* of the simulator, not just its inputs. Raise this proactively; it is the kind of thing that stalls an ATO for six months if discovered late.

## 1.7 The Common IC Interim Guidance on Foundation AI Models (this constrains the architecture more than anything else)

**"Common Intelligence Community Interim Guidance Regarding the Acquisition and Use of Foundation AI Models,"** issued by interagency lawyers, released publicly November 2024. To be reviewed every six months following the AI NSM. ([primary PDF, intel.gov](https://www.intel.gov/assets/documents/702-documents/declassified/2024/Common_Intelligence_Community_Interim_Guidance.pdf))

**Three regimes:**

**Model acquisition.** A foundation model is "acquired" if hosted or accessed differently from what is available to the general public — including hosting on USG or third-party infrastructure, or API access on non-public terms. Acquiring a model does **not** by itself constitute "collection" of its training data, unless the element has the capability (directly or via reverse engineering / de-anonymisation), authorization, and intent to access that data in original form.

**Model modification and augmentation.** Fine-tuning (altering weights) and augmentation (connecting to data/tools without altering weights) both trigger AG Guidelines compliance if covered information is involved. "Covered information cannot be used to modify or augment a FM absent an authorized purpose and a determination that the use complies with the IC element's AG Guidelines." **No FISA-obtained or FISA-derived information may be used to modify or augment a FM without DOJ and ODNI coordination.**

**Model prompts and outputs.** All prompts and retention of outputs must be for an authorized purpose and consistent with the AI Framework, AG Guidelines, and applicable policies. Per the UVA policy map's summary of this guidance: "**An AI prompt that returns information that an IC element does not currently hold as collected or acquired information should be considered 'collection'** and is subject to applicable legal and policy restrictions on intelligence collection if the information is copied, saved, supplemented, or used."

**The sharing prohibition — the decisive architectural constraint:**

> "This Interim Guidance does not address or authorize any IC element to provide access to, or permit shared use of, any FM with another IC element or a non-IC entity **where the FM has been trained, modified, fine-tuned, or augmented with information collected by an IC element**. Any proposal to do so will require separate consideration under applicable policy and legal requirements, including applicable AG Guidelines."

**INFERENCE — this is a strategic asset, not a constraint, for a config-driven architecture.** A platform that never fine-tunes and never alters model weights:
- never contaminates a model with IC-collected information, so the model stays shareable across elements — directly addressing an interoperability mandate in ICD 505 §D.2.a(2);
- keeps the "collection" analysis confined to retrieval outputs (governed by the as-of corpus, which is *already* a controlled collection), not to model internals;
- makes the model a swappable component, which is the vendor-risk answer (§3.7) and the M-25-22 anti-lock-in answer (§4.5);
- avoids the "you cannot unlearn one fact from an LLM" problem ODNI's own AI lead named publicly: *"if you speak to any researcher or developer that is training a large-language model, and ask them if it is possible to basically kind of delete one individual piece of information from an LLM … that is not a thing that is possible."* — John Beieler, ODNI AI lead ([PBS NewsHour](https://www.pbs.org/newshour/world/u-s-intelligence-agencies-embrace-of-generative-ai-is-at-once-wary-and-urgent)).

**Explicit design commitment to make:** *no fine-tuning, ever; no model weights modified by IC data; all domain adaptation via config, retrieval, and prompt.* Then cite the Interim Guidance sharing prohibition as the reason. This converts an engineering choice into a legal advantage.

**Status caveat — UNVERIFIED:** the Interim Guidance was written under EO 14110 and the "forthcoming NSM." EO 14110 was rescinded January 2025; NSM-25 was rescinded June 2026. The UVA policy map notes: "The full impact of the rescission of E.O. 14110, NSM-25, and OMB memorandum M-24-10 on derivative policies such as the Interim Guidance for the IC Regarding the Acquisition and Use of Foundation AI Models remains to be seen." Whether the Interim Guidance has been reissued or superseded as of August 2026 is **UNVERIFIED**.

## 1.8 The unresolved gap in IC policy on AI-produced analysis

There is **no ICD amendment yet requiring analysts to disclose generative-AI use in analytic reasoning within ICD 203 itself.** ICD 505 §D.6 assigns accountability; ICS 206-01 assigns citation; but ICD 203's "Objective" standard has not been amended.

A Belfer Center paper by Gerald McMahon proposed exactly that amendment to ICD 203 §6.a:

> "When using any generative Artificial Intelligence (AI) tool to inform analytic judgments, analysts must rely on their own, independent judgment, consistent with Analytic Standards, to craft their assessment. Analysts using generative AI tools to develop assessments must be able to appropriately explain the reasoning for their judgments, the evidence which supports their analysis and the confidence in those judgments."

([Belfer Center, *Analytic Tradecraft Standards in an Age of AI*, June 2024](https://www.belfercenter.org/sites/default/files/2024-08/Gerald%20McMahon%20Belfer%20Report%20IntelProject_AI_AnalyticTradecraft.pdf))

A 2026 UVA National Security Data & Policy Institute report is blunter: "Current laws and policies regulating AI in the IC emphasize the centrality of human judgment in developing and using AI, but **do not establish enforceable standards for human accountability** or clearly define who has ultimate decision-making authority to approve the operational use of AI… ICD 505 creates the opportunity, but not an obligation, for IC personnel to review, challenge, and—when appropriate—reject or replace AI-derived recommendations." ([UVA NSDPI](https://nationalsecurity.virginia.edu/sites/default/files/files/2026-04/00032_20260302%29_nsdpi_legal%2C_ethical%2C_and_policy_implications_of_the_u.s_intelligence_community_data_strategy.pdf))

**INFERENCE — positioning:** the gap is the opportunity. A system that produces a *machine-verifiable* record of which judgments were AI-derived, what evidence supported each, and what the analyst changed, is the enforcement mechanism the policy currently lacks. Offer to be the instrument that makes an unenforceable standard enforceable.

---

# PART 2 — AI GOVERNANCE

## 2.1 ODNI Principles of AI Ethics and the AI Ethics Framework (2020, still operative)

**Six Principles of AI Ethics for the IC** (July 2020): respect the law and act with integrity; be transparent and accountable; be objective and equitable; focus on human-centered development and use; ensure it is secure and resilient; inform decisions via science and technology. ([intelligence.gov](https://www.intelligence.gov/ai/principles-of-ai-ethics); [ODNI PDF](https://www.dni.gov/files/ODNI/documents/Principles_of_AI_Ethics_for_the_Intelligence_Community.pdf))

The companion **AI Ethics Framework** is a documentation-and-judgment guide across the AI lifecycle, explicitly designed so that "documentation guidance can be accessible by legal counsels, inspectors general, and privacy and civil liberties officers to verify compliance." ([intelligence.gov](https://www.intelligence.gov/ai/ai-ethics-framework))

Framework requirements that bear directly on this product:

- **Human Judgment and Accountability** — "Incorporate human judgment and accountability at appropriate stages"; "Maintain accountability for iterations, versions, and changes made to the model"; "Use explainable and understandable methods, to the extent practicable, so that users, overseers, and the public, as appropriate, understand how and why the AI generated its outputs"; "Identify who will be accountable for the AI and its effects at each stage."
- **On bias** — the Framework directly quotes ICD 203's objectivity standard and then distinguishes desired from undesired bias: "'Undesired bias' is bias that could undermine analytic validity and reliability, harm individuals, or impact civil liberties." It also asks the sharp question: "**How may introducing an accountable human produce cognitive biases and/or confirmation bias?**"
- **Testing** — "Every system must be tested for accuracy in an environment that controls for known and reasonably foreseeable risks prior to being deployed."
- **Documentation** — communicate "(a) what the AI is for, (b) what it is not for, (c) how it was designed, and (d) what its limitations are."
- **Periodic Review** — "All AI should be checked at an appropriate documented interval."

**Why these still matter in 2026:** OMB M-25-21 (April 2025) "referred to the Principles of AI Ethics for the IC and the AI Ethics Framework for the IC as the operative guidance for AI risk management in the IC following the rescission of E.O. 14110, NSM-25, and OMB memorandum M-24-10." ([UVA IC Data Policy Map](https://nationalsecurity.virginia.edu/sites/default/files/files/2026-04/intelligence_community_data_policy_map_and_reference_guide.pdf)) The 2020 documents are the surviving floor.

**INFERENCE:** the "not for" clause is where an honest system wins. A product that leads its first line with *real-world forecasting skill is not yet measured* is executing AI Ethics Framework documentation requirement (b) verbatim. Frame the honesty as compliance, not as modesty.

## 2.2 The DoD stack: 5 AI Ethical Principles, RAI Pathway, DoDD 3000.09

**DoD AI Ethical Principles** (SecDef memo, 21 February 2020), reproduced in DoDD 3000.09 §1.2.f:

1. **Responsible** — personnel exercise appropriate levels of judgment and care, remaining responsible for development, deployment, and use.
2. **Equitable** — deliberate steps to minimize unintended bias.
3. **Traceable** — "developed and deployed such that relevant personnel possess an appropriate understanding of the technology, development processes, and operational methods … including with **transparent and auditable methodologies, data sources, and design procedures and documentation**."
4. **Reliable** — "explicit, well-defined uses, and the safety, security, and effectiveness of such capabilities will be subject to testing and assurance **within those defined uses** across their entire life cycles."
5. **Governable** — ability to detect and avoid unintended consequences, and to disengage or deactivate systems showing unintended behavior.

([DoDD 3000.09, 25 Jan 2023](https://www.esd.whs.mil/portals/54/documents/dd/issuances/dodd/300009p.pdf))

**INFERENCE:** "Traceable" is a near-verbatim description of a deterministic seeded kernel with a config-as-artifact. "Reliable" — "within those defined uses" — is the DoD phrasing of the same idea as M&S accreditation-for-intended-use (§5.3) and the evaluation-regime tag. These are the two principles to lead with.

**DoDD 3000.09 is being rewritten.** NSPM-11 §3 directs the Secretary of War to update it within 90 days (≈3 September 2026), and to review it annually. ([InsideDefense, 5 Jun 2026](https://insidedefense.com/daily-news/trump-orders-pentagon-revise-human-control-rules-ai-weapons)) The Senate Armed Services Committee's FY2027 NDAA draft (marked up 10 June 2026) would codify a framework requiring "appropriate levels of human judgment" and "ultimate human responsibility over the use of force," specify VV&T&E criteria, and categorically prohibit AI in any decision to launch or detonate a nuclear weapon. DOT&E — whose budget the FY27 request would cut by roughly two-thirds — would be charged with ensuring covered systems function "as anticipated in realistic operational environments against adaptive adversaries." ([Arms Control Today, Jul 2026](https://www.armscontrol.org/act/2026-07/news/us-senate-panel-approves-ai-autonomous-weapons-rules))

**Note:** this platform is *not* a weapon system and DoDD 3000.09 does not apply to it directly. It matters because the ethical principles it carries apply to all DoD AI, and because the DOT&E budget cut is a real signal about where independent T&E capacity is going.

## 2.3 CDAO and the DoD AI T&E apparatus

**CDAO T&E Strategy Frameworks** (initial release May 2024), four documents: **AI Model T&E**, **Human-Systems Integration T&E**, **Systems Integration T&E**, **Operational T&E**. These are strategy-level, explicitly "not formal policy or specific requirements." ([CDAO JATIC guidance](https://cdao.pages.jatic.net/public/guidance/); [ai.mil](https://www.ai.mil/Latest/Blog/Article-Display/Article/3940283/cdao-test-and-evaluation-strategy-frameworks/))

Lessons-learned slides from CDAO Assessment & Assurance are worth quoting to a buyer because they describe this product's problem:
- "Data splitting between T&E and Training is critical and must be constantly adjusted — you will almost certainly get it wrong the first time, so save data for future use."
- "With generative AI, evaluating the human-AI system as a unit has become even more vital to understanding operational performance."
- "T&E scoping and answering, 'how much test is enough?' is exacerbated by AI." ([CDAO briefing](https://na-admin.eventscloud.com/docs/9769/413266))

**JATIC** (Joint AI Test Infrastructure Capability) is scoped "entirely on AI Model Testing," initially computer-vision classification and object detection — i.e., **not applicable to this product class**. RAVEN is CDAO's orchestrated open-source MLOps/T&E platform.

**DTE&A / USD(R&E):** *Developmental Test and Evaluation of Artificial Intelligence-Enabled Systems Guidebook* (final, 26 February 2025). Notes that T&E of GenAI "is still in its infancy as a discipline," and that a formally approved DTE&A policy for AI is **still under development** as of the September 2025 page update. ([Guidebook PDF](https://www.cto.mil/wp-content/uploads/2025/02/TE_of_AIES_Guidebook_Final_26Feb25.pdf); [cto.mil/dtea](https://www.cto.mil/dtea/te_aies/))

**DOT&E:** **DoDM 5000.101**, *T&E of AI-Enabled and Autonomous (AI&A) Systems*, referenced by DoDI 5000.98 §3.3. Introduces **data cards** and **model cards** as new required documentation, plus test-dataset T&E, AI model T&E, adversarial AI testing, and updates over the system lifecycle. ([DOT&E overview brief, 9 Dec 2024](https://www.dote.osd.mil/Portals/97/pub/presentations/2024/DoDM%205000.101%20AI%20and%20Autonomy%20Overview%20Brief_External%20Presentation_20241209.pdf))

**INFERENCE — deliverable:** produce a **model card and a data card** for the platform, and a **"kernel card"** for the deterministic numeric core (its equations, its assumptions, its validated envelope, its seeded PRNG spec). No one will have asked for the third; it is the artifact that distinguishes "a wrapper around an LLM" from "a simulation with a validated numeric core."

## 2.4 NSM-25 → NSPM-11: what is actually in force

**NSM-25** (24 October 2024), *Advancing the United States' Leadership in AI; Harnessing AI to Fulfill National Security Objectives; and Fostering the Safety, Security, and Trustworthiness of AI*, with its companion **Framework to Advance AI Governance and Risk Management in National Security** ("AI Framework"). ([NSM-25 govinfo](https://www.govinfo.gov/content/pkg/DCPD-202400945/pdf/DCPD-202400945.pdf); [AI Framework PDF](https://data.aclum.org/storage/2025/01/WhiteHouse_ai_gov_wp-content_uploads_2024_10_NSM-Framework-to-Advance-AI-Governance-and-Risk-Management-in-National-Security.pdf))

**RESCINDED.** NSPM-11 "rescinds and replaces" NSM-25 and associated guidance. ([White House fact sheet, June 2026](https://www.whitehouse.gov/fact-sheets/2026/06/fact-sheet-president-donald-j-trump-signs-historic-directive-on-ai-in-the-national-security-enterprise/); [Crowell & Moring](https://www.crowell.com/en/insights/client-alerts/national-security-memorandum-aims-to-accelerate-deployment-of-ai-and-streamline-procurement-aligned-to-administration-policies))

**Why the AI Framework still matters even though it is rescinded:** its four pillars and its minimum risk management practices for high-impact AI are the *only* written, publicly available national-security AI risk baseline, they are incorporated by reference into ICD 505 §D.5.b, and — per the ICD 505 text — IC elements were directed to build their risk management framework on them. Its minimum practices for high-impact AI included, verbatim:

- "Complete an AI risk and impact assessment, including at least identifying the intended purpose for the AI, its expected benefits, and its potential risks… The analysis should demonstrate an expected positive outcome, and it should demonstrate that **the AI is better suited to accomplish the relevant task as compared to alternative strategies**."
- "**Test the AI system sufficiently in a realistic context** to confirm it will perform as intended… or else the agency should not use the AI system."
- "To the extent practicable, and **through an independent reviewing authority not directly involved in the system's development**, conduct an evaluation specific to the intended purpose and planned deployment of the AI system and make the evaluation available to the AI Governance Board."
- "Develop processes, including training, to mitigate the risk of **overreliance on AI systems** (such as 'automation bias')."
- "Ensure appropriate human consideration and/or oversight of AI-based decisions or actions, including by establishing clear human accountability."

**INFERENCE:** "demonstrate that the AI is better suited to accomplish the relevant task as compared to alternative strategies" is **Brier skill vs. an explicit baseline**, in policy language. The AI Framework asked for exactly the metric this system already computes. Cite it even though it is rescinded — it will be reconstituted in some form by the CNSS/OMB policy (§2.5), and the requirement is not going away.

### NSPM-11 in detail (signed 5 June 2026)

**Four pillars:** Adoption, Adaptation, **Assurance**, Accountability.

**The Assurance pillar, verbatim** — this is the clause that reshapes vendor terms:

> "(c) Assurance. The national security enterprise shall assure that all AI technologies adopted are designed to be reliable, robust, steerable, and controllable… To protect American warfighters, the national security enterprise shall ensure, **through contractual clauses or other means, that no commercial entity or adversary possesses the capability to prevent use of, disable or degrade, or materially modify without Federal Government knowledge and approval, an AI system** that our men and women depend on for their missions. In addition, rigorous security and functionality measures, including testing, evaluation, validation, and verification, shall be implemented to assure the appropriate confidentiality, integrity, reliability, availability, and interoperability of AI systems across the national security enterprise."

**Definitions** (§6): *controllability* = monitoring operations and taking corrective action; *steerability* = shaping internal system behavior; *robustness* = maintaining performance under varied conditions.

**Deadline table** (dates approximate, computed from 5 June 2026):

| Due | Action | Owner |
|---|---|---|
| ~5 Jul 2026 (30 d) | Report any contractor waivers in writing (personally, no designee) | Agency heads |
| ~3 Sep 2026 (90 d) | Update DoDD 3000.09 on autonomy in weapon systems | SecWar |
| ~3 Sep 2026 (90 d) | **Issue AI governance policy for national security systems**, maximizing consistency with OMB M-25-21 "to the extent appropriate" | **CNSS and OMB Director** |
| ~3 Sep 2026 (90 d) | Advanced computing roadmap, incl. high-security AI computing facilities and **an AI test range for national security use cases** | APST and OMB Director |
| ~3 Sep 2026 (90 d) | **Classified annex** issued | Unspecified |
| ~3 Oct 2026 (120 d) | Review and update **AI procurement processes** for rapid multi-vendor onboarding, "closing the capability gap between what is available to the public and to our national security workforce" | SecWar, DNI, IC agency heads |
| ~3 Oct 2026 (120 d) | Private-sector AI security partnerships (threat intel sharing, joint red teams, personnel vetting, joint R&D, data-center security) | SecWar, SecEnergy, DNI, NSA Dir |
| ~3 Oct 2026 (120 d) | Initiate **joint AI data and model exchanges across classification enclaves** | DNI, SecWar, SecEnergy, NSA Dir |
| ~3 Oct 2026 (120 d) | Joint AI risk management and assurance strategy; **baseline AI security practices** | DNI, SecWar, NSA Dir |
| ~3 Oct 2026 (120 d) | **Standardized AI national security TEVV methodologies**, including conformity verification and sustainment of high-security AI systems, at appropriate classification levels | SecWar (through NSA Dir), DNI |
| ~3 Oct 2026 | AI National Security Strategic Reserve | OPM Director |
| ~3 Oct 2026 | AI for National Security Curriculum | DNI, SecWar |

([NSPM-11 full text](https://www.whitehouse.gov/presidential-actions/2026/06/national-security-presidential-memorandum-nspm-11/); [Benton Institute timeline](https://www.benton.org/blog/president-trump-signs-directive-reshaping-how-military-and-intelligence-community-use-ai); [Ward & Berry analysis](https://www.wardberry.com/harden-it-or-ship-it-what-the-ai-executive-order-and-nspm-11-mean-for-government-contractors/))

**Vendor accountability:** NSPM-11 directs agency heads to "terminate for default or for convenience contracts with companies that have repeatedly demonstrated a pattern of conduct that is inconsistent with policies" in §2, including through subcontractor relationships. Waivers are limited to one year and require written reporting to presidential advisors within 30 days.

**The strategic read.** Ward & Berry name the central tension precisely: "The Adoption pillar prizes speed… The Assurance and Accountability pillars demand rigorous TEVV, controllability, and human accountability… Neither document offers a formula for resolving the trade… Until that guidance lands, contractors should expect **inconsistency across program offices**: some will lean toward speed and others toward assurance, and acceptance criteria, contract terms, and documentation demands will vary accordingly."

**INFERENCE — the single best-timed positioning move available.** The standardized TEVV methodologies are due to the White House **in roughly eight weeks**, they will be written by NSA and ODNI, and there is no publicly known incumbent methodology for probabilistic analytic AI. A system that arrives with a *working, measured* metrics package (Brier skill vs. explicit baselines, Murphy decomposition, ECE/MCE with reliability diagrams, sharpness, coverage@N, Krippendorff α, tail recall, inter-run stability) and an evaluation-regime taxonomy is not just compliant with the forthcoming TEVV standard — it is a candidate input to it. Offer the metrics package as a reference implementation, not just as a product feature.

## 2.5 OMB M-25-21 and M-25-22 — and why the IC carve-out matters

**M-25-21**, *Accelerating Federal Use of AI through Innovation, Governance, and Public Trust* (3 April 2025). Rescinds and replaces M-24-10. ([PDF](https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-21-Accelerating-Federal-Use-of-AI-through-Innovation-Governance-and-Public-Trust.pdf))

**Two carve-outs that decide whether it binds you:**
- The memo "explicitly carves out the use of AI in a **National Security System**." ([Wiley](https://www.wiley.law/alert-Trump-Administration-Revamps-Guidance-on-Federal-Use-and-Procurement-of-AI))
- Verbatim from the memo itself: "**Sections 4(a) through (b) of this memorandum do not apply to elements of the Intelligence** [Community]."

**INFERENCE — this is the most commonly misstated fact in this space.** A proposal that claims M-25-21 high-impact AI compliance as a selling point to the CIA is telling the buyer you have not read the memo. The correct statement is: *M-25-21's minimum risk management practices do not bind IC elements; ICD 505 and the forthcoming CNSS/OMB NSS governance policy do; here is how we satisfy those, and here is why we also meet the M-25-21 bar voluntarily so that adjacent civilian buyers (DHS/I&A, State, Treasury, Commerce) require no re-engineering.*

**Definition of "high-impact AI"** (worth meeting voluntarily): "AI with an output that serves as a principal basis for decisions or actions with legal, material, binding, or significant effect on: (1) civil rights, civil liberties, or privacy; … (5) critical infrastructure or public safety; or (6) **strategic assets or resources, including high-value property and information marked as sensitive or classified by the Federal Government**." ([Ropes & Gray](https://www.ropesgray.com/en/insights/alerts/2025/04/white-house-issues-guidance-on-use-and-procurement-of-artificial-intelligence-technology))

Category (6) means an analytic product informing strategic decisions is high-impact **on the memo's own definition**, even where the memo doesn't bind. Seven minimum practices: pre-deployment testing; AI impact assessment; ongoing monitoring; adequate human training and assessment; human oversight/intervention/accountability; consistent remedies or appeals; consult and incorporate end-user and public feedback. Waivers must be issued by the CAIO personally (non-delegable), certified annually, and publicly reported.

**Notable divergence from the Biden framework:** M-25-21 "does not reference the National Institute of Science and Technology's AI Risk Management Framework." ([Wiley](https://www.wiley.law/alert-Trump-Administration-Revamps-Guidance-on-Federal-Use-and-Procurement-of-AI)) NIST AI RMF alignment is now a differentiator you may offer, not a requirement you must meet.

**M-25-22**, *Driving Efficient Acquisition of Artificial Intelligence in Government* (3 April 2025). Rescinds M-24-18. Applies to solicitations issued on or after ~30 September 2025 and options exercised on or after 1 October 2025; **excludes national-security-related acquisitions**. ([PDF](https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-22-Driving-Efficient-Acquisition-of-Artificial-Intelligence-in-Government.pdf))

Contract terms it directs agencies to include — every one of which favours this architecture:
- **Protections against vendor lock-in**: "clear data and model portability practices, clear licensing terms, and pricing transparency"
- Rights to government data, outputs, and **derived models**
- **Prohibition on using nonpublic agency data to train publicly or commercially available AI algorithms without explicit agency consent**
- Performance validation and pre-award testing; ongoing testing and monitoring rights
- Notifications to agency stakeholders before integrating new AI enhancements

**INFERENCE:** a no-fine-tuning, config-driven, model-swappable design satisfies the anti-lock-in and no-training-on-government-data clauses by construction. Put a **model-portability guarantee** in the technical volume: *any conformant inference endpoint can be substituted by config change; here is the abstraction boundary; here is the regression suite that proves substitution preserves behavior within stated tolerance.*

## 2.6 NIST: AI RMF, the GenAI Profile, and CAISI

- **AI RMF 1.0** — voluntary. NIST states plainly: "**The AI RMF 1.0 is being revised.**" ([NIST](https://www.nist.gov/itl/ai-risk-management-framework))
- **NIST AI 600-1**, *Generative AI Profile* (26 July 2024) — 12 risk categories: CBRN Information or Capabilities, **Confabulation**, Dangerous/Violent/Hateful Content, Data Privacy, Environmental Impacts, Harmful Bias and Homogenization, **Human-AI Configuration**, **Information Integrity**, Information Security, Intellectual Property, Obscene or Degrading Content, Value Chain and Component Integration. Over 200 actions mapped to GOVERN/MAP/MEASURE/MANAGE. ([NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf))
- **Institutional churn:** the U.S. AI Safety Institute became the **Center for AI Standards and Innovation (CAISI)** (announced 3 June 2025); the AI Safety Institute Consortium became the **NIST AI Consortium** (announced 29 May 2026). CAISI's remit includes leading "unclassified evaluations of AI capabilities that may pose risks to national security," coordinating with DoD, DOE, DHS, OSTP and **the Intelligence Community** on evaluation methods. ([Commerce statement](https://www.commerce.gov/news/press-releases/2025/06/statement-us-secretary-commerce-howard-lutnick-transforming-us-ai); [NIST CAISI](https://www.nist.gov/caisi); [NIST consortium](https://www.nist.gov/news-events/news/2026/05/nist-expands-ai-consortiums-scope-calls-new-members))
- April 2026: NIST released a concept note for an AI RMF Profile on **Trustworthy AI in Critical Infrastructure**.

**INFERENCE:** the three GenAI Profile categories that map cleanly onto this product's differentiators are **Confabulation** (unsupported-assertion rate, provenance completeness), **Information Integrity** (contradiction precision/recall, source reconciliation), and **Human-AI Configuration** (the review/challenge/reject workflow, automation-bias mitigation). Map to those three explicitly and skip the other nine; a 12-category compliance matrix reads as box-checking.

---

# PART 3 — CLASSIFICATION AND DEPLOYMENT REALITY

## 3.1 The networks

- **NIPRNet** — DoD unclassified/CUI network; internet-facing via Internet Access Points.
- **SIPRNet** — Secret-level network.
- **JWICS** — Joint Worldwide Intelligence Communications System, TS/SCI.
- **NSANet**, **CENTRIXS** variants, coalition enclaves — additional domains that a CDS may bridge.

Army Pam 25-2-1 documents the operational one-way transfer services in use: **Intelshare SAFE** (unclass → SIPRNet), **Intelink Glide OWT** (unclass → SIPRNet, unclass → TS, Secret → TS), and DIA's **DoDIIS One Way Transfer Service (DOTS)** (unclass → SIPRNet, unclass → TS, Secret → TS). ([DA Pam 25-2-1](https://armypubs.army.mil/epubs/DR_pubs/DR_a/ARN36794-PAM_25-2-1-002-WEB-4.pdf))

**INFERENCE:** these are the actual, existing pipes for the low→high direction of the dual-tier architecture — corpus updates, config files, model artifacts, benchmark scenarios. There is no comparable easy path in the high→low direction, which is the direction that matters for exfiltrating evaluation results (§3.6).

## 3.2 DoD Impact Levels

The DoD Cloud Computing SRG defines four active levels (IL3 was merged into IL4). Per the current CSP SRG: "**Impact Levels are a DOD construct only. It is inaccurate to refer to a DOD PA for a given DOD Impact Level as a FedRAMP Impact Level number.** … FedRAMP baselines do not address National Security Systems/Information or classified information, which is under the purview of the Committee on National Security Systems (CNSS). … National Security Systems per CNSSP-32 will be housed in a minimum baseline of FedRAMP High. **NSS data shall be housed in Impact Level 5 or higher.**" ([DISA CSP SRG](https://cyber.trackr.live/stig/Cloud_Computing_Mission_Owner_Network_Security_Requirements_Guide/1/2/companion.pdf?file=U_Cloud_Service_Provider_V1R2_SRG.pdf))

| IL | Data permitted | Control baseline | Location | Connectivity | Separation | Personnel |
|---|---|---|---|---|---|---|
| **IL2** | Public or non-critical unclassified, non-CUI | FedRAMP Moderate (reciprocity per DISA memo 15 Aug 2019) | US / US outlying areas or DoD on-prem | Internet | Virtual/logical, public community | NACI |
| **IL4** | CUI, non-NSS, mission data incl. direct support to military/contingency ops | FedRAMP Moderate + DoD FedRAMP+ CUI-specific controls + CNSSI 1253 overlays (or FedRAMP High + IL4 FedRAMP+) | US / US outlying or DoD on-prem | NIPRNet via CAP | Strong virtual separation between tenants | US persons; ADP-1; SSBI |
| **IL5** | Higher-sensitivity CUI, mission-critical, **unclassified NSS** | FedRAMP **High** + DoD FedRAMP+ + CNSSI 1253 App D NSS controls | US / US outlying or DoD on-prem | NIPRNet via CAP | Federal-government community; **dedicated multi-tenant infrastructure physically separate from non-federal systems** | ADP-2; NACLC; NDA |
| **IL6** | Classified up to **SECRET**, classified NSS | FedRAMP High + classified overlay ("adds over 200 controls beyond that baseline") | Cleared/classified facilities | **SIPRNet direct**, with DoD SIPRNet enclave connection approval | Dedicated infrastructure physically separate from non-federal **and unclassified** systems | US citizens with favorably adjudicated **SSBI and SECRET clearance**; NDA |

([GSA Cloud Information Center](https://cic.gsa.gov/basics/cloud-security); [Second Front IL reference table](https://www.secondfront.com/resources/blog/understanding-dod-cloud-computing-impact-levels/); [LegalClarity, noting a January 2026 SRG update — **UNVERIFIED against the primary SRG**](https://legalclarity.org/what-is-the-dod-cloud-computing-security-requirements-guide/))

**"IL7"** is not a formal SRG level. Breaking Defense describes it as "a semi-official term for the most highly classified systems," used in DoD's 1 May 2026 announcement of frontier-AI agreements covering "Impact Level 6 (IL6) and Impact Level 7 (IL7) network environments." ([Breaking Defense, 1 May 2026](https://breakingdefense.com/2026/05/pentagon-clears-7-tech-firms-to-deploy-their-ai-on-its-classified-networks/)) Treat IL7 as shorthand for TS/SCI-and-above, not as a citable accreditation target.

## 3.3 The IC path: ICD 503, not the DoD SRG

For IC systems, the governing risk framework is **ICD 503**, *Intelligence Community Information Environment Risk Management* (originally 2008; amended 2015; the UVA policy map lists a 2024 version). ([ICD 503, ODNI](https://www.odni.gov/files/documents/ICD/ICD-503.pdf))

Key mechanics:
- The IC IE "shall operate in accordance with a Risk Management Framework (RMF) that promotes security, privacy, interoperability, and efficiency… **Reciprocal acceptance of security and privacy assessments and authorization decisions does not confer data reciprocity.**"
- **Authorizing Official (AO)** makes the authorization decision; may appoint **Delegated Authorizing Officials (DAO)**, who must be USG employees and **may only authorize systems whose breach would produce no more than low-to-moderate impact**. High-impact systems must go to the AO.
- Authorization decisions state whether a system is "authorized for operation, authorized for operation with conditions, or not authorized for operation."
- A **Security Assessor** conducts the assessment and may not also be the AO or DAO.
- **Reciprocity:** IC elements shall, "to the maximum extent practical, accept the security and privacy assessment of an information system, cloud service, or other item of IT by another IC element without requiring or requesting any additional validation or verification testing… However, IC elements **should test configuration differences introduced by the system, service, or the item in a new environment**." Elements shall also leverage non-IC federal assessments "if that assessment is based on standards consistent with those established for the IC." Five Eyes authorization decisions shall be accepted for equivalent-classification sovereign systems.
- **Security Control Overlays** are the friction point. The DoD Cybersecurity Reciprocity Playbook notes: "Additional consideration must be given to Security Control Overlays (e.g., **Intelligence A (INT-A), INT-B, INT-C, Cross Domain Transfer, Cross Domain Access, Privacy**, etc.)." Body-of-evidence exchange uses the IC **BOE.XML** encoding specification aligned to CNSSI 1254. ([DoD Cybersecurity Reciprocity Playbook, 2024](https://dodcio.defense.gov/Portals/0/Documents/Library/(U)%202024-01-02%20DoD%20Cybersecurity%20Reciprocity%20Playbook.pdf))

**Azure Government Top Secret "maintains an ICD 503 Authorization to Operate with facilities authorized according to ICD 705"** (the SCIF standard). ([Microsoft ICD 503 compliance page](https://learn.microsoft.com/en-us/azure/compliance/offerings/offering-icd-503))

### What FedRAMP High does and does not buy you at TS/SCI

**Buys you:**
- IL2 by reciprocity (FedRAMP Moderate).
- The *baseline* on which IL4/IL5/IL6 and NSS authorizations are built — CNSSP-32 sets FedRAMP High as the minimum baseline for all unclassified NSS.
- Body of evidence that an IC AO is directed by ICD 503 §D.4.c to leverage "to the maximum extent possible" without additional validation testing.
- Credibility and a reusable control-implementation narrative.

**Does not buy you:**
- Any classified authorization. FedRAMP explicitly does not address NSS or classified information; that is CNSS's remit.
- Freedom from testing configuration differences in the new environment — expressly reserved by ICD 503 and the DoD playbook.
- Freedom from the classified overlay (IL6 adds 200+ controls above FedRAMP High).
- Freedom from personnel and facility requirements — cleared US-citizen staff, SSBI, ICD 705 facilities.
- The AO's discretion. ICD 503 §D.4.b ends "unless deemed necessary by that IC element's AO." Every reciprocity clause has that escape hatch.

**INFERENCE:** the honest framing for a small company is: *FedRAMP High / IL5 is the price of entry to the low tier and a meaningful head start on the high tier, but it is not a path to TS/SCI. The path to TS/SCI runs through an IC sponsor's AO, a C2E-hosted deployment inheriting the CSP's ICD 503 ATO, and a delta assessment of what our application adds.* Anyone who tells the customer FedRAMP High gets them to JWICS is wrong and the customer knows it.

## 3.4 FedRAMP as of August 2026 — the terminology changed

This matters because using 2024 vocabulary dates a proposal.

- **4 May 2026:** FedRAMP "changed all designations from 'FedRAMP Authorization' to '**FedRAMP Certification**', and all designations of impact levels to **certification classes A, B, C, and D**." ([FedRAMP changelog](https://www.fedramp.gov/changelog/))
- Mapping: **Class A** = new pilot baseline; **Class B** = current Li-SaaS and Low; **Class C** = current **Moderate**; **Class D** = current **High**. ([RFC-0020 outcome](https://www.fedramp.gov/notices/0004/))
- **25 June 2026:** FedRAMP Consolidated Rules for 2026 published; valid until 31 December 2028. Key dates: 6 July 2026 marketplace listings open; 28 July 2026 FedRAMP Ready goes legacy; 3 August 2026 Class A pipeline opens; **31 August 2026 Class B and Class C pipelines open**; **1 January 2027 Consolidated Rules become mandatory for all stakeholders**; 11 June 2027 no new Rev5 certifications. ([FedRAMP, 25 Jun 2026](https://www.fedramp.gov/2026-06-25-propelling-change-fedramp-launches-consolidated-rules-for-2026/))
- **Class D (High) does not yet have a 20x path.** "Class D Certifications will be developed during FedRAMP 20x Phase 4," estimated FY27 Q1–Q2. **"Class D FedRAMP Certifications will continue to require an agency sponsor."** FedRAMP will only issue sponsorless Class A, B, or C certifications. ([FedRAMP 20x](https://www.fedramp.gov/20x/); [RFC-0023 outcome](https://www.fedramp.gov/notices/0008/))

**INFERENCE — a concrete business consequence.** There is no sponsorless route to FedRAMP High (Class D) today and there will not be one before FY27 Q2 at the earliest. **An agency sponsor is a hard prerequisite** for the unclassified tier at the level that IL5/NSS reciprocity requires. That makes securing a sponsoring IC element (or riding an already-authorized platform — see §3.5) the critical-path business action, not a downstream detail. FedRAMP's own suggested workaround: providers unable to secure a Class D sponsor "are welcome to apply for a Class C FedRAMP Certification… and make any additional control implementations available in an **addendum** to their authorization package for agencies to encourage adoption in agency information systems with a High security objective."

## 3.5 What frontier models are actually available at each level (as of August 2026)

**Microsoft Azure**
- Jan 2025: 26 additional products authorized in Azure Government Top Secret **in accordance with ICD 503**, including **Azure OpenAI Service** and **Azure Machine Learning** — the latter "allowing users to train, deploy, and manage open-source models – including open-sourced foundation models," and to bring/build their own LLMs. ([Azure Gov blog](https://devblogs.microsoft.com/azuregov/unlocking-new-possibilities/); [DefenseScoop](https://defensescoop.com/2025/01/16/openais-gpt-4o-gets-green-light-for-top-secret-use-in-microsofts-azure-cloud/))
- Feb 2025: DISA authorized Azure OpenAI at **IL6** in Azure for U.S. Government Secret; announced April 2025 — "Azure OpenAI Service is now authorized for workloads at **all U.S. Government data classification levels**." ([Azure Gov blog](https://devblogs.microsoft.com/azuregov/azure-openai-authorization/))
- **15 January 2026: GPT-5.2 available in Azure for U.S. Government Secret and Top Secret clouds.** ([Azure Gov blog](https://devblogs.microsoft.com/azuregov/advancing-ai-capabilities-in-azure-for-u-s-government-secret-and-top-secret-clouds/))
- Data handling in Azure Gov Top Secret: "Proprietary information, from prompts to core data sets, remains within the boundary of Azure Government Top Secret."

**AWS**
- Jan 2025: **Amazon Bedrock GA in the AWS Top Secret cloud**, launching with Anthropic's Claude 3.5 Sonnet (upgraded) and Amazon Titan Text Embeddings v2, with console, playgrounds, and Guardrails; Knowledge Bases and Agents planned. ([AWS Public Sector blog](https://aws.amazon.com/blogs/publicsector/amazon-bedrock-launches-with-claude-3-5-sonnet-in-the-aws-top-secret-cloud/))
- May 2025: Bedrock models achieve **FedRAMP High and DoD IL4/5** in AWS GovCloud (US), plus Agents, Guardrails, Knowledge Bases, and **Model Evaluation**. ([AWS what's-new](https://aws.amazon.com/about-aws/whats-new/2025/05/amazon-bedrock-models-fedramp-high-dod-il-4-5-govcloud/))
- AWS's Bedrock FedRAMP status page, **last updated 28 July 2026**, uses the new FedRAMP class vocabulary ("Class C, formerly Moderate"; "Class D, formerly High") and lists a long Anthropic model roster through Claude 5 Sonnet, plus model families from AI2I Labs, Amazon Titan, Cohere, Meta, Mistral, Nvidia, **OpenAI**, Stability, and xAI (Grok 4.3 at Class D and IL4/5). ([AWS Bedrock FedRAMP status](https://aws.amazon.com/compliance/services-in-scope/FedRAMP/amazon-bedrock-models/))

**Google**
- May 2025: **Google Distributed Cloud (GDC) air-gapped and GDC air-gapped appliance achieve DoD IL6**, building on existing IL5 and Top Secret accreditations; both enable direct SIPRNet connectivity; IL6 PA at H-H-x per CNSSI 1253. "Vertex AI and Google's state of the art Gemini models are available now at IL6 and TS." ([Google Cloud blog](https://cloud.google.com/blog/topics/public-sector/google-distributed-cloud-gdc-gdc-air-gapped-appliance-achieve-dod-impact-level-6-il6-authorization); [Google DISA compliance page](https://cloud.google.com/security/compliance/disa))
- Aug 2025: **GA of Gemini on GDC air-gapped**; supports Gemini 2.5 Flash and Pro, Vertex task-specific models, Gemma open models, and "managed VM shapes and Kubernetes clusters giving customers the ability to deploy **any open-source or custom AI model**." Confidential Computing on CPU (Intel TDX) and GPU (NVIDIA). ([Google Cloud blog](https://cloud.google.com/blog/topics/hybrid-cloud/gemini-is-now-available-anywhere))
- Google's DoD IL6 compliance-scope doc (updated 20 April 2026) lists **Gemini on GDC (Gemini Pro, Gemini Flash)** and the Gemini Enterprise Agent Platform in IL6 scope. ([Google IL6 scope](https://docs.cloud.google.com/docs/security/compliance/il6-gdc-compliance-scope))

**C2E** — the CIA's Commercial Cloud Enterprise, awarded November 2020 to **AWS, Microsoft, Google, Oracle, and IBM**; multiple-award IDIQ, 15-year period of performance, "tens of billions" ceiling, task orders "at various classification levels of up to top secret," available to all IC agencies. A separate integrator/multi-cloud-management contract was also planned. ([Nextgov](https://www.nextgov.com/modernization/2020/11/exclusive-cia-awards-secret-multibillion-dollar-cloud-contract/170227/); [FedScoop](https://fedscoop.com/cia-quietly-awards-billion-dollar-c2e-cloud-contract/))

**DoD enterprise platforms**
- **GenAI.mil** launched 9 December 2025; Google Cloud's **Gemini for Government** first; certified for **CUI and IL5**; CAC-authenticated; ~3 million users. Hegseth memo directs personnel to "log in, learn, and incorporate it into your daily workflows immediately." Navigation panel suggests xAI Grok, OpenAI ChatGPT, and Anthropic Claude "coming soon." ([DefenseScoop](https://defensescoop.com/2025/12/09/genai-mil-platform-dod-commercial-ai-models-agentic-tools-google-gemini/); [Lawfare on the Hegseth memo](https://www.lawfaremedia.org/article/hegseth-memo-instructs-defense-dept.-to-use-military-ai-platform))
- **1 May 2026:** DoD announced agreements with **eight** firms to deploy AI on IL6/IL7 classified networks: AWS, Google, Microsoft, OpenAI, SpaceX, NVIDIA, Reflection, and (added later that day) Oracle. Pentagon CTO Emil Michael: "it's irresponsible to be reliant on any one partner… we went out and made sure that we had multiple different providers — both **open source**, which is a new effort here at the department, and the proprietary model companies and the infrastructure companies." ([Breaking Defense](https://breakingdefense.com/2026/05/pentagon-clears-7-tech-firms-to-deploy-their-ai-on-its-classified-networks/))
- Pre-existing classified/unclassified LLM services in DoD use include **CamoGPT** and **SIPRGPT**. ([DefenseScoop, 18 Dec 2025](https://defensescoop.com/2025/12/18/genai-mil-users-have-mixed-reactions-and-many-questions/))

**A cautionary data point worth citing in a proposal.** A defense official's critique of GenAI.mil, reported by DefenseScoop: Google's offering "has an internal dataset that appears to consist of cached, scraped web content that is **enabled by default**… while it is likely curated to offer more authoritative sources, this is still **catastrophic for accuracy in any context**… when DOD users work with critical military products that require verifiable sources, and in operations where accuracy is vital, they do not want LLMs to draw from uncontrolled data sources." ([DefenseScoop](https://defensescoop.com/2025/12/18/genai-mil-users-have-mixed-reactions-and-many-questions/))

**INFERENCE:** that is a paying customer, in print, describing precisely the failure mode a hard-date-filtered as-of corpus plus a runtime post-dating assertion prevents. It is the best available third-party validation of the leakage-guard design and should be quoted.

## 3.6 Cross-domain solutions and one-way transfer

**NSA's National Cross Domain Strategy & Management Office (NCDSMO)** is "the focal point for U.S. Government cross domain capabilities and mission needs (pursuant to the authority of Executive Order 12333 and National Security Directive 42)." Its **Raise the Bar (RTB)** strategy "is intended to apply to and address improving the cybersecurity of **all** cross domain solutions used to protect U.S. Government classified information and all cross domain solutions being sold for export." ([NSA NCDSMO](https://www.nsa.gov/Cybersecurity/Partnership/National-Cross-Domain-Strategy-Management-Office/))

**The accreditation path, and why you do not want to be on it:**
- A CDS undergoes a **lab-based security assessment (LBSA)**, formerly certification test & evaluation, against NIST RMF + the CNSS CDS Overlay + RTB requirements; approval authority is DSAWG/CDTAB (DoD) or an IC AO (IC); then it is re-tested in the operational site infrastructure for the site AO's authorization. ([Owl Cyber Defense](https://owlcyberdefense.com/blog/cross-domain-solution-assessment-authorization-part-1/))
- Organizations "must not acquire or procure CDS technology until their connection requirement is approved by the Defense Security/Cybersecurity Authorization Working Group (DSAWG)," and if the requirement cannot be met by DISA's Cross Domain Enterprise Service, it must be met by technology **on the NCDSMO Baseline**. ([DA Pam 25-2-1](https://armypubs.army.mil/epubs/DR_pubs/DR_a/ARN36794-PAM_25-2-1-002-WEB-4.pdf))
- RTB drove "recognition that **hardware-enforced one-way transfer mechanisms are an essential component** for system and data owners that need cross domain transfer of information with either the source or destination being a less trusted network." ([Owl Cyber Defense](https://owlcyberdefense.com/blog/a-brief-note-on-raise-the-bar-and-one-way-transfer/))

**INFERENCE — the decisive design rule.** **Do not build, and do not require, a cross-domain solution.** Consume the buyer's existing accredited CDS. Concretely:

- **Low → high** (corpus snapshots, configs, model artifacts, benchmark scenario packs, code): route over an existing accredited OWT service (Glide OWT, DOTS, or the element's CDS). This direction is well-served and comparatively easy.
- **High → low** (evaluation results, calibration curves, aggregate metrics): this is the hard direction, and it is where the fixed-format design pays off. CDS filters are built for **structured, schema-validated, fixed-format** data — Owl's XD Bridge ST, for example, filters "structured (XML schemas) and fixed format (USMTF, VMF DFDL schemas) data messages" through a software-enforced linear assured pipeline. A metrics record that is a small, closed-vocabulary, schema-validated numeric tuple (regime tag, Brier, Brier skill, ECE, MCE, sharpness, coverage@N, α, N) is *filterable*. A free-text narrative is not. Design the high-side telemetry export as a fixed-schema numeric record from day one and the CDS conversation becomes tractable; design it as prose and it never crosses.

## 3.7 Vendor risk is now a first-order architecture requirement

This is the most consequential recent development for anyone building on a frontier model.

**Timeline (all confirmed):**
- **July 2025** — CDAO awards Anthropic a two-year prototype OT agreement, $200M ceiling. Anthropic states Claude is "integrated into mission workflows on classified networks" via Palantir, and Claude Gov models "already power deployments by agencies across the national security community atop infrastructure powered by AWS." ([Anthropic](https://www.anthropic.com/news/anthropic-and-the-department-of-defense-to-advance-responsible-ai-in-defense-operations))
- **9 January 2026** — SecDef instructs the department to adopt a policy requiring vendors to accept that their AI models may be deployed for "any lawful use." ([Arms Control Today](https://www.armscontrol.org/act/2026-07/news/us-senate-panel-approves-ai-autonomous-weapons-rules))
- **27 February 2026** — President directs all federal agencies to cease use of Anthropic technology; six-month phase-out; Pentagon announces a supply-chain risk designation. GSA removes Anthropic from USAi.gov and the Multiple Award Schedule the same day. ([Reuters](https://www.reuters.com/world/us/trump-says-he-is-directing-federal-agencies-cease-use-anthropic-technology-2026-02-27/); [GSA](https://www.gsa.gov/about-gsa/newsroom/news-releases/gsa-stands-with-president-trump-on-national-security-ai-directive-02272026))
- **5 March 2026** — formal designation under **10 U.S.C. §3252** (DFARS 252.239-7017/-7018), a statute previously applied only to foreign entities tied to adversary governments (Huawei, ZTE). A parallel designation under **FASCSA, 41 U.S.C. §4713** (FAR 52.204-28/-29/-30) applies government-wide in principle but as invoked applies only to DoW contracts. ([Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2026/07/dows-anthropic-ban-goes-live-a-confusing-patchwork-of-certification-demands-for-contractors))
- **9 March 2026** — Anthropic files two suits (N.D. Cal. for §3252; D.C. Circuit for §4713). ([Reuters](https://www.reuters.com/world/anthropic-sues-block-pentagon-blacklisting-over-ai-use-restrictions-2026-03-09/))
- **26 March 2026** — Judge Rita Lin grants a preliminary injunction against the §3252 designation, writing that it appeared to be "classic illegal First Amendment retaliation" and that "nothing in the governing statute supports the Orwellian notion that an American company may be branded a potential adversary and saboteur of the U.S. for expressing disagreement with the government." ([AP](https://apnews.com/article/pentagon-ai-anthropic-claude-judge-637d07aca9e480294380be0da1d0a514); [PI order](https://storage.courtlistener.com/recap/gov.uscourts.cand.465515/gov.uscourts.cand.465515.134.0_1.pdf))
- **3 April 2026** — GSA withdraws its removal announcement and restores Anthropic to the status quo ante. ([GSA](https://www.gsa.gov/about-gsa/newsroom/news-releases/gsa-issues-statement-on-anthropic-preliminary-injunction-04032026))
- **1 May 2026** — Anthropic is conspicuously absent from the eight-firm classified-network announcement. ([Breaking Defense](https://breakingdefense.com/2026/05/pentagon-clears-7-tech-firms-to-deploy-their-ai-on-its-classified-networks/))
- **30 July 2026** — cross-motions for summary judgment heard; Judge Lin says the government's record "in some ways, has gotten worse," and that she saw no evidence Anthropic could alter a delivered model or "flip some kind of kill switch." The government's formal risk-analysis memo is dated **2 March 2026** — after the 27 February directives. Decision under submission. ([Lawfare hearing diary](https://www.lawfaremedia.org/article/anthropic-v.-u.s.-department-of-war--a-hearing-diary); [FedScoop](https://fedscoop.com/anthropic-federal-government-federal-court/))
- **Current state (August 2026):** the §3252 designation is **enjoined**; the **FASCSA designation remains in effect** and the D.C. Circuit denied an emergency stay; DoW continues removing Anthropic software with a **30 September 2026** completion target; defense components and defense-industrial-base partners must remove all Anthropic software from their networks by **29 September 2026**. ([Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2026/07/dows-anthropic-ban-goes-live-a-confusing-patchwork-of-certification-demands-for-contractors); [MeriTalk](https://www.meritalk.com/articles/judge-questions-pentagon-evidence-behind-anthropic-supply-chain-risk-designation/))

**INFERENCE — three hard requirements this imposes:**

1. **Model-agnostic by contract, not by aspiration.** The technical volume must contain a named abstraction boundary, a conformance test suite for any candidate inference endpoint, and a stated switching time (measured, in hours). Offer to demonstrate a live model swap during evaluation.
2. **No kill switch, provably.** NSPM-11 requires assurance "through contractual clauses or other means, that no commercial entity… possesses the capability to prevent use of, disable or degrade, or materially modify without Federal Government knowledge and approval, an AI system." A deterministic kernel with a seeded PRNG and a hashed artifact is the strongest available *technical* answer: the numeric core's behavior is verifiable by re-execution and cannot be silently changed. Offer the government a signed hash manifest of the kernel and the config, and re-execution as the verification mechanism. **This is a direct, ready-made answer to an NSPM-11 pillar that most vendors will answer with a contract clause and nothing else.**
3. **FASCSA compliance machinery.** FASCSA clauses require monitoring, reasonable inquiry, **reporting within three business days** when covered use is identified, and mitigation planning. A software bill of materials that enumerates every model endpoint and every dependency, kept current, is the operational answer. Build it before it is asked for.

---

# PART 4 — DATA RIGHTS AND BUSINESS TERMS

## 4.1 The DFARS technical-data and software rights ladder

Governing clauses: **DFARS 252.227-7013** (technical data — other than commercial), **252.227-7014** (other-than-commercial computer software and documentation), **252.227-7015** (commercial technical data), **252.227-7018** (SBIR/STTR). ([acquisition.gov 7013](https://www.acquisition.gov/dfars/252.227-7013-rights-technical-data%E2%80%94other-commercial-products-and-commercial-services.))

**Development funding determines the license, per DFARS 227.7103-5:**
- Developed **exclusively at private expense** → **Limited rights** (technical data) / **Restricted rights** (software).
- Developed **exclusively at government expense** → **Unlimited rights**.
- **Mixed funding** → **Government purpose rights**.

**Government purpose rights, verbatim from 252.227-7014(c)(2)(ii):**

> "Government purpose rights shall remain in effect for a period of **5 years unless a different period has been negotiated**. **Upon expiration of the 5-year or other negotiated period, the Government shall have unlimited rights** in the computer software or computer software documentation. The government purpose rights period **commences upon execution of the contract**, subcontract, letter contract (or similar contractual instrument), contract modification, or option exercise that required development of the computer software."

**What "government purpose" means** (definition in 7013): "any activity in which the United States Government is a party, including cooperative agreements with international or multi-national defense organizations, or sales or transfers by the United States Government to foreign governments or international organizations. **Government purposes include competitive procurement**, but do not include the rights to use, modify, reproduce, release, perform, display, or disclose technical data for commercial purposes."

**What GPR actually costs you, in one sentence:** during the GPR period the government can hand your source code and design documentation to a competitor to re-compete the work, but not for commercial exploitation; when the period ends, the government gets **unlimited rights**, including the right to authorize others to use the data for commercial purposes.

**The negotiation levers:**
- The 5-year period is a *nominal default*. Per DFARS 227.7103-5(b)(2)/227.7203-5(b)(2): "The period during which government purpose rights are effective is negotiable… **Either party may request a different period. Changes to the government purpose rights period may be made at any time prior to delivery of the technical data without consideration from either party. Longer periods should be negotiated when a five-year period does not provide sufficient time to apply the data for commercial purposes.**"
- **Specifically negotiated license rights** (7013(c)(4), 7014(c)(4)) permit a bespoke license by mutual agreement, floor-limited to no less than limited/restricted rights.

**Marking is everything.** 7013(g) and 7014(g): "The Contractor… **may only assert restrictions** on the Government's rights… **by marking the deliverable data subject to restriction**," and only four legends are authorized (government purpose rights, limited/restricted rights, special license rights, and a copyright notice). Unmarked deliverables are, in practice, unlimited-rights deliverables.

**INFERENCE — the specific trap this architecture creates.** "Everything is config" means the most valuable IP is spread across three categories with different provenance: (a) the **deterministic kernel** and framework code — likely privately developed, assert restricted rights; (b) **config files** — actor models, judge panels, rubrics, thresholds — trivially copyable and, if delivered unmarked, effectively public; (c) **domain adapters** written under contract — government-funded, therefore unlimited rights. Establish a written **IP boundary and marking plan before the first deliverable**, treat config schemas as software (restricted rights) while accepting that instance configs written with government funding will be government-owned, and never let a domain adapter's source pull in kernel internals. This is cheap to do on day one and impossible to fix on day 400.

## 4.2 SBIR/STTR data rights — the strongest protection available to a small company

**The protection period: 20 years from date of award.** SBA's May 2, 2019 SBIR/STTR Policy Directive set a uniform 20-year protection period beginning on the **date of award** (previously 4–5 years from last deliverable), and eliminated the "roll-over" extension provision. ([SBIR.gov tutorial](https://www.sbir.gov/tutorials/data-rights/tutorial-2); [84 FR 12794](https://thefederalregister.org/documents/2019-06129/small-business-innovation-research-program-and-small-business-technology-transfer-program-policy-directive))

**What happens after 20 years** — verbatim from **48 CFR 227.7104-2**:

> "SBIR/STTR data rights provide the Government limited rights in such technical data and restricted rights in such computer software during the SBIR/STTR data protection period commencing on the date of contract award and ending 20 years after that date… **Upon expiration of the SBIR/STTR data protection period, the Government has government purpose rights in the SBIR/STTR data. These government purpose rights do not expire.**"

([Cornell LII, 48 CFR 227.7104-2](https://www.law.cornell.edu/cfr/text/48/227.7104-2))

Note the asymmetry: standard GPR *expires into unlimited rights*; SBIR post-protection GPR is **perpetual GPR** — the government never gets commercial-exploitation rights. SBA chose this deliberately: "providing the Government with Unlimited Rights after the protection period would not prohibit the release of such data to international concerns."

**During the protection period:** "the Government may not release or disclose technical data or computer software that is subject to SBIR/STTR data rights to any person except as authorized for limited rights technical data or restricted rights computer software."

**The consequences that create value:**
- **The government cannot compete your technology.** "This nondisclosure obligation means that the government cannot compete technologies containing SBIR Data. Any such competition would mean disclosing the SBIR Data in solicitations, which the government cannot do."
- **Phase III sole-source.** Phase III work — work that "derives from, extends, or completes" prior SBIR/STTR effort and is funded with non-SBIR money — may be awarded sole-source, and a Justification & Approval is no longer required "when a contracting officer determines that a technology that meets current agency requirements derives from, extends, or completes an effort made under a prior SBIR/STTR funding agreement issued competitively." Phase III can be a **subcontract** under a large prime.
- **The Phase III mandate.** Agencies "shall issue Phase III awards relating to technology, including sole source awards, to the SBIR and STTR award recipients that developed the technology" to the greatest extent practicable, and must document in writing to SBA why they did not.
- **Protection against coerced relinquishment.** DFARS 227.7104-1(a): "**Do not require an offeror, either as a condition of being responsive to a solicitation or as a condition for award, to sell or otherwise relinquish to the Government any rights in technical data**… developed under a SBIR/STTR contract."
- **No pre-award special-license negotiation.** 227.7104-2(c): "The Government shall not make contract award conditional on the contractor or subcontractor negotiating or consenting to negotiate special license rights."

**Marking discipline is load-bearing.** SBA warns: "Inclusion of the existing FAR or DFARS clauses without the extension provision could result in an SBIR/STTR Data Rights protection period of only **four or five years**." Check the clause in every award before signing; mark the title page with the exact directive legend and every subsequent page with "This page is protected by and subject to the SBIR Data Rights legend set forth on the title page"; mark briefing slides.

**INFERENCE — this is the single highest-leverage business decision available.** For a working prototype with 663 tests, an SBIR/STTR entry point converts the government's default posture (compete it away) into its opposite (it cannot be competed away, and must be sole-sourced to you, for twenty years). The IC has SBIR programs; IARPA, In-Q-Tel, and NGA's new Rapid Capabilities Office (using "the full range of acquisition authorities, including Other Transaction Authorities" — [Breaking Defense, 7 May 2026](https://breakingdefense.com/2026/05/ai-blueprint-coming-soon-to-nga-to-help-operationalize-geoint/)) are the adjacent doors.

## 4.3 Organizational Conflict of Interest — and the one that will actually bite

**Current rule:** FAR Subpart 9.5. Two underlying principles: "(a) Preventing the existence of conflicting roles that might bias a contractor's judgment; and (b) Preventing unfair competitive advantage." FAR 9.505-3: "Contracts for the evaluation of offers for products or services shall not be awarded to a contractor that will evaluate its own offers… without proper safeguards to ensure objectivity." ([FAR 9.5](https://www.acquisition.gov/far/subpart-9.5))

**Pending overhaul:** the FAR Council's proposed rule of 15 January 2025 (90 FR 4376) implements the **Preventing Organizational Conflicts of Interest in Federal Acquisition Act** (Pub. L. 117-324, 41 U.S.C. §2303). It would move OCI coverage from FAR 9.5 to a new **FAR Subpart 3.12**, retitle FAR Part 3 "Business Ethics and Conflicts of Interest," and codify three named OCI types:

- **Impaired objectivity** — "a situation in which an entity or its affiliate has or may have financial or other interests or an incentive to provide other than impartial advice to the Government, or the entity or its affiliate's objectivity in performing the contract work is or might be otherwise impaired."
- **Biased ground rules** — materially influencing the development of the requirement, evaluation criteria, or source-selection procedures for another contract.
- **Unequal access to information** — an unfair competitive advantage from government-provided nonpublic information.

New provisions/clauses: 52.203-XX (Potential OCI Disclosure and Representation), 52.203-DD (Postaward Disclosure), 52.203-MM (Mitigation), 52.203-LL (Limitation on Future Contracting), 52.203-AA (Unequal Access to Information — Representation). Mitigation plans become **contractually binding**. Contracting officers gain discretion to accept residual risk from impaired-objectivity OCIs only. Incumbency's "natural advantage" is expressly *not* an OCI. FY2025 NDAA §881 restricts OCI waiver delegation below the deputy agency head. ([Federal Register proposed rule](https://www.govinfo.gov/content/pkg/FR-2025-01-15/pdf/2024-31561.pdf); [Steptoe](https://www.steptoe.com/en/news-publications/far-council-issues-proposed-oci-far-rule.html); [Wiley](https://www.wiley.law/alert-FAR-Council-Proposes-Wholesale-Revamp-of-Organizational-Conflict-of-Interest-Rules); [Haynes Boone](https://www.haynesboone.com/news/alerts/preventing-the-fox-from-guarding-the-henhouse))

**Final-rule status as of August 2026: UNVERIFIED.** Comments closed 17 March 2025.

**INFERENCE — the OCI that will actually bite this company.** It is not unequal access, and it is not biased ground rules. It is **impaired objectivity**, and it arrives via the metrics package. If you build the simulator *and* score the simulator, you have a financial incentive to produce favourable numbers — textbook impaired objectivity, with the government as the only injured party. Three mitigations, in order of strength:

1. **Structural separation:** the government or an independent third party (FFRDC, UARC, an IARPA-style independent T&E team) holds the held-out benchmark, generates the ground truth, and computes the scores. You never see the answer key. This is the IARPA REASON model exactly (§5.2) and it is the strongest position available.
2. **Reproducibility as the audit mechanism:** deterministic seeded execution means any third party can re-run your artifact and independently recompute every metric. Offer this as a standing right.
3. **Firewall + binding mitigation plan** if 1 and 2 are unavailable — but note the proposed rule makes mitigation plans contractually enforceable, so promise only what you will do.

**Bonus:** volunteering structural separation *before* the CO raises it is a credibility move that costs nothing, because you already believe the numbers.

## 4.4 FASCSA and supply-chain designations

FASCSA clauses (**FAR 52.204-28, -29, -30**) restrict use of a designated product in contract performance and require monitoring, reasonable inquiry, **reporting within three business days** when covered use is identified, and mitigation planning. The DoD-specific authority (10 U.S.C. §3252) is implemented through **DFARS 252.239-7017 and -7018** and applies to covered defense procurements involving national security systems. ([Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2026/07/dows-anthropic-ban-goes-live-a-confusing-patchwork-of-certification-demands-for-contractors))

**INFERENCE:** a subcontractor or embedded model provider being designated mid-performance is now a demonstrated, non-hypothetical event. Contract terms should include a **substitution clause** entitling you to swap a designated component without breach, and pricing should not assume a single provider's economics.

## 4.5 M-25-22 contract terms (for the civilian/adjacent buyers)

For solicitations issued on or after ~30 September 2025 (excluding national-security acquisitions), agencies must address: use restrictions on government data; privacy/PII compliance; **vendor lock-in protections**; compliance with M-25-21 minimum practices for high-impact use; **clear delineation of data and IP ownership**; ongoing testing and monitoring; vendor performance requirements; and stakeholder notification before integrating new AI enhancements. Contracts should **prohibit using nonpublic agency data to train publicly or commercially available AI algorithms without explicit agency consent**. ([Ropes & Gray](https://www.ropesgray.com/en/insights/alerts/2025/04/white-house-issues-guidance-on-use-and-procurement-of-artificial-intelligence-technology); [Perkins Coie](https://perkinscoie.com/insights/update/white-house-unveils-updated-ai-guidelines-federal-agencies))

**Note for the technical volume:** commercial-item treatment under FAR Part 12 is the highest-leverage classification available for a productised platform, and streamlines compliance relative to noncommercial deliverables. Perkins Coie flags that the new guidance "will need to be reconciled with existing statutory and regulatory frameworks for the acquisition of commercial products and services defined in FAR Part 12."

---

# PART 5 — THE EVALUATION PROBLEM

## 5.1 What the IC actually does today — and the gap

The ODNI **Analytic Integrity and Standards Group (AIS)**, created per IRTPA, "conducts ICD 203 reviews of a randomly sampled selection of U.S. IC analytic products annually and submits a report to Congress summarizing its findings. AIS evaluators grade analytic products' adherence to ICD 203 standards on a **0 to 3 scale**, with zero being poor and three being excellent. Products are assessed by two graders who, after grading the product separately, discuss their grades together to reach a consensus. The grades are then reviewed by a third independent grader."

**And then the sentence that defines the market opportunity:**

> "**AIS grades products against all the analytic tradecraft standards except standard 8: 'Makes accurate judgments and assessments'. That is because of the difficulties in determining accuracy.**"

([Kevin Riehle, *How do we know if an intelligence analytic product is good?*, Intelligence and National Security, Feb 2025](https://doi.org/10.1080/02684527.2025.2468051); [full text PDF](https://bura.brunel.ac.uk/bitstream/2438/30804/5/FullText.pdf))

The IC's own quality-assurance program **omits accuracy** because accuracy is too hard to measure. That is a twenty-year-old, publicly documented, congressionally reported gap.

Three related findings sharpen it:

- Riehle's taxonomy of the three evaluation methods the IC has tried — tradecraft-standards grading, accuracy of judgments, and influence on decision makers — concludes "none of them is perfect and all three leave questions."
- Marcoci, Vercammen & Burgman ran controlled experiments on the AIS **Rating Scale for Evaluating Analytic Tradecraft Standards** and found that, without training, inter-rater reliability was low (ICC = 0.294, 95% CI [-0.330, 0.654] under equal weights; ICC ≈ 0 under weighted scoring), and that correlations with independent quality ratings were low-to-moderate (r = .293 / .262). They conclude: "we do not yet have empirical confirmation that the third assumption (that reports that satisfy the ICD203 criteria consistently produce accurate predictions of outcomes) behind ICD203 holds." ([Intelligence and National Security, 2018](https://doi.org/10.1080/02684527.2018.1546265))
- Congress keeps asking. FY23 IAA §6312 (as amended by the FY2026 IAA, Pub. L. 119-60, Dec 2025) requires each IC element to run a **dedicated, stand-alone annual ICD 203 training program**, certify completion to the intelligence committees, and requires the DNI to report **by February 1 each year** on ICD 203 compliance incidents reported to analytic ombudspersons, "including the number and themes of such incidents and a list of each intelligence product reported." Each element's head of analysis must also report how ICD 203 compliance factors into performance evaluations, merit pay, bonuses, and promotions. ([50 U.S.C. §3364 notes](https://uscode.house.gov/view.xhtml?req=%28title%3A50+section%3A3364+edition%3Aprelim%29))

**INFERENCE — the central value proposition, stated precisely.** *The IC grades eight of its nine tradecraft standards and skips the ninth because accuracy has been unmeasurable at scale. Krippendorff α across judges addresses the demonstrated inter-rater reliability problem in the existing rating scale. Brier, Brier skill vs. explicit baselines, Murphy decomposition, and ECE address Standard 8. The measured false-abstention rate addresses the objection that a system would game Standard 8 by declining to answer. This is not a faster version of what AIS does — it is the part AIS has never been able to do.*

## 5.2 The precedent that defines what "good" looks like: IARPA REASON

**REASON** (Rapid Explanation, Analysis and Sourcing Online) is the closest existing government program to this product class, and its evaluation design is the template a government reviewer will have in mind.

Design facts from the BAA:
- Three task areas: TA1 identify additional supporting **and contrary** evidence; TA2 identify reasoning strengths and weaknesses; TA3 produce comments that improve argumentation.
- **Independent T&E team**, separate from performers, with a program-provided API for assessment.
- Testing "over three cycles each, where each cycle includes both **unclassified and classified testing**," with a final exam on unclassified data.
- TA2 scored on true positives / false positives / false negatives against a rubric.
- TA3 scored on **REASON Comment Quality (RCQ)** — correctness, appropriateness, clarity, 1 (poor) to 4 (excellent).
- Final exam scored with **Report Quality Score (RQS)**: "**RQS is based on scores of six of the IC Analytic Tradecraft Standards: sourcing, uncertainty, assumptions, alternatives, logic, and accuracy.** Each finished report will be graded on each standard, with a range from 1 (poor) to 4 (excellent), so RQS values range from 6 to 24. Each performer system's RQS will be compared to the RQS for the **control group**."
- Explicitly: REASON "is not designed to replace analysts, write complete reports, or to increase their workload."

([IARPA REASON](https://www.iarpa.gov/research-programs/reason); [REASON BAA, W911NF-23-S-0007](https://arl.devcom.army.mil/wp-content/uploads/sites/3/2023/04/W911NF-23-S-0007-REASON-BAA-Final-17-March-2023.pdf))

**Four things to steal from REASON, verbatim:**
1. **Report against six named tradecraft standards, 1–4 each, 6–24 total.** Adopt RQS as a reported metric. It is the government's own rubric, it includes accuracy, and reporting it means a reviewer can compare you to a program they already funded.
2. **Always report against a control group / baseline.** REASON's metric is the *delta* vs. control. Brier skill vs. explicit baselines is the same idea; align the vocabulary.
3. **Independent T&E, by design.** This resolves the impaired-objectivity OCI (§4.3) and matches how IARPA already buys.
4. **Cycles at both classification levels.** The dual-tier architecture should be presented as an *evaluation* architecture first: identical scenarios run unclassified and classified, with congruent results per ICD 208.

## 5.3 The regime that actually governs a simulator: M&S VV&A

This is the most under-appreciated point in the whole report. A simulate-and-adjudicate platform is not primarily an "AI system" under DoD/IC policy; it is a **model and simulation**, and M&S has a mature, forty-year-old accreditation regime.

**DoDI 5000.61** policy, verbatim:
> "a. Models, simulations, and associated data used to support DoD processes, products, and decisions shall undergo verification and validation (V&V) throughout their lifecycles.
> b. Models, simulations, and associated data used to support DoD processes, products, and decisions **shall be accredited for an intended use**."

Definitions: **accreditation** = "the official certification that a model or simulation and its associated data are acceptable for use for a specific purpose"; **validation** = "the process of determining the degree to which a model or simulation and its associated data are an accurate representation of the real world **from the perspective of the intended uses**"; **verification** = "the process of determining that a model or simulation implementation and its associated data accurately represent the developer's conceptual description and specifications." Documentation standard: **MIL-STD-3022**. ([DoDI 5000.61](https://pdf4pro.com/file/8a5d5/Portals_54_Documents_DD_issuances_dodi_500061p.pdf.pdf))

**DoDM 5000.102** (DOT&E, 9 December 2024) adds the operational-test layer, and contains three sentences that read as if written for this product:

- "The accreditation plan will establish performance parameters and acceptability criteria, **including acceptable uncertainty in the M&S results for their intended use**. The accreditation plan will be developed at the beginning of the VV&A process based on applied mathematics, statistics, and other science-based test design and analysis methods."
- "**M&S may not be validated using data which was used to create, fit, or train it.**"
- "The V&V and accreditation reports must **characterize the significance of the M&S uncertainty with respect to its specific intended uses** and the criteria that were used to accredit the M&S for those intended uses."

([DoDM 5000.102](https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodm/5000102m.PDF))

Two more operative rules from Air Force implementation and DOT&E guidance:
- **"Accreditation by definition is for a specific intended use… Accrediting for a new intended use, or re-accreditation, requires a new accreditation decision. Reusing an existing M&S requires M&S accreditation for the new intended use."** ([AFI 16-1001](https://static.e-publishing.af.mil/production/1/saf_sa/publication/afi16-1001/afi16-1001.pdf))
- "In general, **the more important the M&S results are to the final evaluation, the more rigorous the VV&A process must be**." And the accreditation statement should acknowledge limitations explicitly, e.g. "The Big Weapon Model does not include threat countermeasures, and consequently all scenarios are simulated in a clear environment." ([DOT&E M&S for T&E Guidance 3.0](https://www.dote.osd.mil/Portals/97/docs/TEMPGuide/MandS_for_TandE_Guidance_3.0.pdf))

**INFERENCE — four consequences, each of which changes what you build and what you promise:**

1. **"Everything is config" collides with "accreditation is for a specific intended use."** Every new scenario config is arguably a new intended use requiring a new accreditation decision. The mitigation is to accredit the **kernel and the framework** once, against a defined envelope of scenario classes, and define a **lightweight config-conformance check** that establishes a new config falls inside the accredited envelope. Design that check now. If you do not, the config-driven flexibility that is your best engineering property becomes an accreditation treadmill.
2. **You need a stated validity envelope, and you need to state where it ends.** The measured degradation to **-0.46 Brier skill under deliberate misspecification** is not an embarrassment — it is exactly the "capabilities, limitations, risks, and assumptions" documentation DoDI 5000.61 §8.2 requires, and it defines the envelope's boundary empirically. Present it as the model's characterised failure mode, alongside the well-evidenced (+0.44), medium (+0.42), and wide-prior (+0.11) results.
3. **The 15,832-run synthetic-oracle corpus is verification evidence, not validation evidence.** DoDM 5000.102's prohibition on validating with data used to create or fit the model is exactly why the evaluation-regime tag exists. Present the three regimes in VV&A vocabulary: `synthetic_oracle` = **verification** (does the implementation match the specification?); `historical_backtest` = **partial validation** against the real world with contamination risk that must be argued down; `live_post_cutoff` = **validation**, the only regime that supports an operational accreditation. Then say plainly: *we have verification; we have not yet earned validation; here is the design of the study that would produce it.*
4. **Name the accreditation authority in the proposal.** DoDI 5000.61: the accreditation authority "is the individual who is responsible and accountable for decisions or actions based upon the specific M&S usage." Asking *who will be the accreditation authority for this M&S, and what are their acceptability criteria?* is the question that marks you as someone who has done this before.

## 5.4 What the metrics package should be measured against

**Brier score** is the government's own scoring rule for probabilistic forecasts, established through IARPA's **ACE** program. Baselines that exist and are citable:

- ACE ran four years of tournaments with five university teams; the Good Judgment Project's dataset — **764,448 forecasts by 1,718 individuals across 288 questions, 2011–13** — is public at Harvard Dataverse. ([IARPA](https://www.iarpa.gov/newsroom/article/iarpa-announces-publication-of-data-from-the-good-judgment-project); [dataverse](https://dataverse.harvard.edu/dataverse/gjp))
- Effect sizes to benchmark against: a **<1 hour** probabilistic-reasoning training module improved Brier scores **6–11%** over control across all four years; superforecaster teams' simple median was "**35% to 72% more accurate than any other research team in the competition**"; Good Judgment beat the control group "by more than 50%… the largest improvement in judgmental forecasting accuracy observed in the literature." ([Mellers et al., *Psychological Strategies for Winning a Geopolitical Forecasting Tournament*](https://faculty.wharton.upenn.edu/wp-content/uploads/2015/07/2014---psychological-strategies-for-winning-a-tournament.pdf); [Chang et al., *Developing expert political judgment*](https://goodjudgment.com/wp-content/uploads/2018/12/jdm16511.pdf); [Good Judgment](https://goodjudgment.com/resources/the-superforecasters-track-record/the-first-championship-season/))
- **Murphy decomposition into calibration and resolution** is the standard, published, government-funded analysis path: "Brier scores can be decomposed into three additive parts—variability, calibration, and resolution—two of which bear on forecasting skill (Murphy & Winkler, 1987)." Calibration improved with training; **resolution** was where superforecasters' advantage was largest. All forecasters were overconfident; calibration was worst at forecasts of 100%.

**INFERENCE — the honest and therefore strongest framing.** The government has a two-decade, publicly documented, publicly datasetted baseline for human geopolitical forecasting skill. A system that reports Brier skill against *the same scoring rule*, decomposes it the *same way*, and states plainly that its real-world skill is **not yet measured** is speaking the buyer's own dialect. A system that reports a bespoke composite score is not.

The specific evaluation that would settle the question — and which should be the proposed Phase II / option-year deliverable — is: **N questions, resolved after the model's training cutoff, scored against the GJP-derived human baseline and against the base-rate baseline, with the answer key held by an independent party, run in both unclassified and classified tiers, results reported with regime tags and no pooling.** That study does not exist. Proposing it, with a cost and a schedule, is more persuasive than any claim about the system's capability.

## 5.5 What independent verification would concretely look like

Assembled from the precedents above:

| Element | Who does it | Precedent |
|---|---|---|
| Held-out benchmark construction and ground truth | Government or independent T&E team; vendor never sees answer key | IARPA REASON independent T&E; AI Framework "independent reviewing authority not directly involved in the system's development" |
| Scoring against control/baseline | Same independent party | REASON RQS vs. control group; Brier skill vs. explicit baseline |
| Human-AI-system evaluation (not model-alone) | Operational test agency or element analytic cadre | CDAO: "with generative AI, evaluating the human-AI system as a unit has become even more vital"; CDAO HSI T&E framework (13 HSI concepts incl. mental models, XAI, function allocation) |
| Reproducibility audit | Any third party, by re-execution of the hashed artifact | ICD 505 §D.4.c "reviewable and verifiable by IC element personnel"; DoD "Traceable" principle |
| Model card, data card, kernel card | Vendor; reviewed by government testers | DoDM 5000.101 |
| M&S accreditation for stated intended use, with acceptability criteria set **before** V&V | Accreditation authority designated by the using organization | DoDI 5000.61; DoDM 5000.102; MIL-STD-3022 |
| Adversarial / red-team evaluation | Element personnel, **with CAIO pre-approval** | ICD 505 §D.5.c(1) |
| Ongoing monitoring for performance shift | Element, at a determined periodicity | ICD 505 §D.5.e; M-25-21 minimum practice iii |
| Inter-rater reliability of any human grading in the loop | Independent; report ICC/α | Marcoci et al. found ICC = 0.294 for the existing AIS scale |

**Plausible independent evaluators** (this list is **INFERENCE**, not confirmed availability): IDA and MITRE (FFRDCs with existing IC/DoD analytic-methods work), an IARPA-style contracted T&E team, DOT&E for any DoD program of record (noting the FY27 budget pressure on DOT&E), NGA's 90-day **computer-vision model accreditation campaign** as a structural precedent for a fast vetting pipeline that confers competitive advantage ([Breaking Defense, 3 May 2026](https://spacenews.com/nga-pushes-ai-adoption-as-demand-grows-for-always-on-intelligence/)), and CAISI for unclassified national-security-relevant evaluations.

---

# PART 6 — THE DUAL-TIER SUBSTITUTION TABLE

For each component: the unclassified-now implementation, the classified-later substitute, and the **specific** accreditation obstacle. Rows 1–5 are the requested components; rows 6–10 are additions that will be asked about and are cheaper to answer now.

| # | Component | Unclassified tier (now) | Classified-mode substitute | Specific accreditation obstacle |
|---|---|---|---|---|
| **1** | **LLM inference** (framing, setup, interpretation — never the math) | Commercial API or FedRAMP-authorized managed service: Amazon Bedrock in GovCloud (FedRAMP Class D/High, IL4/5) or Vertex AI (FedRAMP High/IL2). Model-agnostic behind a conformance-tested abstraction boundary. | **Secret (IL6):** Azure OpenAI in Azure Gov Secret (IL6-authorized Feb 2025; GPT-5.2 available Jan 2026); Google Distributed Cloud air-gapped (IL6 PA May 2025, Gemini Pro/Flash in IL6 scope). **TS/SCI:** Amazon Bedrock in AWS Top Secret cloud (GA Jan 2025); Azure Gov Top Secret under ICD 503 ATO; GDC air-gapped at TS. **Fully disconnected fallback:** open-weight model on GDC-managed K8s or Azure ML, both of which explicitly support customer-supplied open-source models. | (a) **You do not hold the ATO — the CSP does, per service.** Inheriting an IL6/ICD 503 authorization requires your application to be assessed as a delta against that boundary; ICD 503 §D.4.b preserves the AO's right to test "configuration differences introduced by the system… in a new environment." (b) **No FedRAMP path above Class C without an agency sponsor**, and Class D 20x is not piloted until ~FY27 Q2. (c) **Model availability is not uniform across clouds or classification levels** and changes quarterly — an architecture pinned to one model at one level is not portable. (d) **Vendor political risk is real and demonstrated** (Feb–Aug 2026 designations; 29–30 Sep 2026 removal deadlines) — model swap must be a config change, provable in hours. (e) NSPM-11 requires assurance that no vendor can disable/degrade/materially modify the system without government approval — a hosted third-party endpoint makes this contractual rather than technical; the deterministic kernel is the part you can prove. |
| **2** | **Corpus / retrieval** (as-of dated, hard date filter, runtime post-dating assertion) | Curated PAI/CAI corpus with immutable as-of snapshots; hard date filter in retrieval; runtime throw on any post-dated evidence reference. No model fine-tuning on corpus content. | High-side corpus of classified reporting + sanitized PAI, ingested via an **existing accredited one-way transfer** (Glide OWT, DOTS, or element CDS). Same as-of snapshot discipline; same runtime assertion; **same code path** — only the corpus adapter config changes. | (a) **CAI/PAI legal regime:** ICPM 504(01) (IC Policy Framework for Commercially Available Information, revised 2025) plus each element's **AG Guidelines** govern acquisition, query, retention, and dissemination — this is a lawyer-gated process, not a technical one. (b) **The Interim Guidance "collection" trap:** a prompt returning information the element does not currently hold "should be considered collection… if the information is copied, saved, supplemented, or used." Retrieval outputs retained in artifacts may constitute collection. (c) **ICD 206 §D.5 retention:** dynamic/ephemeral sources must be preserved ≥1 year, and for time-horizon products, for the horizon or 5 years whichever is shorter — the snapshot store is a records-management system subject to element retention policy. (d) **Classification by compilation** (ICD 505 §D.7.a(1)) — an aggregated corpus may classify higher than any constituent; requires an OCA determination and an SCG. (e) **No fine-tuning, ever** — a model augmented with IC-collected information cannot be shared with another IC element or non-IC entity absent separate legal consideration. |
| **3** | **Artifact store** (configs, seeds, run artifacts, hashes, provenance chains) | Content-addressed object store; every run's config + seed + artifact hash immutable and re-executable; WORM retention; provenance chain per claim. | High-side object store inside the accredited enclave (S3 in AWS TS cloud / Azure Gov TS storage / GDC air-gapped object store). **Artifacts never leave the enclave.** Only the fixed-schema metrics record (row 5) crosses domains. | (a) **Artifacts inherit the classification of their inputs**, including by compilation; the store is a classified repository requiring an OCA-approved SCG covering simulator *outputs*, not just inputs. (b) **ICD 505 §D.4.c auditability** — audit results must be "reviewable and verifiable by IC element personnel," implying cleared-personnel-accessible tooling inside the enclave. (c) **ICD 206 §D.6** — the product with all sourcing must be retained as a document of record and identical versions submitted to the **Library of National Intelligence**; the artifact store must interoperate with LNI or successor. (d) **ICD 208 §D.2.c(3) congruence** — if a sanitized version exists, its facts, judgments, confidence levels, and probabilistic language must match the classified parent; a *runtime assertion enforcing tearline congruence does not currently exist and should be built*. (e) Records-management and disposition schedules apply; deletion of a classified artifact is not a `DELETE`. |
| **4** | **Dashboard / product surface** (BLUF, I&W, key assumptions + falsifiers, provenance, reliability diagrams) | Web app in the FedRAMP/IL5 boundary; CAC/PIV auth; renders ICD 203-compliant BLUF with likelihood and confidence as structurally separate fields; ICD 206 SRC endnotes; ICS 206-01 AI-citation block; ICD 505 AI watermark. | Same application, deployed inside the IL6/ICD 503 enclave; identity from the enclave's IdP (PKI/PIV-I); classification banners and portion marking per ICD 710; tearline generation per ICD 209. | (a) **Marking and banner compliance** — ICD 710 classification and control markings, portion marking on every SRC endnote (ICD 206 §D.3.a(6)(a)), and per ICD 206 §D.4.c the ability to omit SRC elements so an endnote does not exceed the body's classification while remaining searchable. (b) **ICD 505 §D.6.b watermark** — products "produced or substantially influenced by IC AI" must inform recipients, and the watermark must survive export, print, and tearline. (c) **The review/challenge/reject/replace workflow (§D.6.a(2)) is an accreditation artifact**, not a UI nicety — it is the evidence that a human owns the judgment. (d) STIG-compliant configuration and DISA/IC hardening for anything on the high side. (e) Foreign disclosure and release controls (ICD 403) if any product may be shared with Five Eyes/NATO. |
| **5** | **Telemetry / metrics** (Brier, skill, Murphy, ECE/MCE, sharpness, coverage@N, α, tail recall, stability, cost/insight) | Metrics computed in-boundary; reports carry a mandatory `evaluation_regime` tag (`synthetic_oracle` \| `historical_backtest` \| `live_post_cutoff`); no function pools across regimes. | Metrics computed **inside** the classified enclave. Only an aggregate, **fixed-schema, closed-vocabulary numeric record** exits high→low via the element's accredited CDS. No free text, no exemplars, no question strings, no source identifiers. | (a) **High→low is the hard direction.** It requires a CDS on the **NCDSMO Baseline**, meeting current **Raise the Bar** requirements, with a DSAWG-approved connection requirement — and per Army guidance, organizations "must not acquire or procure CDS technology until their connection requirement is approved." You must consume an existing CDS; building one is a multi-year LBSA program. (b) **CDS filters accept structured/fixed-format data** (XML/USMTF/VMF DFDL schemas via assured pipelines) — design the metrics record as a schema-validated numeric tuple or it will never be approved to cross. (c) **Aggregate metrics can leak.** Coverage@N over a classified question set, tail-recall on a specific scenario class, or per-question Brier scores can reveal collection posture, priorities, or gaps — expect a **classification-by-compilation** review of the metrics schema itself and design for k-anonymity / minimum aggregation thresholds. (d) **Regime tags must survive the crossing**; a metrics record whose regime tag is stripped by a filter is worse than no record. |
| **6** | *(addition)* **Deterministic numeric kernel** (seeded PRNG, no wall clock, no `Math.random`) | Pure library; byte-identical output per seed; hash-verifiable; unit-tested. | **Identical binary**, hash-verified on the high side. This is the one component that should be bit-for-bit the same across tiers. | (a) The kernel is the **M&S** under DoDI 5000.61 and must be **accredited for a specific intended use** with acceptability criteria set before V&V, per DoDM 5000.102. (b) "Accreditation… is for a specific intended use… Reusing an existing M&S requires accreditation for the new intended use" — define an accredited scenario-class envelope and a config-conformance check, or every new config is a new accreditation. (c) VV&A documentation per MIL-STD-3022, including capabilities, limitations, risks, assumptions, and quantified uncertainty. (d) **Cross-tier hash equality is itself an accreditation artifact** — it proves the classified deployment is the verified artifact. Make hash attestation a formal deliverable. |
| **7** | *(addition)* **Config repository** (actor models, judge panels, rubrics, thresholds, domain adapters) | Version-controlled, signed, reviewed; configs are the ICS 206-01 citation payload. | High-side git/artifact repo inside the enclave; low→high sync via accredited OWT; signed commits; a classified config never syncs downward. | (a) **A config may itself be classified** — an actor model of a named adversary's decision calculus, with riskTolerance and escalationPropensity parameters, is a finished analytic judgment about a foreign leadership and will require an OCA determination and an SCG. (b) **Data rights:** configs written under government funding are government-owned; the kernel and schema are yours; the boundary must be established and marked before first delivery (§4.1). (c) **ICD 505 §D.5.f** — 30 days' advance notice to the IC CAIO for changes that could degrade another element's operations; config changes are in scope. (d) Change control must satisfy ICD 503 significant-change / continuous-monitoring requirements. |
| **8** | *(addition)* **AI provenance / model registry entry** | Internal registry: model, version, endpoint, settings, prompts, kernel hash, config hash, seed, evaluation-regime results. | Registered in the **IC AI model registry** designated by the IC CAIO; entries must be electronically discoverable and accessible IC-wide, with a separate registry for entries exempt from discovery under ICPG 501.1. | (a) **The IC AI model registry's designation status and required entry content are UNVERIFIED** as of August 2026 — ICD 505 §D.4.d directs the IC CAIO to designate one and determine entry content; whether it exists and what it demands is not publicly documented. Design the provenance record to be a superset of ICS 206-01's seven AI-citation elements and expect to remap. (b) Registry entries may be classified. (c) Registration is a precondition for the CAIO consultation in the accreditation path (§D.5.d). |
| **9** | *(addition)* **Evaluation harness + benchmark corpus** (synthetic closed worlds, held-out ground truth) | Vendor-run for `synthetic_oracle`; **independently held answer key** for any `historical_backtest` or `live_post_cutoff` claim. | High-side benchmark of classified scenarios, constructed and held by the element or an independent T&E team; vendor executes, never scores. | (a) **Impaired-objectivity OCI** (FAR 9.5 today, proposed FAR 3.12) if the builder is also the scorer — resolve structurally, not by firewall. (b) **DoDM 5000.102:** "M&S may not be validated using data which was used to create, fit, or train it" — the harness must enforce and evidence separation. (c) **ICD 505 §D.5.c(1):** adversarial/red-team testing against IC element AI requires **IC element CAIO pre-approval**. (d) Synthetic closed worlds whose ground truth did not exist before the run are the strongest available answer to training-data contamination — but the *generation procedure* must itself be verifiable and independently re-executable, or it is an unfalsifiable claim. |
| **10** | *(addition)* **Human review workflow** (analyst accepts/challenges/rejects/replaces; named accountable analyst) | First-class product feature; every judgment carries a named accountable human and an audit trail of what the human changed. | Identical, inside the enclave, bound to enclave identity and cleared personnel. | (a) **ICD 505 §D.6.a** — "IC personnel shall remain responsible and accountable for the analysis, decisions, and outcomes derived from insights gleaned using AI"; §D.6.a(2) requires the ability to review, challenge, and reject or replace. (b) **The gap is the opportunity:** the UVA NSDPI report finds current policy "creates the opportunity, but not an obligation" and lacks "enforceable standards for human accountability" — a workflow that *records* the human's action is the enforcement mechanism policy lacks. (c) **Automation bias** is a named minimum practice (AI Framework: "develop processes, including training, to mitigate the risk of overreliance on AI systems") and a CDAO HSI T&E concept — the workflow must be evaluated for whether analysts actually exercise rejection, not merely whether the button exists. (d) Training and assessment of operators is a minimum practice in both the AI Framework and M-25-21. |

---

# PART 7 — OPEN QUESTIONS AND UNVERIFIED ITEMS

Flagging these explicitly so nothing here gets asserted as fact downstream.

1. **Has ICD 505 been amended post-NSPM-11?** §D.5.b incorporates NSM-25 and the AI Framework by reference; both are rescinded. Whether ODNI has issued a technical amendment, or whether the forthcoming CNSS/OMB NSS governance policy will supply the replacement, is **UNVERIFIED**.
2. **Has the CNSS/OMB AI governance policy for national security systems been issued?** Due ~3 September 2026 under NSPM-11 §3(c). **UNVERIFIED** — and it is the single most important forthcoming document for this product.
3. **Have the standardized national-security TEVV methodologies been submitted or published?** Due ~3 October 2026 under NSPM-11 §4(f). **UNVERIFIED**. This is the eight-week window referenced in §2.4.
4. **Contents of the NSPM-11 classified annex.** Due ~3 September 2026; contents not public.
5. **ICS 206-01's exact AI-citation element list.** I could not retrieve the primary ICS text; the seven-element list in §1.4 comes from two secondary analyses. **Verify against the primary standard before quoting it in a proposal.**
6. **Status of the ODNI Interim Guidance on Foundation AI Models.** Written under EO 14110 / a "forthcoming NSM," both now rescinded. Whether it has been reissued, superseded, or silently retained is **UNVERIFIED**; the UVA policy map explicitly flags this as unresolved.
7. **Whether the FAR OCI final rule has issued.** Proposed 15 January 2025; comments closed 17 March 2025; final-rule status as of August 2026 **UNVERIFIED**. Also unverified: whether the FY2025 NDAA §881 waiver-delegation restriction was incorporated.
8. **The January 2026 DoD CC SRG update.** Referenced by a secondary source (LegalClarity); **not verified against the primary SRG**. If IL definitions or FedRAMP+ control counts matter to a specific claim, pull the current SRG from DISA Cyber Exchange.
9. **Whether the IC AI model registry has been designated**, and what entry content the IC CAIO has determined. **UNVERIFIED**.
10. **Final outcome of the Anthropic litigation.** Judge Lin took the §3252 cross-motions under submission on 30 July 2026; no written order located as of 10 August 2026. The D.C. Circuit FASCSA case is argued and undecided. Both are expected to be appealed. **Do not assume either outcome.**
11. **Whether ICD 203 has been amended to address generative AI.** As of the sources reviewed, no. The Belfer proposal remains a proposal.
12. **NGA's forthcoming AI framework** ("blueprint for becoming an AI first organization," announced 7 May 2026 as "working to finalize") — contents not public. Relevant if NGA is an adjacent buyer.
13. **Whether AIS has begun grading Standard 8.** Riehle's Feb 2025 article says no. Whether that changed in 2025–26 is **UNVERIFIED** and worth checking before making the "the IC skips accuracy" claim in a proposal, because it is the load-bearing claim.

---

# PART 8 — THE FIVE THINGS TO BUILD OR WRITE NEXT

Ordered by leverage per unit of effort, all derived from gaps identified above.

1. **A tearline-congruence runtime assertion.** ICD 208 §D.2.c(3) requires facts, judgments, confidence levels, and probabilistic language to be congruent between a sanitized product and its higher-classified parent. Enforce it in code, the way the as-of date assertion is enforced. This is the dual-tier architecture's equivalent of the leakage guard and it does not appear to exist.
2. **A model/data/kernel card triple.** DoDM 5000.101 requires model cards and data cards. The kernel card — equations, assumptions, validated envelope, seeded-PRNG spec, hash — is the artifact nobody else can produce and it doubles as the DoDI 5000.61 §8 VV&A documentation.
3. **A config-conformance check defining the accredited scenario envelope.** Without it, "a new scenario is a new config file" becomes "a new scenario is a new accreditation decision."
4. **A fixed-schema, closed-vocabulary metrics record designed for CDS filtering.** Numeric tuple, schema-validated, regime tag mandatory, no free text. Design it now; retrofitting a prose report into a CDS-crossable format is not possible.
5. **A written IP boundary and marking plan**, plus an SBIR/STTR entry decision. The 20-year protection period, the non-expiring-GPR endgame, the government's inability to compete protected data, and the Phase III sole-source mandate together constitute the strongest legal position available to a small company in this market — and all of it depends on getting the clause and the legend right in the first award.

---

## Sources

**Analytic standards**
- [ICD 203, Analytic Standards (as amended)](https://irp.fas.org/dni/icd/icd-203.pdf) · [combined ICD 203/206/208 PDF](https://www.bmbs.org/salamanca/readings/ODNI_ICDs_203-206-208.pdf) · [ICD 203 (Georgetown mirror)](https://donohueintellaw.ll.georgetown.edu/sites/default/files/assets/ICD%20203%20Analytic%20Standards.pdf)
- [ICD 206, Sourcing Requirements](https://irp.fas.org/dni/icd/icd-206.pdf) · [ICD 208, Maximizing the Utility of Analytic Products](https://www.dni.gov/files/documents/ICD/ICD-208-Maximizing-the-Utility-of-Analytic-Products-2017-01-09.pdf)
- [ICS 206-01 analysis — Pangea Research](https://pangearesearch.substack.com/p/sourcing-for-osint-icd-206-01) · [OSINT Ambition](https://publication.osintambition.org/ics-206-01-the-new-standard-every-osint-professional-must-know-0bbaaa698846)
- [ODNI: Objectivity / IC Analytic Standards](https://www.dni.gov/index.php/how-we-work/objectivity) · [50 U.S.C. §3364 (IRTPA §1019)](https://uscode.house.gov/view.xhtml?req=%28title%3A50+section%3A3364+edition%3Aprelim%29)
- [Riehle, *How do we know if an intelligence analytic product is good?* (2025)](https://doi.org/10.1080/02684527.2025.2468051) · [full text](https://bura.brunel.ac.uk/bitstream/2438/30804/5/FullText.pdf) · [Marcoci, Vercammen & Burgman (2018)](https://doi.org/10.1080/02684527.2018.1546265)
- [Belfer, *Analytic Tradecraft Standards in an Age of AI*](https://www.belfercenter.org/sites/default/files/2024-08/Gerald%20McMahon%20Belfer%20Report%20IntelProject_AI_AnalyticTradecraft.pdf) · [UVA IC Data Policy Map & Reference Guide](https://nationalsecurity.virginia.edu/sites/default/files/files/2026-04/intelligence_community_data_policy_map_and_reference_guide.pdf) · [UVA NSDPI, IC Data Strategy implications](https://nationalsecurity.virginia.edu/sites/default/files/files/2026-04/00032_20260302%29_nsdpi_legal%2C_ethical%2C_and_policy_implications_of_the_u.s_intelligence_community_data_strategy.pdf)

**AI governance**
- [ICD 505, Artificial Intelligence](https://www.dni.gov/files/documents/ICD/ICD-505-Artificial-Intelligence.pdf) · [Principles of AI Ethics for the IC](https://www.intelligence.gov/ai/principles-of-ai-ethics) · [AI Ethics Framework for the IC](https://www.intelligence.gov/ai/ai-ethics-framework) · [ODNI AI hub](https://www.intel.gov/ai)
- [Common IC Interim Guidance on Foundation AI Models](https://www.intel.gov/assets/documents/702-documents/declassified/2024/Common_Intelligence_Community_Interim_Guidance.pdf)
- [NSM-25 (govinfo)](https://www.govinfo.gov/content/pkg/DCPD-202400945/pdf/DCPD-202400945.pdf) · [Framework to Advance AI Governance and Risk Management in National Security](https://data.aclum.org/storage/2025/01/WhiteHouse_ai_gov_wp-content_uploads_2024_10_NSM-Framework-to-Advance-AI-Governance-and-Risk-Management-in-National-Security.pdf) · [CSIS explainer](https://www.csis.org/analysis/biden-administrations-national-security-memorandum-ai-explained)
- [NSPM-11 (White House)](https://www.whitehouse.gov/presidential-actions/2026/06/national-security-presidential-memorandum-nspm-11/) · [NSPM-11 (govinfo)](https://www.govinfo.gov/content/pkg/DCPD-202600387/pdf/DCPD-202600387.pdf) · [White House fact sheet](https://www.whitehouse.gov/fact-sheets/2026/06/fact-sheet-president-donald-j-trump-signs-historic-directive-on-ai-in-the-national-security-enterprise/) · [Benton](https://www.benton.org/blog/president-trump-signs-directive-reshaping-how-military-and-intelligence-community-use-ai) · [Crowell](https://www.crowell.com/en/insights/client-alerts/national-security-memorandum-aims-to-accelerate-deployment-of-ai-and-streamline-procurement-aligned-to-administration-policies) · [Ward & Berry](https://www.wardberry.com/harden-it-or-ship-it-what-the-ai-executive-order-and-nspm-11-mean-for-government-contractors/) · [EPIC](https://epic.org/white-house-publishes-national-security-presidential-memorandum-removing-guardrails-on-ai/)
- [OMB M-25-21](https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-21-Accelerating-Federal-Use-of-AI-through-Innovation-Governance-and-Public-Trust.pdf) · [OMB M-25-22](https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-22-Driving-Efficient-Acquisition-of-Artificial-Intelligence-in-Government.pdf) · [Wiley](https://www.wiley.law/alert-Trump-Administration-Revamps-Guidance-on-Federal-Use-and-Procurement-of-AI) · [Ropes & Gray](https://www.ropesgray.com/en/insights/alerts/2025/04/white-house-issues-guidance-on-use-and-procurement-of-artificial-intelligence-technology) · [Perkins Coie](https://perkinscoie.com/insights/update/white-house-unveils-updated-ai-guidelines-federal-agencies)
- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) · [NIST AI 600-1 GenAI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) · [NIST CAISI](https://www.nist.gov/caisi) · [Commerce/CAISI statement](https://www.commerce.gov/news/press-releases/2025/06/statement-us-secretary-commerce-howard-lutnick-transforming-us-ai) · [NIST AI Consortium](https://www.nist.gov/news-events/news/2026/05/nist-expands-ai-consortiums-scope-calls-new-members)
- [DoDD 3000.09](https://www.esd.whs.mil/portals/54/documents/dd/issuances/dodd/300009p.pdf) · [DoD RAI Strategy & Implementation Pathway](https://media.defense.gov/2024/Oct/26/2003571790/-1/-1/0/2024-06-RAI-STRATEGY-IMPLEMENTATION-PATHWAY.PDF) · [Arms Control Today, FY27 NDAA AI provisions](https://www.armscontrol.org/act/2026-07/news/us-senate-panel-approves-ai-autonomous-weapons-rules) · [InsideDefense, 3000.09 rewrite](https://insidedefense.com/daily-news/trump-orders-pentagon-revise-human-control-rules-ai-weapons)
- [CDAO T&E frameworks](https://cdao.pages.jatic.net/public/guidance/) · [ai.mil T&E](https://www.ai.mil/About/Resources/Pathway-to-AI-Readiness/Testing-and-Evaluation/) · [CDAO A&A briefing](https://na-admin.eventscloud.com/docs/9769/413266) · [DT&E of AIES Guidebook](https://www.cto.mil/wp-content/uploads/2025/02/TE_of_AIES_Guidebook_Final_26Feb25.pdf) · [DTE&A AIES page](https://www.cto.mil/dtea/te_aies/) · [DoDM 5000.101 overview brief](https://www.dote.osd.mil/Portals/97/pub/presentations/2024/DoDM%205000.101%20AI%20and%20Autonomy%20Overview%20Brief_External%20Presentation_20241209.pdf)
- [DoDI 5000.61 VV&A](https://pdf4pro.com/file/8a5d5/Portals_54_Documents_DD_issuances_dodi_500061p.pdf.pdf) · [DoDM 5000.102](https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodm/5000102m.PDF) · [DOT&E M&S for T&E Guidance 3.0](https://www.dote.osd.mil/Portals/97/docs/TEMPGuide/MandS_for_TandE_Guidance_3.0.pdf) · [AFI 16-1001](https://static.e-publishing.af.mil/production/1/saf_sa/publication/afi16-1001/afi16-1001.pdf) · [Balci & Ormsby, *Well-Defined Intended Uses*](https://informs-sim.org/wsc00papers/111.PDF)

**Classification and deployment**
- [DISA Cloud Service Provider SRG](https://cyber.trackr.live/stig/Cloud_Computing_Mission_Owner_Network_Security_Requirements_Guide/1/2/companion.pdf?file=U_Cloud_Service_Provider_V1R2_SRG.pdf) · [GSA Cloud Information Center](https://cic.gsa.gov/basics/cloud-security) · [Second Front IL guide](https://www.secondfront.com/resources/blog/understanding-dod-cloud-computing-impact-levels/) · [Google DISA compliance](https://cloud.google.com/security/compliance/disa)
- [ICD 503 (ODNI)](https://www.odni.gov/files/documents/ICD/ICD-503.pdf) · [DoD Cybersecurity Reciprocity Playbook](https://dodcio.defense.gov/Portals/0/Documents/Library/(U)%202024-01-02%20DoD%20Cybersecurity%20Reciprocity%20Playbook.pdf) · [Microsoft ICD 503 offering](https://learn.microsoft.com/en-us/azure/compliance/offerings/offering-icd-503)
- [FedRAMP 20x](https://www.fedramp.gov/20x/) · [Consolidated Rules for 2026](https://www.fedramp.gov/2026-06-25-propelling-change-fedramp-launches-consolidated-rules-for-2026/) · [RFC-0020 outcome](https://www.fedramp.gov/notices/0004/) · [RFC-0023 outcome](https://www.fedramp.gov/notices/0008/) · [FedRAMP changelog](https://www.fedramp.gov/changelog/)
- C2E: [Nextgov](https://www.nextgov.com/modernization/2020/11/exclusive-cia-awards-secret-multibillion-dollar-cloud-contract/170227/) · [FedScoop](https://fedscoop.com/cia-quietly-awards-billion-dollar-c2e-cloud-contract/) · [Washington Technology](https://www.washingtontechnology.com/2020/11/cia-makes-awards-for-intelligence-communitys-next-massive-cloud-contract/355018/)
- Models on the high side: [Azure Gov, 26 products at TS/ICD 503](https://devblogs.microsoft.com/azuregov/unlocking-new-possibilities/) · [Azure OpenAI at all classification levels](https://devblogs.microsoft.com/azuregov/azure-openai-authorization/) · [GPT-5.2 in Secret/TS clouds](https://devblogs.microsoft.com/azuregov/advancing-ai-capabilities-in-azure-for-u-s-government-secret-and-top-secret-clouds/) · [Bedrock in AWS Top Secret cloud](https://aws.amazon.com/blogs/publicsector/amazon-bedrock-launches-with-claude-3-5-sonnet-in-the-aws-top-secret-cloud/) · [Bedrock FedRAMP/IL status (28 Jul 2026)](https://aws.amazon.com/compliance/services-in-scope/FedRAMP/amazon-bedrock-models/) · [Bedrock FedRAMP High/IL4-5](https://aws.amazon.com/about-aws/whats-new/2025/05/amazon-bedrock-models-fedramp-high-dod-il-4-5-govcloud/) · [GDC IL6](https://cloud.google.com/blog/topics/public-sector/google-distributed-cloud-gdc-gdc-air-gapped-appliance-achieve-dod-impact-level-6-il6-authorization) · [Gemini on GDC GA](https://cloud.google.com/blog/topics/hybrid-cloud/gemini-is-now-available-anywhere) · [Google IL6 service scope](https://docs.cloud.google.com/docs/security/compliance/il6-gdc-compliance-scope)
- GenAI.mil: [DefenseScoop launch](https://defensescoop.com/2025/12/09/genai-mil-platform-dod-commercial-ai-models-agentic-tools-google-gemini/) · [DefenseScoop user reaction](https://defensescoop.com/2025/12/18/genai-mil-users-have-mixed-reactions-and-many-questions/) · [Lawfare on the Hegseth memo](https://www.lawfaremedia.org/article/hegseth-memo-instructs-defense-dept.-to-use-military-ai-platform) · [Breaking Defense, eight firms on classified networks](https://breakingdefense.com/2026/05/pentagon-clears-7-tech-firms-to-deploy-their-ai-on-its-classified-networks/)
- Cross-domain: [NSA NCDSMO](https://www.nsa.gov/Cybersecurity/Partnership/National-Cross-Domain-Strategy-Management-Office/) · [Owl, RTB and one-way transfer](https://owlcyberdefense.com/blog/a-brief-note-on-raise-the-bar-and-one-way-transfer/) · [Owl, CDS A&A](https://owlcyberdefense.com/blog/cross-domain-solution-assessment-authorization-part-1/) · [DA Pam 25-2-1](https://armypubs.army.mil/epubs/DR_pubs/DR_a/ARN36794-PAM_25-2-1-002-WEB-4.pdf)
- Vendor risk: [Anthropic Claude Gov](https://www.anthropic.com/news/claude-gov-models-for-u-s-national-security-customers) · [Anthropic CDAO $200M OTA](https://www.anthropic.com/news/anthropic-and-the-department-of-defense-to-advance-responsible-ai-in-defense-operations) · [Reuters, 27 Feb 2026](https://www.reuters.com/world/us/trump-says-he-is-directing-federal-agencies-cease-use-anthropic-technology-2026-02-27/) · [GSA removal](https://www.gsa.gov/about-gsa/newsroom/news-releases/gsa-stands-with-president-trump-on-national-security-ai-directive-02272026) · [GSA restoration](https://www.gsa.gov/about-gsa/newsroom/news-releases/gsa-issues-statement-on-anthropic-preliminary-injunction-04032026) · [Reuters, suit filed](https://www.reuters.com/world/anthropic-sues-block-pentagon-blacklisting-over-ai-use-restrictions-2026-03-09/) · [AP, PI granted](https://apnews.com/article/pentagon-ai-anthropic-claude-judge-637d07aca9e480294380be0da1d0a514) · [PI order (CourtListener)](https://storage.courtlistener.com/recap/gov.uscourts.cand.465515/gov.uscourts.cand.465515.134.0_1.pdf) · [Lawfare hearing diary, 30 Jul 2026](https://www.lawfaremedia.org/article/anthropic-v.-u.s.-department-of-war--a-hearing-diary) · [FedScoop](https://fedscoop.com/anthropic-federal-government-federal-court/) · [MeriTalk](https://www.meritalk.com/articles/judge-questions-pentagon-evidence-behind-anthropic-supply-chain-risk-designation/) · [Mayer Brown, FASCSA/§3252 mechanics](https://www.mayerbrown.com/en/insights/publications/2026/07/dows-anthropic-ban-goes-live-a-confusing-patchwork-of-certification-demands-for-contractors)

**Data rights and business terms**
- [DFARS 252.227-7013](https://www.acquisition.gov/dfars/252.227-7013-rights-technical-data%E2%80%94other-commercial-products-and-commercial-services.) · [48 CFR 227.7104-1](https://www.law.cornell.edu/cfr/text/48/227.7104-1) · [48 CFR 227.7104-2](https://www.law.cornell.edu/cfr/text/48/227.7104-2)
- [SBIR.gov data rights tutorials](https://www.sbir.gov/tutorials/data-rights/tutorial-2) · [Phase III value](https://www.sbir.gov/tutorials/data-rights/tutorial-4) · [SBIR/STTR Policy Directive, 84 FR 12794](https://thefederalregister.org/documents/2019-06129/small-business-innovation-research-program-and-small-business-technology-transfer-program-policy-directive)
- [FAR Subpart 9.5](https://www.acquisition.gov/far/subpart-9.5) · [Proposed OCI rule, 90 FR 4376](https://www.govinfo.gov/content/pkg/FR-2025-01-15/pdf/2024-31561.pdf) · [Pub. L. 117-324](https://www.congress.gov/117/plaws/publ324/PLAW-117publ324.pdf) · [Steptoe](https://www.steptoe.com/en/news-publications/far-council-issues-proposed-oci-far-rule.html) · [Wiley](https://www.wiley.law/alert-FAR-Council-Proposes-Wholesale-Revamp-of-Organizational-Conflict-of-Interest-Rules) · [Haynes Boone](https://www.haynesboone.com/news/alerts/preventing-the-fox-from-guarding-the-henhouse) · [PilieroMazza](https://www.pilieromazza.com/proposed-rule-on-organizational-conflicts-of-interest-signals-significant-changes-for-contractors/)

**Evaluation**
- [IARPA REASON](https://www.iarpa.gov/research-programs/reason) · [REASON BAA](https://arl.devcom.army.mil/wp-content/uploads/sites/3/2023/04/W911NF-23-S-0007-REASON-BAA-Final-17-March-2023.pdf) · [IARPA ACE](https://www.iarpa.gov/research-programs/ace) · [GJP data release](https://www.iarpa.gov/newsroom/article/iarpa-announces-publication-of-data-from-the-good-judgment-project)
- [Friedman, Baker, Mellers, Tetlock & Zeckhauser, *The Value of Precision in Geopolitical Forecasting*](https://conference.nber.org/confer/2015/SI2015/PENS/Friedman_Baker_Mellers_Tetlock_Zeckhauser.pdf) · [Mellers et al., *Psychological Strategies*](https://faculty.wharton.upenn.edu/wp-content/uploads/2015/07/2014---psychological-strategies-for-winning-a-tournament.pdf) · [Chang et al., *Developing expert political judgment*](https://goodjudgment.com/wp-content/uploads/2018/12/jdm16511.pdf) · [Good Judgment, ACE results](https://goodjudgment.com/resources/the-superforecasters-track-record/the-first-championship-season/)
- IC AI in practice: [PBS NewsHour on IC generative AI](https://www.pbs.org/newshour/world/u-s-intelligence-agencies-embrace-of-generative-ai-is-at-once-wary-and-urgent) · [AP, CIA CTO Q&A](https://apnews.com/article/cia-chief-technologist-gen-ai-c3f4154a8e2879d7820931f07656968c) · [NGA GEOINT AI](https://www.nga.mil/news/GEOINT_Artificial_Intelligence_.html) · [SpaceNews, NGA AI adoption May 2026](https://spacenews.com/nga-pushes-ai-adoption-as-demand-grows-for-always-on-intelligence/) · [Breaking Defense, NGA AI blueprint](https://breakingdefense.com/2026/05/ai-blueprint-coming-soon-to-nga-to-help-operationalize-geoint/) · [DoD IG, NGA Maven integration evaluation (DODIG-2026-055)](https://www.dodig.mil/reports.html/Article/4403433/joint-evaluation-of-the-national-geospatial-intelligence-agencys-integration-of/)