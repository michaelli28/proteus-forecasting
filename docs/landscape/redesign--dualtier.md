# Dual-Tier Deployment and Accreditation Design

## 🧑 In Plain English

The prototype runs today on ordinary internet infrastructure with public information. The customer's real work happens on secret networks that never touch the internet. This section says, component by component, what each piece of the system would be replaced by on the secret side, what paperwork stands in the way, and what capability gets worse in the move. It does not build any of that — it specifies it.

The core argument is small and, as far as we can find, new. Because every run of this system is reproducible down to the byte from a seed and a config file, a cleared government test team can re-run our work on classified data *without us in the room* and prove that any difference in the answer came from the classified data and not from our code. That turns a normally expensive, argumentative handoff into a hash comparison. The second argument is that the system's own type definitions already make certain abuses impossible — there is no place in the code to put a real person's name — and a short executable test proving that is worth more to a security reviewer than any maturity rating we could claim.

---

## 1. The Component Substitution Table

Two tiers, named throughout: **Low** (the current unclassified prototype: public corpora, commercial API inference, local artifact store) and **High** (Secret / TS-SCI, accredited under [ICD 503](https://www.dni.gov/files/documents/ICD/ICD_503.pdf) for IC systems or the DoD Cloud Computing SRG at IL5/IL6 for defense networks).

The instruction is that **Low stays on its current path**. Nothing below proposes changing the prototype. Every row states the substitute, the obstacle, and the honest loss.

### 1.0 The numeric kernel — the row that translates for free

| | |
|---|---|
| **Low today** | `src/sim/kernel.ts` + two domain adapters. sfc32 PRNG (`src/sim/rng.ts`), named seed forks, no wall clock. `Math.random` and `Date.now` are banned in `sim/` and a test scans the source to enforce it (`tests/sim/determinism-guards.test.ts`). |
| **High substitute** | **Identical binary.** No substitution required. |
| **Obstacle** | Software supply-chain review of the Node runtime and the dependency tree; STIG-hardened host; an accredited one-way transfer of the build artifact. Ordinary, not novel. |
| **What is lost** | Nothing. This is the point of a deterministic numeric kernel with no network dependency: it is the only component whose behaviour is provably unchanged by the move. |

Everything downstream of this row is where the cost lives.

### 1.1 LLM inference

| | |
|---|---|
| **Low today** | Commercial API. Interface at `src/llm/client.ts`, Anthropic implementation at `src/llm/anthropic.ts`, deterministic stub at `src/llm/stub.ts`. Used by the framer, the adjudication panel and the red team — **never by the kernel**. Measured: $0.2959 per live question (9 calls) / $0.7544 (17 calls, red-team rerun). |
| **High substitute — three real options, all verified** | **(a) Accredited commercial in a classified region.** Amazon Bedrock reached GA in the AWS Top Secret cloud in January 2025 with Claude 3.5 Sonnet and Titan Text Embeddings v2 ([AWS](https://aws.amazon.com/blogs/publicsector/amazon-bedrock-launches-with-claude-3-5-sonnet-in-the-aws-top-secret-cloud/)); Bedrock launched in AWS Secret-East in November 2025 with Claude Gov Sonnet 4.5, Amazon Nova Lite and Titan Text Embeddings v2 ([AWS](https://aws.amazon.com/about-aws/whats-new/2025/11/amazon-bedrock-is-now-available/)); AWS Secret-West went live 22 October 2025 ([AWS](https://aws.amazon.com/blogs/publicsector/amazon-to-launch-second-secret-cloud-region-in-2025/)). Azure OpenAI is authorized across every US Government classification level — Top Secret under ICD 503, IL6 in Azure Government Secret ([Microsoft](https://devblogs.microsoft.com/azuregov/azure-openai-authorization/)) — and GPT-5.2 became available in the Azure Secret and Top Secret clouds on 15 January 2026 ([Microsoft](https://devblogs.microsoft.com/azuregov/advancing-ai-capabilities-in-azure-for-u-s-government-secret-and-top-secret-clouds/)). Google Distributed Cloud air-gapped is authorized for US Government Secret and Top Secret and holds a DISA IL6 provisional authorization, with Gemini Pro and Gemini Flash in the IL6 scope ([Google](https://cloud.google.com/blog/topics/hybrid-cloud/gemini-is-now-available-anywhere), [scope list](https://docs.cloud.google.com/docs/security/compliance/il6-gdc-compliance-scope)). Oracle's OCI Generative AI service is GA in Oracle's Top Secret classified regions ([Oracle](https://blogs.oracle.com/cloud-infrastructure/oci-gen-ai-service-in-us-classified-cloud)). **(b) Open-weight, self-hosted, air-gapped.** vLLM or TensorRT-LLM serving Llama, Mixtral, Qwen, Gemma or Phi inside the enclave; weights imported by accredited one-way transfer, SHA-256 verified and registered ([reference design](https://precisionfederal.com/insights/on-prem-llm-deployment-air-gapped), [capability description](https://precisionfederal.com/capabilities/classified-ai)). **(c) Government-hosted.** CamoGPT is fielded on SIPR/IL6 ([USMC MARADMIN 496/24](https://www.marines.mil/News/Messages/Messages-Display/Article/3941033/communicating-the-availability-of-authorized-nipr-and-sipr-llm-capabilities/)); DISA has stood up a SIPR LLM for INDOPACOM ([DefenseScoop](https://defensescoop.com/2025/03/25/disa-siprgpt-chatbot-indopacom-joint-operational-edge-cloud/)). In May 2026 the Department of War announced agreements with eight leading AI companies to deploy on its classified networks ([White House fact sheet](https://www.whitehouse.gov/fact-sheets/2026/06/fact-sheet-president-donald-j-trump-signs-historic-directive-on-ai-in-the-national-security-enterprise/)). |
| **Obstacle** | ICD 503 / IL6 authorization of the *inference service* is already done by the providers above — the obstacle is the **application** ATO on top of it, plus model-update cadence. In a disconnected enclave the update pipeline is quarterly, not weekly: low-side pull → hash → malware scan → provenance verify → cross-domain transfer → high-side hash re-verify → regression eval → canary → promote. The Army's June 2026 RFI for agentic AI on JWICS asks, for each network, "current ATO status … the authorizing official, sponsoring organization, and boundary covered," and demands country of origin, developer and ownership status for every foundation model ([SAM.gov](https://sam.gov/workspace/contract/opp/5bf4cceb9aff4a2eafc01ee909d718e4/view)). Expect exactly those questions. |
| **What is lost — three things, stated plainly** | **(i) Model-version reproducibility breaks.** The kernel is byte-identical across tiers; the LLM layer is not. A high-side model is generally a generation behind and is swapped on the enclave's cadence, not ours. Every framing, every panel judgment, every red-team challenge is therefore *not* reproducible across the tier boundary. This is the single largest honest cost of the move and Section 2 is the mitigation, not a denial. **(ii) Refusal behaviour changes, and one of our measured numbers does not transfer.** We measured an adjudicator refusal rate of 5/5 on the influence-ops task, later 2 of 3 declined. Anthropic states Claude Gov models offer "improved handling of classified materials with reduced refusals" ([Anthropic](https://www.anthropic.com/news/claude-gov-models-for-u-s-national-security-customers)). Our refusal figure is a property of a specific commercial model under a specific policy and **must be re-measured on the high side**; quoting it as a platform property would be false. **(iii) Cost and latency figures do not transfer.** $0.2959/question and 5m54s are commercial-API measurements. Reserved-capacity and self-hosted economics are entirely different, and we have no high-side measurement. Label them Low-tier only. |
| **Vendor-dependency risk, which is now policy, not prudence** | NSPM-11 §2(c) requires assurance "through contractual clauses or other means, that no commercial entity or adversary possesses the capability to prevent use of, disable or degrade, or materially modify without Federal Government knowledge and approval, an AI system" ([White House](https://www.whitehouse.gov/presidential-actions/2026/06/national-security-presidential-memorandum-nspm-11/)); §3(b) authorizes termination "for default or for convenience" of contracts with companies showing a repeated pattern of conduct inconsistent with the memorandum; the accompanying fact sheet criticises "dangerous single-vendor dependencies." Reporting indicates Anthropic's federal contracts were cancelled in February 2026 on supply-chain-risk grounds and are the subject of two lawsuits ([Breaking Defense](https://breakingdefense.com/2026/06/trump-memo-on-ai-aims-to-avoid-repeat-of-anthropic-debacle/)) — outcome **UNVERIFIED**. **Design consequence:** the LLM must remain behind `src/llm/client.ts` with at least two accredited backends and the stub, and the bid must never name a single model as a hard dependency. The kernel's zero model dependency is the strongest no-disable posture available and is testable. |

### 1.2 Corpus and retrieval

| | |
|---|---|
| **Low today** | As-of corpus retrieval with a hard date filter (`src/corpus/as-of.ts`), a pinned snapshot id carried in the run identity (`src/corpus/snapshot.ts`), and a runtime assertion that throws `LeakageError` if any evidence reference in a finished product post-dates the run's as-of date (`src/corpus/as-of.ts:151`). |
| **High substitute** | An as-of view over an accredited IC repository, with the date filter re-implemented against the repository's own publication metadata, plus a **classification-aware access-control layer** the Low tier does not have: per-document label filtering, user-attribute filtering inside the retriever, output defaulting to the highest input classification, and portion marking on every response. |
| **Obstacle** | Three compounding ones. **(a) Date semantics.** IC source dates are not one field. ICD 206 distinguishes date of issuance/publication/posting from date of online access, and requires source descriptors to flag "age and continued currency of information" and cases where "the time of pertinent information in a source is significantly different from the time of publication" ([ICD 206](https://www.dni.gov/files/documents/ICD/ICD-206.pdf)). A single `asOf` comparison against one timestamp is a Low-tier simplification. **(b) Spillage.** A retrieval index that spans classification levels is a spillage surface; cross-level flows require an accredited cross-domain solution, never a hand-rolled guard. **(c) Retention.** ICD 206 requires a record of dynamic or ephemeral sources be preserved for at least one year, and for a product with a specified time horizon, for that horizon or five years, whichever is shorter. |
| **What is lost** | The leakage guard **weakens from a proof to a heuristic**. On the Low tier the guard is airtight because the corpus is a frozen snapshot we own: `assertNoLeakage` can compare against a single authoritative date. On the High tier the guard can only be as good as the repository's date metadata, which we do not control and which ICD 206 itself treats as multi-valued. This must be declared as a limitation in the ATO package, not papered over. **What is gained** is the compliance credit: the pinned snapshot already satisfies ICD 206's retention requirement, and it should be presented as compliance rather than as an engineering nicety. |

### 1.3 Artifact store

| | |
|---|---|
| **Low today** | `src/artifact/store.ts`. `RunIdentity = { config, corpusSnapshotId, kernelVersion }`; `runId = computeRunId(identity)`; canonicalized events; a `manifest.json` mapping every relative path to the sha256 of its bytes. Same seed ⇒ byte-identical artifact hash — verified by unit test and by CLI. |
| **High substitute** | **Identical format on enclave storage.** Same canonicalization, same hashing, same manifest. |
| **Obstacle** | Storage-side classification marking and audit logging to the enclave SIEM. Neither changes the format. |
| **What is lost** | **Nothing, and this is the load-bearing observation for Section 2.** The manifest is precisely the object a cross-domain transfer review wants: a signed list of every file with its hash and its provenance. The artifact store is the one component that is *more* useful on the high side than the low side. |

### 1.4 Dashboard

| | |
|---|---|
| **Low today** | Local web view over the artifact store. |
| **High substitute** | Either (a) a **static rendered artifact** — the run's product and metrics emitted as a signed, self-contained file with no runtime, viewed in the enclave's existing document tooling — or (b) an enclave-resident application inheriting the hosting boundary's controls. |
| **Obstacle** | A browser application inside a SCIF is a full ATO item: no CDN, no external fonts, no telemetry, no auto-update, STIG-hardened serving. Option (a) sidesteps almost all of it. |
| **What is lost** | Interactivity. Filtering, drill-down and live re-scoring become offline operations. **Design consequence:** treat the dashboard as a *rendering of an artifact*, never as a system of record, so that the High tier can drop the interactive shell without losing any information. That constraint should be adopted on the Low tier now, at zero cost, because it makes the substitution free later. |

### 1.5 Telemetry

| | |
|---|---|
| **Low today** | Local logs; cost and latency measured per run. |
| **High substitute** | Enclave-local audit logging to the accredited SIEM. **No outbound telemetry of any kind.** |
| **Obstacle** | Absolute. A classified enclave permits no callback, no crash reporting, no usage analytics, no license check. |
| **What is lost** | Fleet-level learning. On the Low tier we can aggregate calibration and cost across every run everywhere. On the High tier every enclave is an island: calibration data accumulates locally and can only be exported as a deliberate, reviewed, unclassified summary. **This is exactly the constraint the REASON pattern was built for**, and Section 2 turns it from a loss into the contracting model. |

### 1.6 Metrics package

| | |
|---|---|
| **Low today** | `src/metrics/` — Brier, Brier skill vs explicit baselines, Murphy decomposition, ECE/MCE with bin occupancy, sharpness, log score, coverage@N, diversity, tail recall, inter-run stability, Krippendorff alpha, contradiction P/R, provenance completeness, cost per insight. Every report **requires** an `EvaluationRegime` tag (`synthetic_oracle | historical_backtest | live_post_cutoff`) and no function pools them. |
| **High substitute** | **Identical.** These are pure functions over run outputs. |
| **Obstacle** | None technical. One policy obstacle: the *inputs* become classified, so the metric outputs inherit a classification even though the code does not. |
| **What is lost** | Nothing computationally. What changes is **what can come back across the boundary** — and this is where the mandatory regime tag earns its keep. A per-band probability vector, a Brier decomposition, an abstention count and a run id form a compact, releasable summary. The regime tag makes that summary interpretable without any classified context, which is the only reason unclassified feedback from a classified test is worth anything. |

### 1.7 The commit-then-resolve register

| | |
|---|---|
| **Low today** | Forecasts committed before the resolving event; scored on resolution. |
| **High substitute** | **Stays on the Low tier.** No substitution. |
| **Why** | The landscape sweep's strongest structural criterion is that a capability's resolution source should be a third party's published artifact on a known schedule — CISA advisories, MOFCOM announcements, Taiwan MND daily counts, EU sanctions adoptions, KEV additions, monthly leak-site counts, survey waves, election dates. **Every one of those is unclassified.** A forecast made on the high side about a quantity that resolves in a public artifact can have its *commitment hash* published low-side at commitment time, and its *resolution* scored low-side entirely in the open. |
| **What is lost** | Only the questions whose resolution is itself classified — and those were never scorable against a public track record anyway. |
| **What is gained** | **The track record accrues on the unclassified side even when the analysis is classified.** This is the single most commercially valuable structural property in the whole design: it is the only mechanism by which a company with no classified access can build a defensible, auditable calibration record on questions the customer actually cares about. It should be a named line in the bid. |

### 1.8 The panel registry

| | |
|---|---|
| **Low today** | **Does not exist as a persisted object.** `PanelPlan` carries an LLM-generated `systemPrompt` per adjudicator (`src/agents/panel.ts:36`); it is never persisted and never hashed. `RunIdentity` has no panel field (`src/artifact/store.ts:27–35`). Two runs judged by different generated rubrics share a run id. |
| **High substitute** | A **versioned, hashed panel registry**: each adjudicator is a named, content-addressed rubric with a stable id; `RunIdentity` gains a `panelRegistryId`; the registry ships as part of the config pack. |
| **Obstacle** | This is not an accreditation obstacle. It is an architecture gap confirmed in the code this session, and it **blocks the entire Section 2 argument**. If the rubric that judged a run is not in the run identity, a cleared T&E team cannot re-derive the run, and every difference between their result and ours is unattributable. |
| **What is lost if not fixed** | The whole dual-tier value proposition. Determinism that excludes the judge is not determinism. **This is the highest-priority pre-bid engineering item in this document.** The related gap — k-of-N panel loss recorded as `available: results.length > 0` and mapped to `level: adjudicationAvailable ? "high" : "moderate"`, so that one surviving adjudicator of eight scores identically to a full panel — must be fixed alongside it, because partial panel loss is the *normal* operating condition on a bandwidth-constrained enclave, not an edge case. |

---

## 2. The REASON Pattern as the Contracting Answer

### 2.1 The pattern, in the government's own words

IARPA's [REASON](https://www.iarpa.gov/research-programs/reason) program solved the classification barrier for exactly this class of system. From the [BAA (W911NF-23-S-0007)](https://arl.devcom.army.mil/wp-content/uploads/sites/3/2023/04/W911NF-23-S-0007-REASON-BAA-Final-17-March-2023.pdf):

> "All Performer work will be unclassified. Performer systems will be tested by cleared T&E personnel on classified data but Performers will not be able to review that classified data. T&E will provide Performers with unclassified summary results from classified testing. … Even if a Performer has cleared personnel, they will not receive additional classified feedback."

> "In Phase 1 performer systems will be tested comprehensively on unclassified data … In parallel, the REASON independent T&E team will retrain and evaluate performer systems on classified draft analytic reports and source reports. In Phase 2 performer systems will be tested on classified data …"

> "For classified testing, the T&E Team will retrain Performer systems to classified data as necessary, using scripts or processes provided by the Performers."

> "The API will be functionally identical for unclassified and classified testing."

Structure: 42 months, two phases, Phase 1 1 October 2023 – 30 September 2025, Phase 2 1 October 2025 – 31 March 2027, no gap between them. Data rights floor, quoted exactly:

> "Because the goal of the REASON Program is to increase the quality of reports produced on classified systems, deliverables produced by proposers must offer a minimum of Government Purpose Rights that grant the Government intellectual property (IP) rights sufficient to allow the Government to modify and deploy deliverables on classified networks."

### 2.2 Why the pattern is expensive today — and this is the part nobody says out loud

The clause that carries all the cost is **"the T&E Team will retrain Performer systems to classified data as necessary, using scripts or processes provided by the Performers."**

For a learned system, that sentence is a research project performed by people who did not build the thing. The T&E team runs the performer's retraining scripts on classified data, gets a number, and hands back an unclassified summary. If the number is worse than the unclassified baseline, **nobody in the world can say why.** Candidate causes: the classified corpus is genuinely harder; the retraining did not converge; a hyperparameter defaulted differently on the classified testbed; the T&E environment has a different library version; the performer's script had a latent bug that only fires on IC-formatted documents with classification markings and jargon. The performer cannot inspect the run. The T&E team cannot explain the model. Every disagreement becomes a meeting, a memo, and a schedule slip — and the performer's only lever is to guess and resubmit.

That is the real cost of the classification barrier. It is not the clearances. It is the **unattributability of the difference.**

### 2.3 Why deterministic, seeded, byte-identical artifacts make it cheaper than it has ever been

The claim, stated precisely: **a cleared T&E team can re-derive a performer's run exactly, without the performer, and attribute any difference to a named config line.**

It works in three moves.

**Move 1 — Prove the transfer was faithful before any classified data is touched.**
The performer ships a config pack, a seed list, and a manifest of expected artifact hashes for a reference run. The T&E team runs it on the *unclassified* testbed inside their own environment and compares hashes. Byte equality proves that the code, the runtime, the dependency tree, the seed handling and the config parsing are all identical to the performer's. This is a **build-integrity check that has no analogue in a stochastic system** — today's REASON T&E team has no way to distinguish "your system behaves differently here" from "your system was installed wrong here," and must resolve it by correspondence. With hash equality it is resolved in seconds, mechanically, before a single classified document is opened. This alone removes the most common and most expensive category of dispute.

**Move 2 — Change exactly one field, and make the run id prove it.**
`RunIdentity` is `{ config, corpusSnapshotId, kernelVersion }` and `runId = computeRunId(identity)`. To run high-side, T&E substitutes **one field**: `corpusSnapshotId` points at the classified snapshot instead of the public one. `config` is unchanged. `kernelVersion` is unchanged. Because the run id is a hash of the identity, the two run ids differ, and the diff of the two identity objects is a single line. **The difference in result is therefore attributable to the corpus by construction** — not to code drift, not to seed drift, not to environment drift, and (once §1.8 is fixed) not to a differently-generated judging rubric.

This is what "attribute any difference to a named config line" means operationally: it is not a claim about good documentation. It is a property of a content-addressed identity over a deterministic function.

**Move 3 — Make the unclassified feedback small enough to release and rich enough to act on.**
Because the kernel is deterministic and the metrics package is a pure function of run outputs carrying a mandatory `EvaluationRegime` tag, the releasable summary can be a fixed-schema object: the two run ids, the one-line identity diff, per-band probability vectors, Brier and its Murphy decomposition against the stated baseline, ECE with bin occupancy, the abstention counts split into true and false, coverage@N, and the panel-loss grade. Every field is a number or an id. None of it needs classified context to be interpretable, precisely because the regime tag says which world produced it and no function pools regimes. The performer can act on that summary in a working day.

**And there is no retraining step at all.** The single most expensive clause in REASON's T&E design — retraining the performer's system on classified data — has no counterpart here, because PROTEUS adapts by **config, not by weights**. This matters more than it sounds: open-weight models are unclassified on import, but a fine-tune on classified data becomes classified at the derivation level and must be registered, marked, stored, and eventually destroyed under the enclave's rules ([classified-AI delivery practice](https://precisionfederal.com/capabilities/classified-ai)). A system that never fine-tunes generates no classified derived model artifact, requires no retraining accreditation, and imposes no model-destruction obligation. That is a direct, quantifiable reduction in the T&E team's workload and in the enclave's storage-and-marking burden. It should be stated as a differentiator in the bid, because most performers cannot say it.

### 2.4 What the performer ships, and what comes back

**Outbound to the cleared T&E team (all unclassified, one signed bundle):**

| Item | Content | Why T&E needs it |
|---|---|---|
| **Config pack** | Every domain-adapter config, versioned and content-addressed. Zero free text (see §3). | The thing being tested. Also the thing that gets one field swapped. |
| **Seed list** | Root seeds per ensemble member; the named fork scheme is in the kernel. | Reproduction. Without it, byte equality is meaningless. |
| **Panel registry** | Named, hashed adjudicator rubrics with stable ids. **Does not exist today — §1.8.** | Without it, half the pipeline is unreproducible and Move 2 fails. |
| **Artifact manifest** | Expected `runId` and per-file sha256 for the unclassified reference run. | Move 1: the build-integrity proof. |
| **Corpus snapshot descriptor** | Snapshot id, as-of date, document count, and the retrieval contract — *not* the documents. | Lets T&E construct a classified snapshot with the same shape and the same as-of semantics. |
| **Container image + SBOM + hashes** | Pinned runtime, pinned dependencies, offline-capable. | The accredited transfer package. Standard air-gap practice. |
| **Threshold card** | The shipped abstention threshold and the sweep that produced it (7% false abstention across 6 arms). | Lets T&E reproduce the operating point rather than infer it. |
| **Baseline declarations** | The explicit baselines skill is measured against — persistence, base rate, and where applicable INFER/Metaculus/ViEWS. | Brier skill is meaningless without a named baseline, and this is the field an auditor checks first. |
| **Red-line test suite** | The executable artifact specified in §3. | The security and privacy reviewer's instrument. |

**Inbound from T&E (unclassified summary, fixed schema):**

| Item | Why it is releasable |
|---|---|
| Both run ids and the one-line identity diff | Hashes and a field name. No content. |
| Per-band probability vectors and realised band | Numbers over a partition T&E and the performer both already hold. |
| Brier, Brier skill vs the named baseline, Murphy decomposition | Aggregate scores; no source reveals. |
| ECE/MCE with bin occupancy, sharpness, log score | Calibration shape, not calibration content. |
| Abstention counts, split true / false | The single most actionable number for threshold tuning. |
| Coverage@N, tail recall, inter-run stability, Krippendorff alpha | Ensemble behaviour, fully aggregate. |
| Panel-loss grade (k-of-N, once §1.8 lands) | Tells the performer whether a bad score was a bad judgment or a thin panel. |
| Contradiction P/R and provenance completeness | Claims about the *source base*, not about the world — the class the landscape sweep identified as the one that actually fields. |
| `EvaluationRegime` tag | Mandatory. Without it the whole summary is uninterpretable. |
| Free-text findings, ≤ 1 page, cleared for release | The narrow channel where human judgment gets through. |

**Explicitly not requested inbound:** any document, any excerpt, any source identifier, any classified metric threshold. The design goal is that the performer never needs to ask, so the release review is trivial and fast — because a slow release review is what actually kills the feedback loop in practice.

---

## 3. The Red-Line Type System as an Accreditation Artifact

### 3.1 The claim, and the code that supports it — all verified this session

**The influence-ops kernel has no text in it, anywhere.** `src/sim/adapters/influence-ops/config.ts:4–8`:

> "SCOPE BOUNDARY, enforced structurally: narratives are opaque identifiers with numeric positions. There is no text field anywhere in this model, so no code path can emit persuasive content — there is no content in it to emit. The population is synthetic; nothing here touches a real platform or person."

**The recruitment kernel has no natural-person field.** `src/sim/adapters/recruitment/workforce.ts:10–13`:

> "Every attribute is an opaque number. There are no names, titles, employers or profile fields — see config.ts for why that is structural rather than a stylistic choice."

`Person` is, in full: `{ id: number, organization: number, cleared: boolean, access: number, exposure: number, vulnerability: number }`.

**Verification run this session:** `grep -nE "string" src/sim/adapters/influence-ops/config.ts src/sim/adapters/recruitment/config.ts` returns **no matches** (exit 1). There is not a single string-typed field in either domain configuration. The only string-like values in the adapters are closed literal unions used as tags (`DEFENSE_KINDS`, `FUNNEL_STAGES`), which are enumerations, not content. **CONFIRMED.**

### 3.2 The artifact: a schema diff plus a failing test

Not a memo. An executable the reviewer runs.

**Part A — the schema diff.** A two-column document: for each red line, the type as it would look in a system that permits the abuse, and the type as it actually is. `Person { name: string, employer: string, linkedInUrl: string, … }` beside `Person { id: number, organization: number, cleared: boolean, access: number, exposure: number, vulnerability: number }`. `Narrative { text: string, headline: string }` beside `narrativeId: number`. The diff makes the argument visually in ten seconds; the tests make it true.

**Part B — the failing tests.** `tests/redline.test.ts`, four tests, each of which **fails loudly if the red line is ever removed**:

1. **No-text-in-kernel (source-scanning).** Scans every file under `src/sim/` and asserts no string-typed field appears in any exported config or state interface. This is the same enforcement mechanism as the existing `tests/sim/determinism-guards.test.ts`, which scans `sim/` for `Math.random` and `Date.now` — a pattern already proven in this codebase, which matters, because a reviewer trusts a mechanism the project already relies on more than a mechanism invented for the bid.
2. **Config-load rejection.** Feeds a config object carrying a person-identifying field to the adapter's loader and asserts it is rejected. This is real today: `validateConfig` throws `RangeError` on structurally invalid configs (`src/sim/adapters/influence-ops/config.ts:134–165`), and the framer's schemas are Zod, which rejects unknown shapes at parse time.
3. **No-emission.** Runs a full simulation and asserts that no event, observation or state field in the result contains a string longer than a short tag threshold. This closes the loop: even if a text field were somehow smuggled into a config, nothing comes out.
4. **Determinism-under-adversarial-config.** Asserts that a config crafted to look like targeting still produces a byte-identical artifact hash — which is the audit hook: whatever a run did, it can be re-derived and inspected.

### 3.3 Why one such artifact is worth more in a bid than every TRL number combined

Three reasons, in ascending order of force.

**TRL is unverifiable by the person who must act on it.** A Technology Readiness Level is a self-assessment. The reviewer cannot check it and knows it is routinely inflated — and the landscape sweep already established the specific inflation in this market: vendors count the platform, not the domain pack, so a TRL-4 platform and a TRL-2 adapter get reported as one number. A reviewer who has been burned by that discounts every TRL claim including the honest ones. A test, by contrast, is falsifiable in the time it takes to type `npm test`.

**It changes what kind of assurance is on offer.** Security and privacy review of an AI system today consists of reading policy documents and issuing conditions: *the vendor asserts it will not target individuals; condition of approval is annual attestation.* That is a promise about future behaviour by people the reviewer will never meet, and the reviewer knows it. The red-line artifact substitutes a different object: **a config that would model a named individual does not load.** That is not a promise about behaviour. It is a statement about the set of programs that exist. The reviewer can verify it and, more importantly, the reviewer's *successor* can verify it, without trusting either of us.

**No security or privacy reviewer has ever seen this argument.** This is the part worth being deliberate about. The reviewer's entire toolkit for AI systems is documentary — model cards, use-case inventories, risk-and-impact assessments, human-oversight attestations. Every one of them describes a system from outside. Handing that reviewer a test they can run, which fails if the guarantee is ever removed, gives them something they have never had: an **instrument**. Reviewers who are handed instruments become advocates for them, because the instrument makes their job possible rather than merely documented. That is a competitive asset no maturity rating can produce, and it costs perhaps two days of engineering.

It also maps directly onto text already in force. NSPM-11 §6 defines controllability as "the ability to monitor the operation and outcomes of a system and take corrective action" and steerability as "the ability to shape the internal behavior of a system to pursue a given set of objectives." A type system that forecloses a behaviour class is the strongest available evidence of both, and it arrives as an artifact rather than an assertion.

### 3.4 Red lines the type system enforces today

| # | Red line | Mechanism | Status |
|---|---|---|---|
| 1 | The model cannot represent a named natural person | Zero string fields in either adapter config; `Person` is six numbers and a boolean | **CONFIRMED** — grep verified this session |
| 2 | The system cannot emit persuasive content | No text field exists in the influence-ops model; nothing to emit | **CONFIRMED** — `config.ts:4–8`, verified |
| 3 | The system cannot target a real platform or population | Populations are synthetic and generated from seed; no external identifier of any kind | **CONFIRMED** — `workforce.ts`, `network.ts` |
| 4 | Results cannot depend on wall clock or hidden entropy | `Math.random` / `Date.now` banned in `sim/`, enforced by a source-scanning test | **CONFIRMED** — `tests/sim/determinism-guards.test.ts` |
| 5 | A finished product cannot cite evidence post-dating its as-of date | Runtime assertion throwing `LeakageError` | **CONFIRMED** — `src/corpus/as-of.ts:151` |
| 6 | A run's inputs cannot be silently altered | Content-addressed `RunIdentity`; manifest of per-file hashes | **CONFIRMED** — `src/artifact/store.ts` |

### 3.5 Red lines it currently **cannot** enforce — and this list is the credibility of the section

A reviewer who finds an unstated hole discounts everything else in the package. So, plainly:

1. **The framer's free-text fields are unguarded.** `RunSpecSchema.label` and `.rationale` are `z.string().min(1)` (`src/agents/framer.ts:39,44`); `FramingSchema.restatedQuestion` and `.partitionRationale` likewise. A human operator, or the LLM itself, can put a real person's name in any of them. **The red line stops at the kernel boundary.** The claim that survives scrutiny is narrow and must be stated narrowly: *the numeric kernel cannot represent or target an individual and cannot emit persuasive content; the language layer above it is governed by policy, not by types.*
2. **The panel rubrics are unconstrained free text.** `PanelPlanSchema.systemPrompt` is `z.string().min(1)` (`src/agents/panel.ts:36`), LLM-generated, unpersisted and unhashed. Nothing constrains what a generated rubric asks an adjudicator to do. This is simultaneously the reproducibility gap of §1.8 and a red-line hole, and it is the same fix.
3. **Nothing constrains the corpus.** As-of filtering is a *date* filter, not a *content* filter. A classified corpus containing US-person information flows through the retrieval path unmodified.
4. **There is no US-person minimization anywhere in the code.** No recognition, no minimization, no marking. That is an EO 12333 / Attorney General Guidelines obligation the architecture does not touch. Claiming otherwise would be false, and a reviewer will find out.
5. **The product generator emits prose.** Nothing prevents a BLUF or a key-assumption statement from naming an individual who appeared in the evidence base.

**The roadmap item that follows** — and it should be costed in the bid rather than promised — is to push the type boundary outward from the kernel to the language layer: a branded `Screened<string>` type at the framer/panel/product boundary, constructible only through a validator, so that unvalidated text is a compile error rather than a review finding. That converts items 1, 2 and 5 from policy into types. Items 3 and 4 are genuinely out of scope for a vendor and belong to the accrediting organization; say so.

---

## 4. Compliance Mapping

### 4.1 ICD 203 — Analytic Standards

[ICD 203](https://www.bmbs.org/salamanca/readings/ODNI_ICDs_203-206-208.pdf) was established in 2007 and revised, revalidated and approved by the DNI in January 2015 ([ODNI](https://www.dni.gov/index.php/how-we-work/objectivity)). Five Analytic Standards — objective; independent of political consideration; timely; based on all available sources of intelligence information; and implementing the nine Analytic Tradecraft Standards.

| Tradecraft standard | Architecture position | Verdict |
|---|---|---|
| (a) Properly describes quality and credibility of underlying **sources, data, and methodologies** | Provenance per claim; unsupported assertions counted, not blocked. **Parameters are not sourced.** | **FAILS — see §4.2** |
| (b) Properly expresses and explains uncertainties | ICD 203 likelihood and confidence as structurally separate fields; there is no function of type `(Judgment) => number`; confidence aggregated by weakest link, never by mean | **Strong.** Among the strongest positions in the design |
| (c) Properly distinguishes intelligence information from assumptions and judgments | Key assumptions are a first-class object, each with a **required** falsifier; evidence carries provenance | **Strong** |
| (d) Incorporates analysis of alternatives | N mutually-exclusive hypotheses as outcome bands, structurally MECE; ACH with Heuer diagnosticity weighting; devil's advocate and premortem on the panel | **Strong** — this is the architecture's native shape |
| (e) Demonstrates customer relevance and addresses implications | Not in the code. A pack-level obligation | **Gap, owned by the domain pack** |
| (f) Uses clear and logical **argumentation** | A run artifact is a probability vector and a metrics blob. **It is not an argument.** | **FAILS — see §4.3** |
| (g) Explains change to or consistency of judgments | Inter-run stability is measured; change *across* products over time is not modelled | **Partial** |
| (h) Makes accurate judgments and assessments — "apply expertise and logic to make the most accurate judgments and assessments possible, based on the information available and known information gaps" | Brier, Brier skill vs explicit baselines, Murphy decomposition, ECE/MCE. The commit-then-resolve register is the only mechanism that can serve this standard, because no single product can | **Strong on instrumentation; the register is the delivery vehicle** |
| (i) Incorporates effective visual information where appropriate | Pack-level | **Out of scope** |

### 4.2 The first failure: sourcing of model **parameters**, not just evidence items

Standard (a) reads, verbatim: *"Properly describes quality and credibility of underlying sources, data, and methodologies: Analytic products should identify underlying sources and methodologies upon which judgments are based, and use source descriptors in accordance with ICD 206 … to describe factors affecting source quality and credibility."*

The load-bearing word is **methodologies**. No candidate in the landscape sweep treats model parameters as sourced claims — and PROTEUS does not either.

Concretely, from the code: `riskTolerance` and `escalationPropensity` arrive as numbers in `[0,100]` from an LLM (`src/agents/framer.ts:41,43`) accompanied by a free-text `rationale`, with no source, no descriptor and no credibility factor. `DEFAULT_CONFIG` in the influence-ops adapter carries `epsilonMean: 0.25`, `susceptibilityMean: 0.5`, `influenceRate: 0.12`, `media.weight: 0.05`; `REFERENCE_CAMPAIGN` carries `amplification: 3`, `injectionRate: 0.3`, `targetPosition: 0.85`. Every one of these moves the answer, several of them more than any single evidence item does, and **not one carries a citation.**

The nearest thing to a source is a code comment: `REFERENCE_CAMPAIGN` is documented as "Chosen from a measured parameter sweep to sit well short of saturation." That is a methodology *note* — it is honest, it is useful, and it is in a comment rather than in the artifact, which means it does not travel with the product and an auditor will never see it.

An ICD 203 auditor will fail this, and the failure is not cosmetic: an unsourced parameter is an unsupported assertion that the system's own provenance machinery is already designed to count. The architecture has the counter and does not point it at the parameters.

**The fix, specified:** parameters become first-class sourced claims sharing the same provenance shape as evidence — each parameter carrying a source reference, an ICD 206 source descriptor covering accuracy, currency, access and possible bias, and a plausible range rather than a point value. The existing "unsupported assertions counted, not blocked" policy extends to cover them, so a run with unsourced parameters is *scoreable and shippable* but visibly weaker. This is the correct posture: blocking would make the system unusable on genuinely novel questions, and counting is what ICD 203 actually asks for.

There is a second, independent hook for the same fix: the IC's own [AI Ethics Framework](https://www.intelligence.gov/ai/ai-ethics-framework) names it directly — *"Documentation of Purpose, **Parameters**, Limitations, and Design Outcomes."* Two separate IC authorities point at parameters. Neither is satisfied today.

### 4.3 The second failure: an **argument**, not a number

Standard (f) requires clear and logical argumentation. DIA's implementation of ICD 203 goes further, using argument mapping, linking logic and argument evaluation ([Military Review](https://www.armyupress.army.mil/Journals/Military-Review/English-Edition-Archives/March-April-2021/Kwoun-Tradecraft-Standards/)).

A PROTEUS run artifact is a probability vector over outcome bands plus a metrics object. **That is a result, not a reasoning chain.** An analyst cannot coordinate it, a reviewer cannot grade it, and a policymaker cannot act on it, because none of them can see *why*.

**What every domain pack must therefore produce, and what the code does not produce today:** a prose reasoning chain in which every link is traceable to a named sensitivity output of the kernel. The target form is:

> "The judgment sits in band 2. It moves to band 3 when `escalationPropensity` exceeds 61. The sourced range for this actor is 38–55 (source descriptor: three reporting streams, two independent, currency 90 days). Band 2 therefore holds across the sourced range, and the judgment is sensitive to exactly one parameter."

That paragraph is an ICD 203-compliant argument. Producing it requires a **sensitivity sweep as a first-class artifact** — a named output of the kernel with a stable schema, not an ad-hoc script someone runs before a briefing. It also requires §4.2 to land first, because "the sourced range for this actor is 38–55" is exactly the sourced-parameter object that does not exist yet.

The two failures are one engineering item. That is good news for costing and it should be presented that way.

### 4.4 ICD 206 — Sourcing Requirements for Disseminated Analytic Products

[ICD 206](https://www.dni.gov/files/documents/ICD/ICD-206.pdf) specifies four mechanisms. Mapping:

| ICD 206 mechanism | Requirement | Position |
|---|---|---|
| **Source reference citations (SRC)** | Endnotes generated each time a source is cited or a judgment, estimate, alternative hypothesis or confidence level depends on it; must reference "the most original source"; nine required elements including portion marking, originator, unambiguous source identifier, date, and classification of the extracted information | Provenance per claim is the right shape and the right granularity, including the crucial "confidence level depends on a source" case. **The nine-element endnote structure and portion marking are not implemented.** |
| **Appended reference citations (ARC)** | With "a succinct explanation for why the ARC is being included" | Not implemented. Straightforward. |
| **Source descriptors** | "A brief, narrative exposition of factors that affect or indicate the quality or credibility of a single source" — accuracy and completeness, possible denial and deception, age and currency, technical elements of collection, access, validation, motivation, possible bias, expertise | **Not implemented, and this is the larger gap of the two.** Credibility exists as a scalar (`SIMULATION_READING_CREDIBILITY = 0.8`, deliberately below 1 because "the instrument is exact about the model, and the model is an assumption about the world"). ICD 206 wants a *narrative* over named factors. The scalar is a good internal weight and a poor descriptor. |
| **Source summary statements** | Strongly encouraged; importance rises with product and source complexity; must cover "strengths and weaknesses of the source base, which sources are most important to key judgments, what sources are meaningfully corroborative or conflicting" | **The machinery exists and the emitter does not.** Contradiction precision/recall and provenance completeness are exactly the measurements a source summary statement is made of. This is the single highest-leverage compliance item in the whole mapping: it is nearly free, it is "strongly encouraged" by the directive, and — per the landscape sweep — claims about the **source base** rather than about the world are precisely the class of capability that actually fields. |
| **Retention** | Dynamic, ephemeral or non-retained sources preserved ≥ 1 year; for products with a specified time horizon, the horizon or 5 years, whichever is shorter | **Already satisfied** by the pinned as-of corpus snapshot. Present it as compliance. |

### 4.5 IC AI ethics

The [Principles of AI Ethics for the IC](https://www.intelligence.gov/ai/principles-of-ai-ethics) and the [AI Ethics Framework for the IC](https://www.intelligence.gov/ai/ai-ethics-framework), v1.0, June 2020, remain the published IC documents.

| Framework element | Position |
|---|---|
| Purpose: understanding goals and risks | Pack-level. Requires a written statement per capability. |
| Legal obligations and policy considerations | **The US-person minimization gap of §3.5(4) lands here.** Out of vendor scope; must be named, not hidden. |
| Human judgment and accountability | `INSUFFICIENT_EVIDENCE` as a first-class verdict with measured true and false abstention rates is an unusually strong answer: the system declines rather than guesses, and the decline rate is instrumented (7% false abstention at the shipped threshold, across 6 arms). |
| Mitigating undesired bias and ensuring objectivity — the framework cites ICD 203's requirement to "employ reasoning techniques and practical mechanisms that reveal and mitigate bias" | Direct hit: z-score normalization per judge removes severity bias; outlier detection is global, dimensional and unique; confidence aggregates by **weakest link, never by mean**. These are the "practical mechanisms" the text asks for, and they are measured rather than asserted. |
| Testing your AI — "every system must be tested for accuracy in an environment that controls for known and reasonably foreseeable risks prior to being deployed" | The synthetic-oracle regime is exactly a controlled environment. **The negative control is the strongest evidence in the package**: a deliberately misspecified arm scores −0.4561, worse than base rate, with coverage@1 of 0.123. A system that cannot fail on demand has not been tested. |
| Accounting for builds, versions and evolutions | `kernelVersion` in the run identity, "bumped whenever kernel semantics change, invalidating old comparisons." **Panel version is missing** — §1.8 again. |
| Documentation of purpose, **parameters**, limitations, design outcomes | **The parameter-sourcing gap of §4.2, from a second authority.** |
| Transparency: explainability and interpretability | **The argumentation gap of §4.3.** A probability vector is not an explanation. |
| Periodic review | The commit-then-resolve register is the only mechanism that can serve this, and it does so continuously rather than at intervals. |
| Stewardship and accountability | Content-addressed artifacts with per-file hashes give an unusually clean answer to "who is responsible for this output and can it be re-derived." |

### 4.6 NIST AI RMF and the generative-AI profile

- **AI RMF 1.0** (January 2023). NIST states plainly on its own page: **"The AI RMF 1.0 is being revised"** ([NIST](https://www.nist.gov/itl/ai-risk-management-framework)). Do not cite it as a settled target.
- **NIST AI 600-1, Generative AI Profile** (July 2024, page last updated 8 April 2026) ([NIST](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence), [full text](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.600-1.pdf)). Note the provenance: it was issued *"pursuant to President Biden's Executive Order (EO) 14110,"* which was rescinded by EO 14148 in January 2025. The profile is still published and still the best available generative-AI risk taxonomy, but citing it without noting that its authorizing EO is gone is the kind of error a knowledgeable reviewer notices.
- **The control set that will actually matter:** NIST SP 800-53 **Control Overlays for Securing AI Systems (COSAiS)**, in development through 2026, with separate overlays for generative-AI assistants, fine-tuned predictive AI, single-agent and multi-agent systems, and AI developers ([NIST CSRC](https://csrc.nist.gov/projects/cosais)). As of January 2026 the predictive-AI overlay was at annotated-outline stage. **This is not final**, and an accreditor in 2026–27 will be working from drafts. That is an argument for engaging early rather than waiting.

Highest-value AI RMF mappings:

| Subcategory | Position |
|---|---|
| MEASURE 2.9 — "The AI model is explained, validated, and documented, and AI system output is interpreted within its context" | Validated and documented: strong. **Explained: the §4.3 gap.** |
| MEASURE 2.13 — "Effectiveness of the employed TEVV metrics and processes in the MEASURE function are evaluated and documented" | **The architecture's best position anywhere in this mapping.** Almost no system can evaluate its own evaluation. Brier skill against explicit baselines, ECE with bin occupancy, and the negative control arm together constitute exactly that. Lead with 2.13. |
| GOVERN 1.5 — "Maintain a document retention policy to keep history for TEVV" | Content-addressed artifacts with manifests. Satisfied by construction. |
| GOVERN 1.6 — inventory entries to include "data provenance information (e.g., source, signatures, versioning, watermarks) … underlying foundation models, versions of underlying models, and access modes" | `RunIdentity` covers config, corpus snapshot and kernel version. **It does not record the foundation model or its version** — a third independent authority pointing at the same identity gap as §1.8. |

### 4.7 The national-security AI framework actually in force — verify this, do not inherit it

This is the item most likely to be wrong in any document written from memory.

**In force: NSPM-11, "Artificial Intelligence in the National Security Enterprise," 5 June 2026** ([White House](https://www.whitehouse.gov/presidential-actions/2026/06/national-security-presidential-memorandum-nspm-11/), [govinfo](https://www.govinfo.gov/content/pkg/DCPD-202600387/pdf/DCPD-202600387.pdf)).

**Superseded: NSM-25.** NSPM-11 §3(f), verbatim: *"This memorandum hereby rescinds and replaces National Security Memorandum–25 and associated guidance."*

**Therefore also superseded — and this is the trap:** the *Framework to Advance AI Governance and Risk Management in National Security* (the "AI Framework," October 2024), with its prohibited-use list, its "high-impact AI use case" taxonomy, its 180/270-day risk-assessment and data-management clocks and its Chief AI Officer requirement. That framework existed solely to implement NSM-25 §4.2 and states so in its own first sentence ([text](https://data.aclum.org/storage/2025/01/WhiteHouse_ai_gov_wp-content_uploads_2024_10_NSM-Framework-to-Advance-AI-Governance-and-Risk-Management-in-National-Security.pdf)). **CONFIRMED:** NSPM-11 §3(f) rescinds NSM-25 and associated guidance. **ASSUMED (strong textual basis):** the AI Framework falls within "associated guidance." **UNVERIFIED:** no successor high-impact taxonomy has been published as of this research. A white paper that cites the "high-impact AI use case" categories in August 2026 dates itself in one line.

**What replaces it is being written right now.** NSPM-11 §3(c): within 90 days (≈ 3 September 2026), CNSS and OMB shall issue governance policy for AI use in national security systems, maximizing consistency with OMB M-25-21. §5(f): within 120 days (≈ 3 October 2026), the Secretary of War through the NSA Director and the DNI shall submit **"standardized AI national security Test, Evaluation, Verification, and Validation methodologies, including for conformity verification and sustainment of high-security AI systems."** §5(e): within 120 days, a joint AI risk-management and assurance strategy establishing baseline AI security practices. §4(b): a compute roadmap including **"the establishment of an AI test range for national security use cases."**

**The strategic reading, and it is the single most actionable finding in this section:** the standard against which a system like PROTEUS will be measured does not exist yet and is due within weeks of this writing. A vendor whose entire differentiator is measurement, abstention, provenance and calibration is in an unusually good position to be *an input to* that standard rather than a subject of it. That is worth more than any single contract, and the window is now.

**NSPM-11 provisions mapping directly onto the architecture:**

| Provision | Architecture response |
|---|---|
| §2(c) **Assurance** — "reliable, robust, steerable, and controllable," with "rigorous security and functionality measures, including testing, evaluation, validation, and verification" | **Controllable**, per §6's definition ("monitor the operation and outcomes … and take corrective action"): deterministic seeded byte-identical artifacts are the strongest available evidence, because every outcome is re-derivable and inspectable. **Steerable** ("shape the internal behavior … to pursue a given set of objectives"): the abstention gate with a measured operating point. **Robust** ("maintain a level of performance under a variety of circumstances"): the negative control arm at −0.4561 and monotonic skill tracking with evidence quality (+0.44 / +0.42 / +0.11). **Reliable**: 15,832 simulations in 305 s, measured. |
| §2(c) **no-disable clause** | The kernel has no model dependency at all; the LLM sits behind `src/llm/client.ts` with a stub already in the tree. Satisfiable, and testable — which is more than most vendors can say. |
| §2(b) **Adaptation** — "diverse suppliers, large and small"; fact sheet: "dangerous single-vendor dependencies" | Multi-backend inference is now **policy-preferred**, not merely prudent. Frame it that way. |
| §3(b) **termination** for repeated conduct inconsistent with the memorandum | Do not build a hard dependency on any single commercial model. See §1.1. |
| §4(a) — within 120 days, procurement updated for "rapid onboarding of the most advanced AI models from multiple vendors" | This is the on-ramp language. It is also the same directive the CIA Acquisition Framework is executing against. |

**Also in force but mostly orthogonal:** [EO 14409](https://www.whitehouse.gov/wp-content/uploads/2026/06/eo-14409.pdf), "Promoting Advanced Artificial Intelligence Innovation and Security," 2 June 2026 — a classified NSA-run benchmarking process for "covered frontier model" designation and a voluntary 30-day pre-release access framework. §3(c) states explicitly that nothing in it authorizes a mandatory licensing or preclearance regime. It does not bind PROTEUS directly, but a "covered frontier model" designation could affect which models are available, which is one more reason not to depend on one.

---

## 5. Data Rights and Business Terms

### 5.1 The floor for this space: Government Purpose Rights, minimum

REASON sets it in the BAA text quoted in §2.1 — GPR minimum, so the government can "modify and deploy deliverables on classified networks" — and reinforces it in the proposal instructions:

> "The Government requires, at a minimum, Government Purpose Rights for all deliverables developed with mixed funding or that incorporate technical data or computer software developed at private expense; **anything less shall be considered a weakness in the proposal.** All other deliverables shall be delivered with unlimited rights in accordance with FAR clause 52.227-14."

That floor is not arbitrary. It follows mechanically from the REASON pattern: if the cleared T&E team must run your system on classified data without you, the government must hold rights sufficient to install, modify and operate it, and to hand it to *its own* support contractors. **You cannot have the REASON pattern and withhold GPR.** Any bid that proposes the pattern while asserting restrictive rights is internally inconsistent, and a contracting officer will read it that way.

### 5.2 What GPR actually costs you — the part that surprises people

Per [DFARS 252.227-7014](https://www.law.cornell.edu/cfr/text/48/252.227-7014), government purpose rights mean the rights to use, modify, reproduce, release, perform, display or disclose software within the Government without restriction, **and** to release it outside the Government and authorize those recipients to do the same for United States Government purposes. And:

> "Government purposes include **competitive procurement**, but do not include the rights to use, modify, reproduce, release, perform, display, or disclose computer software … for commercial purposes."

**Read that twice.** GPR permits the government to hand your source code to a competitor in order to compete the follow-on. The nominal GPR period is five years, negotiable, commencing on execution of the instrument that required the development; on expiry the government gets **unlimited rights**, including the right to authorize commercial use ([DFARS 227.7203-5](https://www.acquisition.gov/dfars/227.7203-5-government-rights.)).

The protection that survives is DFARS 252.227-7025, which limits use and disclosure by other contractors receiving GPR material — the clause that keeps your T&E contractor from becoming your competitor. **It must be in the flowdown, and confirming its presence is a pre-signature check, not a post-award discovery.**

### 5.3 What SBIR data rights buy, and for how long

Materially better, and the terms changed recently enough that stale advice is common.

- **20-year protection period**, running from **date of award**, non-extendable. SBA eliminated the roll-over/extension provision effective 2 May 2019 ([SBA](https://www.sbir.gov/tutorials/data-rights/tutorial-2)); DoD codified it in a final rule effective **17 January 2025** ([Crowell](https://www.crowell.com/en/insights/client-alerts/final-dod-rule-codifies-20-year-sbir-data-protection-period-and-other-sbir-program-protections)), replacing the old extendable five-year period.
- **During the period:** limited rights in technical data, restricted rights in software. The government "may not release or disclose" it except as authorized for limited/restricted-rights material ([DFARS 227.7104-2](https://www.acquisition.gov/dfars/227.7104-2-rights-sbir-or-sttr-data.)).
- **After the period:** **perpetual Government Purpose Rights** — changed from unlimited rights, which is a genuine improvement, but note it never expires.
- **Marking is constitutive.** Unmarked or mismarked data loses protection; there is a six-month cure window.
- **Scope covers Phase III.** DFARS 227.7104-1 was amended to make explicit that SBIR/STTR data rights apply to data developed or generated under contracts including Phase III work.
- **The asymmetry to price in:** an offeror cannot be *required* to relinquish SBIR rights as a condition of award — but the government "may use information provided by offerors … in the source selection process to evaluate the impact of proposed restrictions." DoD adopted that over industry objection. **Translation: you keep your rights and you lose points for keeping them.** REASON says the quiet part out loud — "anything less shall be considered a weakness."

### 5.4 The sequencing trap, stated plainly

SBIR data rights and a REASON-style GPR-minimum solicitation are in direct tension, and the tension is resolved by **the order in which you take money**, which is a decision made once and lived with for twenty years.

Take SBIR money first and you hold 20 years of limited/restricted rights on everything SBIR funded. Then bid a GPR-minimum BAA and you must either (a) carve out the SBIR-funded components and satisfy the BAA's five-part explanation requirement, or (b) concede GPR and give away the protection you just bought.

The BAA's five parts are worth quoting because they are the actual test, and most offerors underestimate part (4):

> "(1) clearly identify such data/software and its proposed particular use(s); (2) identify and explain any and all restrictions on the Government's ability to use, modify, reproduce, release, perform, display, or disclose … (3) identify the **potential cost to the Government to acquire GPR** in all deliverables that use the proprietary technical data or computer software …; (4) **explain how the Government shall be able to reach its program goals (including transition) within the proprietary model offered**; and (5) provide possible nonproprietary alternatives …"

Part (4) is where restrictive bids die. If your answer is "the government reaches its goals by continuing to buy from us," you have described a sole-source dependency to an audience whose current policy explicitly targets single-vendor dependencies. Also note the BAA's instruction: *"To the greatest extent feasible, offerors should not include background proprietary technical data and computer software as the basis of their proposed technical approach."*

And the pre-award mechanic that catches people: **DFARS 252.227-7017** requires assertion of every restriction *before* award. An item omitted from the assertion table forfeits its restriction. Build that table before you need it.

### 5.5 The split to price for PROTEUS specifically

The landscape sweep's central finding is that **60 candidates collapse to roughly 12 kernel families and 22 distinct capabilities.** That collapse is the config-not-code argument, and it dictates the data-rights strategy exactly.

**Concede — GPR or unlimited, deliberately and early:**

- The artifact format, canonicalization and manifest/hashing scheme. Withholding it defeats the T&E argument you are selling and buys nothing: it is an interoperability surface, and its value is in adoption.
- The metrics package. A competent competitor reimplements a Murphy decomposition in a week. Guarding it costs credibility and protects nothing.
- The config schemas and the adapter API. Same reasoning.
- The kernel itself. It is 100 lines of driver plus a PRNG.

**Protect — SBIR-marked, background-IP, or specifically negotiated:**

- **The domain packs.** Calibrated actor configurations, curated corpora, mission-lens bindings, threshold cards. These are the TRL-2/3 column, they are where the recurring revenue is, and they are what actually takes years to build.
- **The panel rubric library.** Once §1.8 makes rubrics into versioned, hashed assets, they become the accumulated adjudication tradecraft — the most defensible asset in the system.
- **Calibrated adapter constants**, distinct from the adapter code.

**The strategic frame:** give away the engine, price the packs. That is consistent with the GPR floor rather than fighting it, it matches how the market actually collapses, and it is a story a contracting officer can approve without a waiver.

### 5.6 Organizational conflict of interest

**Current regime:** [FAR Subpart 9.5](https://www.acquisition.gov/far/subpart-9.5), essentially unchanged since the 1960s, with the operative case law from *Aetna Gov't Health Plans* (B-254397.15, 27 July 1995) establishing the three categories: **unequal access to information**, **impaired objectivity**, **biased ground rules**. FAR 9.505-3 is directly on point: *"Contracts for the evaluation of offers for products or services shall not be awarded to a contractor that will evaluate its own offers … or those of a competitor, without proper safeguards."* FAR 9.507-2 provides the standard remedy — a limitation-on-future-contracting clause, of fixed and reasonable duration, terminating on a specific date or identifiable event.

**Pending:** a proposed rule published 15 January 2025 implementing the Preventing Organizational Conflicts of Interest in Federal Acquisition Act (Pub. L. 117-324) would **delete FAR Subpart 9.5** and create **FAR Subpart 3.12**, codify the three categories, add provisions 52.203-XX (disclosure and representation), 52.203-AA (unequal access), 52.203-DD (post-award disclosure, with termination rights and mandatory flowdown) and 52.203-MM (mitigation), and — significantly — make a government-approved mitigation plan **contractually binding**, exposing a contractor to claims and potentially False Claims Act liability for failing to follow its own plan ([Steptoe](https://www.steptoe.com/en/news-publications/far-council-issues-proposed-oci-far-rule.html), [PilieroMazza](https://www.pilieromazza.com/proposed-rule-on-organizational-conflicts-of-interest-signals-significant-changes-for-contractors/)). Comments closed 17 March 2025. **Final-rule status as of August 2026: UNVERIFIED.** Check before relying on either version.

**Two exposures specific to this system:**

**(a) The T&E seat is not free.** Taking the T&E role on a program creates biased-ground-rules and impaired-objectivity exposure, normally resolved by a limitation-on-future-contracting clause **barring you from competing as a performer on that program** for a stated term. REASON's own Q&A shows an offeror asking exactly this — whether providing the T&E platform and participating with a performer were mutually exclusive — and notes T&E was expected to be "a separate ODNI contracting vehicle." So the T&E-first strategy in §6 buys the first contract and the inside position, and it costs the performer seat on that program. **Say so in the bid before someone else does.** The mitigations are real but must be chosen deliberately: be T&E on program A and a performer on program B; or treat T&E as a durable line of business rather than a wedge.

**(b) Scoring your own work is impaired objectivity in miniature.** A system that both produces analytic judgments and grades analytic judgments — with its own metrics package — is the textbook case. The architecture already has most of the answer: the metrics package is domain-agnostic, the `EvaluationRegime` tag is mandatory and no function pools regimes. **What the bid must add is a named independent scorer** and a commitment that the vendor never grades its own live products. Volunteering this before it is raised is worth more than answering it well after.

---

## 6. The Acquisition Path

### 6.1 Ground truth first

The solicitation came from CIA. That constrains the realistic paths more than any technical consideration, and two facts shape everything below.

**Fact one: CIA's acquisition posture changed on 9 February 2026.** Director Ratcliffe announced a new CIA Acquisition Framework built around centralized vendor vetting and a streamlined IT authorization process, intended to "significantly reduce the time between when CIA defines a mission requirement and when it receives operating authority," and providing "clear pathways for CIA to leverage its unique authorities to acquire essential capabilities, **rapidly onboard breakthrough technology prototypes**, and modernize its core systems" ([CIA](https://www.cia.gov/stories/story/cia-launches-new-acquisition-framework-to-turbocharge-collaboration-with-private-sector/)). It is led by **Efstathia Fragogiannis**, who joined as chief procurement executive in November 2025 from DARPA, where she was director of contracts and senior procurement executive ([Nextgov](https://www.nextgov.com/acquisition/2026/02/cia-announces-new-acquisition-framework-speed-tech-adoption/411285/), [Federal News Network](https://federalnewsnetwork.com/intelligence-community/2026/02/cia-emphasizes-speed-under-new-acquisition-framework/)). She gave her first interview as CPO in June 2026 ([FedScoop](https://fedscoop.com/radio/cia-issued-a-new-acquisition-framework-that-it-hopes-will-turbocharge-collaboration/)).

**What is public: the announcement and the interview. What is NOT public: the pathway names, dollar thresholds, cycle times, or the prototype on-ramp's entry criteria — UNVERIFIED, and CIA "didn't release details on specific acquisition authorities or contracting approaches."** The correct move is therefore not to guess. It is to ask the contracting officer **which pathway this white paper is being routed to.** That question costs nothing, it is exactly the question the framework was built to answer, and the answer determines everything about how the bid should be shaped. Ask it in writing, early.

**Fact two: the DARPA lineage is a strong signal.** A DARPA senior procurement executive running IC acquisition reform predicts BAA-, OT- and prototype-shaped instruments over traditional FAR Part 15 competitions. Shape the white paper as a research proposal with a demonstrable prototype and named metrics, not as a product datasheet.

### 6.2 The paths, ranked by realistic probability of a first dollar

**1 — In-Q-Tel. Highest probability, and it is not close.**

IQT was set up by CIA in 1999 as an independent not-for-profit strategic investment firm; it is not a government entity and not part of CIA ([IQT](https://www.iqt.org/about)). Two instruments:

- **Equity-only:** $250K–$500K, typically a $250K check, stage-agnostic pre-seed to growth, board observer seat on every deal. Not about ownership or return — about "formalizing that relationship, getting on the cap table, getting in the boardroom."
- **Technology Development Agreement / "work program":** $500K–$3M, structured as a development and licensing agreement. This is the one that matters. It bundles a **statement of work between the company and one or more agencies** into roughly a 12-month paid design partnership. IQT provides NRE dollars to influence product direction and **purchases enough product to run a pilot**, then works with agency procurement so the agency can buy directly ([A.J. Bertone interview](https://www.tectonicdefense.com/q-a-a-j-bertone-managing-partner-in-q-tel/), [Kyle McNulty interview](https://www.vcsheet.com/fun-raising/kyle-mcnulty-in-q-tel), [Steve Bowsher, Stanford](https://www.youtube.com/watch?v=ShjFX4r9J78)).

IQT receives roughly $100M/yr in government funding, self-funds 35–40% of its spend from prior proceeds, brings in about $40 of outside capital per dollar committed, and works with 15+ partners including CIA, NSA, NRO, NGA, DIA, FBI, DHS, CENTCOM, Space Force, Army, DOE/NNSA and Navy, plus UK and Australian services. Bowsher states IQT got **both Palantir and Anduril their first government customer** through the work-program mechanism.

**Timeline:** directed-investment diligence "can sometimes take a month, two months" and typically closes *between* rounds rather than on one. **The diligence is genuinely different from a VC's:** you must build an internal agency champion who will commit real time over twelve months. Bowsher's framing is the useful one — the person who cares about your product, the person with budget, and the person with purchasing authority are three different people, and the work program exists to triangulate them. The government-side interface is the **QIC (In-Q-Tel Interface Center)**, staffed with people whose job is to represent the problem set and identify the procurement route.

**Why it fits this system specifically:** a 12-month paid design partnership against a named agency problem set is precisely the shape of a domain pack. It also produces the one thing a white paper cannot — an operator who has used the thing and will say so.

**2 — Position as the program's T&E rather than as a competing performer.**

The argument is strong enough to lead with, and the landscape sweep already pointed at it. Every REASON-pattern program **must buy independent T&E from someone**, that someone must be technically capable of re-deriving performer runs, and the field of vendors who have built deterministic reproduction infrastructure is approximately empty. It is a smaller, faster, less contested first contract, and it puts you inside the program with visibility into every performer's approach.

It is also the role the architecture was accidentally built for: §2's entire argument is a description of a T&E capability.

**The cost, stated honestly:** per §5.6, taking T&E normally comes with a limitation on future contracting barring you from competing as a performer on that program. Decide deliberately whether you are buying a wedge or building a business. The honest answer for a company whose differentiator is measurement is that **T&E is the business**, not the wedge — measurement, abstention, provenance and calibration are exactly what a T&E contractor sells, and the landscape sweep's finding that raw forecasting skill is commoditizing (see §6.4) argues the same way.

**3 — Answer the solicitation in front of you, shaped correctly.**

The white paper you were asked for. Shape it per §6.4. Ask the pathway question from §6.1. Expect a BAA-, CSO- or prototype-shaped instrument.

**4 — BAA.**

REASON's own authority: FAR 6.102(d)(2) and 10 U.S.C. 4001, competitive selection of basic research proposals, treated as full and open competition. **Timeline, measured from REASON:** Proposers' Day 11 January 2023 → BAA release 20 March 2023 → questions due 3 April → answers 14 April → proposals due 8 May 2023 → intended start 1 October 2023. **Roughly nine months from Proposers' Day to period of performance**, then a 42-month program. Multiple awards anticipated; Phase 2 funding at the government's sole discretion. Budget your runway accordingly — this path does not pay a small company's rent in year one.

**5 — Commercial Solutions Opening and Other Transactions.**

Note the jurisdictional caveat up front: 10 U.S.C. 3458 and 4022 are **Title 10 DoD/DoW authorities**. Whether they are available to a CIA-origin requirement depends on the contracting activity, and CIA holds its own authorities. **UNVERIFIED for this solicitation** — another reason to ask the pathway question. That said, the FY26 NDAA changes are large enough that they will shape the whole market:

- **§1823 removed the word "innovative"** from 10 U.S.C. 3458 — CSOs are now a general commercial acquisition tool, not a niche innovation vehicle ([Nextgov](https://www.nextgov.com/ideas/2026/01/ndaa-massive-expansion-commercial-solutions-openings-and-other-key-takeaways-defense-contractors/410418/)).
- **Production OTAs can now be awarded directly from a CSO**, skipping the prototype step, with sole-source follow-on production available where the CSO was openly competed ([Holland & Knight](https://www.hklaw.com/en/insights/publications/2026/03/an-offerors-legal-guide-to-commercial-solutions-openings), [10 U.S.C. 3458](https://uscode.house.gov/view.xhtml?req=(title:10%20section:3458%20edition:prelim))).
- **The >$10M written determination is eliminated**; review may be peer, technical **or operational** ([PilieroMazza](https://www.pilieromazza.com/the-rise-of-ota-in-defense-contracting-part-5-commercial-solutions-openings-and-ndaa-fy26/)).
- **Constraints that remain:** fixed-price or fixed-price-incentive only; awards over $100M need senior procurement executive approval and congressional notification within 45 days.
- **Typical three-phase flow** (e.g. JIATF 401, open through 31 December 2028): Phase 1 a **five-page solution brief** with company info, executive summary, technology concept and rough order of magnitude price; Phase 2 an oral presentation and possible demonstration covering technical and business viability, ROM pricing, **IP considerations** and notional schedule; Phase 3 a full Commercial Solution Proposal, technical rated Acceptable/Unacceptable, price evaluated for fair and reasonableness.
- **Cost share:** a prototype OT under 10 U.S.C. 4022 carries a one-third cost-share requirement **unless** a nontraditional defense contractor participates to a significant extent, **or** all significant participants are small businesses, **or** the SPE grants an exceptional-circumstances waiver. A company with no CAS-covered DoD contract in the preceding year qualifies as nontraditional under 10 U.S.C. 3014.
- **Teaming, and this is a genuine option most people miss:** §4022(f) permits sole-source follow-on production to "the participants in the transaction" who successfully completed the prototype. "Participant" is undefined in the statute, its implementing regulations (32 C.F.R. Part 3) and the DoW Other Transactions Guide — so a significantly-involved subcontractor may qualify. **Negotiate teaming agreements with the follow-on in mind, not just the prototype.**

**The IP point that makes OTs attractive here:** OTs are not subject to the FAR, so data rights are negotiated commercially rather than inherited from DFARS. Given §5's tensions, that flexibility is worth real money.

### 6.3 Timelines and dollar ranges — sourced versus estimated, labelled

| Path | Dollars | Time to first dollar | Evidence class |
|---|---|---|---|
| IQT equity | $250K–$500K (typically $250K) | Weeks to a few months | **Sourced** — IQT and partner interviews |
| IQT technology development agreement | $500K–$3M, ~12-month SOW | 1–2 months diligence after champion identified; longer to find the champion | **Sourced** |
| BAA (REASON-class) | Multiple awards, amounts not published | ~9 months solicitation-to-start; 42-month program | **Sourced** — REASON schedule |
| CSO / OTA | Fixed-price; <$100M without SPE approval | Rolling; three-phase, five-page entry | **Sourced** — statute + practitioner guides |
| CIA Acquisition Framework prototype on-ramp | Not published | Not published | **UNVERIFIED** — ask the CO |
| T&E role | Not published; a separate ODNI vehicle under REASON | Follows the program's own schedule | **Partially sourced** — REASON Q&A confirms the separate vehicle |
| SBIR Phase I/II | — | — | **Not stated.** Current thresholds were not verified in this research, and CIA's SBIR participation was not verified. Do not put a number in the bid without checking the solicitation. |

### 6.4 Failure modes that bin a white paper

Ordered by how often they are fatal.

1. **The output does not land on a dated artifact with a signature block.** The landscape sweep's most reliable discriminator of buyability. Standalone probabilities "for senior policymakers" have no home in IC production. **Name the artifact and the office**: a BIS rule annex, an OFAC designation memo, a stockpile purchase decision, an ICD 203 review, a watch list. If you cannot name it, the capability is not buyable regardless of its accuracy.
2. **Coordination silence.** IC finished intelligence is coordinated across agencies. Nothing in 60 surveyed candidates says who represents a machine judgment in a coordination meeting or who takes the dissent footnote. **The capabilities that dodge this entirely are those making claims about the SOURCE BASE rather than about the world** — and those are the ones that field. This is a second, independent reason to lead with the ICD 206 source-summary-statement capability of §4.4: it is the claim class that does not require anyone to defend a machine's opinion in a room full of analysts.
3. **TRL inflation.** Counting the platform instead of the domain pack. **Ship two columns**: platform TRL 4, each adapter/corpus/actor-config TRL 2–3. A reviewer who catches you conflating them discounts every other number in the document.
4. **Backtesting against the customer's own historical analytic calls.** Never do this in a bid. Use public baselines — persistence, base rate, INFER, Metaculus, ViEWS.
5. **Quoting stale forecasting-skill comparisons.** The "LLMs lose to superforecasters" claim went stale on 16 July 2026, when ForecastBench operators reported several systems statistically indistinguishable from superforecaster accuracy and one outranking the superforecaster median on market questions. Do **not** quote the 2024 figures (0.068 vs 0.119) as current. Strategically this *helps*: if raw forecasting skill is commoditizing, the durable differentiator is measurement, abstention, provenance and calibration — which is exactly what this architecture sells, and exactly what a T&E role is.
6. **Naming a single commercial model as a hard dependency.** Now a policy-flagged failure under NSPM-11 §2(b)/(c) and the fact sheet's single-vendor-dependency language, and empirically hazardous given the February 2026 contract cancellations.
7. **Proposing to fine-tune on classified data.** It creates a classified derived model artifact requiring registration, marking, storage and destruction; a retraining step the T&E team must accredit; and an entire category of unattributable difference. PROTEUS does not need to. **Say so — it is a differentiator most competitors cannot claim.**
8. **An unfilled evaluation-regime tag.** Reporting an accuracy number without naming `synthetic_oracle` / `historical_backtest` / `live_post_cutoff`. The code refuses to pool regimes; the white paper must be equally disciplined. Every number in §"Measured today" carries its regime, and the four unmeasured items — historical backtest accuracy, live post-cutoff accuracy, skill versus a human analyst, contradiction detection on real prose — must be labelled as unmeasured every single time they appear.
9. **Restrictive data rights without the five-part explanation.** "Anything less shall be considered a weakness." Part (4) — how the government reaches its goals inside your proprietary model — is where restrictive bids die.
10. **Requiring classified access to start.** The entire point of the REASON pattern is that you do not get it and do not need it. A bid whose critical path runs through clearances and facility accreditation is slower, more expensive and easier to decline. **Lead with the fact that you are asking for none of it.**

---

## Sources

**Classified-mode inference and infrastructure**
- [Amazon Bedrock launches with Claude 3.5 Sonnet in the AWS Top Secret cloud](https://aws.amazon.com/blogs/publicsector/amazon-bedrock-launches-with-claude-3-5-sonnet-in-the-aws-top-secret-cloud/) — AWS Public Sector, Jan 2025
- [Amazon Bedrock is now available (AWS Secret-East)](https://aws.amazon.com/about-aws/whats-new/2025/11/amazon-bedrock-is-now-available/) — AWS, Nov 2025
- [Amazon to launch second Secret Cloud Region in 2025](https://aws.amazon.com/blogs/publicsector/amazon-to-launch-second-secret-cloud-region-in-2025/) — AWS (Secret-West live 22 Oct 2025)
- [Announcing GPT-5.2 Availability in Azure for U.S. Government Secret and Top Secret Clouds](https://devblogs.microsoft.com/azuregov/advancing-ai-capabilities-in-azure-for-u-s-government-secret-and-top-secret-clouds/) — Microsoft, 15 Jan 2026
- [Azure OpenAI Service now authorized for all U.S. Government data classification levels](https://devblogs.microsoft.com/azuregov/azure-openai-authorization/) — Microsoft, Apr 2025
- [Microsoft AI products authorized for Top Secret workloads under ICD 503](https://devblogs.microsoft.com/azuregov/unlocking-new-possibilities/) — Microsoft, Jan 2025
- [Run Gemini anywhere, including on-premises, with Google Distributed Cloud](https://cloud.google.com/blog/topics/hybrid-cloud/gemini-is-now-available-anywhere) — Google Cloud, Aug 2025
- [DoD compliance scope for Distributed Cloud air-gapped (IL6)](https://docs.cloud.google.com/docs/security/compliance/il6-gdc-compliance-scope) — Google Cloud
- [OCI Generative AI Service now available in Oracle's US classified cloud regions](https://blogs.oracle.com/cloud-infrastructure/oci-gen-ai-service-in-us-classified-cloud) — Oracle
- [Oracle Defense Industrial Base Isolated Cloud](https://www.oracle.com/news/announcement/oracle-empowers-defense-industrial-base-to-innovate-at-scale-with-new-isolated-cloud-2026-03-31/) — Oracle, 31 Mar 2026
- [On-Prem LLM Deployment for Air-Gapped Federal Environments](https://precisionfederal.com/insights/on-prem-llm-deployment-air-gapped) — Jan 2026
- [Classified AI: Air-Gapped LLMs, SCIF Development, MLS](https://precisionfederal.com/capabilities/classified-ai)
- [RFI: Agentic AI Platforms for Army classified networks](https://sam.gov/workspace/contract/opp/5bf4cceb9aff4a2eafc01ee909d718e4/view) — SAM.gov, 4 Jun 2026
- [DISA launching experimental cloud-based chatbot for INDOPACOM](https://defensescoop.com/2025/03/25/disa-siprgpt-chatbot-indopacom-joint-operational-edge-cloud/) — DefenseScoop
- [MARADMIN 496/24: NIPR and SIPR LLM capabilities](https://www.marines.mil/News/Messages/Messages-Display/Article/3941033/communicating-the-availability-of-authorized-nipr-and-sipr-llm-capabilities/) — USMC
- [Claude Gov models for U.S. national security customers](https://www.anthropic.com/news/claude-gov-models-for-u-s-national-security-customers) — Anthropic, Jun 2025
- [Trump memo on AI aims to avoid repeat of Anthropic debacle](https://breakingdefense.com/2026/06/trump-memo-on-ai-aims-to-avoid-repeat-of-anthropic-debacle/) — Breaking Defense, Jun 2026

**REASON**
- [IARPA REASON program page](https://www.iarpa.gov/research-programs/reason)
- [REASON BAA W911NF-23-S-0007, final, 17 March 2023](https://arl.devcom.army.mil/wp-content/uploads/sites/3/2023/04/W911NF-23-S-0007-REASON-BAA-Final-17-March-2023.pdf)
- [REASON BAA Amendment 2 Q&A](https://www.iarpa.gov/images/PropsersDayPDFs/REASON/REASONBAA-Amendment2-QandA.pdf)

**Analytic and AI standards**
- [ICD 203 / 206 / 208 (combined text)](https://www.bmbs.org/salamanca/readings/ODNI_ICDs_203-206-208.pdf)
- [ICD 206, Sourcing Requirements for Disseminated Analytic Products](https://www.dni.gov/files/documents/ICD/ICD-206.pdf)
- [ODNI: Objectivity — the five standards and nine tradecraft standards](https://www.dni.gov/index.php/how-we-work/objectivity)
- [Analytic Tradecraft Standards (DIA implementation)](https://www.armyupress.army.mil/Journals/Military-Review/English-Edition-Archives/March-April-2021/Kwoun-Tradecraft-Standards/) — Military Review
- [Principles of AI Ethics for the Intelligence Community](https://www.intelligence.gov/ai/principles-of-ai-ethics) — ODNI
- [AI Ethics Framework for the Intelligence Community, v1.0](https://www.intelligence.gov/ai/ai-ethics-framework) — ODNI, June 2020
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) — note: "AI RMF 1.0 is being revised"
- [NIST AI 600-1, Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.600-1.pdf)
- [NIST SP 800-53 Control Overlays for Securing AI Systems (COSAiS)](https://csrc.nist.gov/projects/cosais)

**National-security AI policy in force**
- [NSPM-11, Artificial Intelligence in the National Security Enterprise, 5 June 2026](https://www.whitehouse.gov/presidential-actions/2026/06/national-security-presidential-memorandum-nspm-11/) — and [govinfo text](https://www.govinfo.gov/content/pkg/DCPD-202600387/pdf/DCPD-202600387.pdf)
- [Fact Sheet: NSPM-11](https://www.whitehouse.gov/fact-sheets/2026/06/fact-sheet-president-donald-j-trump-signs-historic-directive-on-ai-in-the-national-security-enterprise/)
- [EO 14409, Promoting Advanced Artificial Intelligence Innovation and Security, 2 June 2026](https://www.whitehouse.gov/wp-content/uploads/2026/06/eo-14409.pdf)
- [CRS IF13268, Controlling Advanced Artificial Intelligence](https://www.congress.gov/crs_external_products/IF/PDF/IF13268/IF13268.2.pdf)
- [What Trump's National Security AI Memo Gets Right—and Leaves Unresolved](https://www.cfr.org/articles/what-trumps-national-security-ai-memo-gets-right-and-leaves-unresolved) — CFR, Jun 2026
- [Framework to Advance AI Governance and Risk Management in National Security](https://data.aclum.org/storage/2025/01/WhiteHouse_ai_gov_wp-content_uploads_2024_10_NSM-Framework-to-Advance-AI-Governance-and-Risk-Management-in-National-Security.pdf) — **superseded with NSM-25**

**Data rights and OCI**
- [DFARS 252.227-7018, SBIR/STTR data rights](https://www.acquisition.gov/dfars/252.227-7018-rights-other-commercial-technical-data-and-computer-software%E2%80%94small-business-innovation-research-program-and-small-business-technology-transfer-program.)
- [DFARS 227.7104-2, Rights in SBIR or STTR data](https://www.acquisition.gov/dfars/227.7104-2-rights-sbir-or-sttr-data.)
- [DFARS 252.227-7014, Rights in Other Than Commercial Computer Software](https://www.law.cornell.edu/cfr/text/48/252.227-7014)
- [DFARS 227.7203-5, Government rights](https://www.acquisition.gov/dfars/227.7203-5-government-rights.)
- [Final DOD Rule Codifies 20-Year SBIR Data Protection Period](https://www.crowell.com/en/insights/client-alerts/final-dod-rule-codifies-20-year-sbir-data-protection-period-and-other-sbir-program-protections) — Crowell, Jan 2025
- [SBIR data rights tutorial](https://www.sbir.gov/tutorials/data-rights/tutorial-2) — SBA
- [DoW SBIR/STTR Data Rights](https://www.defensesbirsttr.mil/Data-Rights/)
- [FAR Subpart 9.5, Organizational and Consultant Conflicts of Interest](https://www.acquisition.gov/far/subpart-9.5)
- [FAR Council Issues Proposed OCI FAR Rule](https://www.steptoe.com/en/news-publications/far-council-issues-proposed-oci-far-rule.html) — Steptoe, Jan 2025
- [Proposed Rule on OCI Signals Significant Changes](https://www.pilieromazza.com/proposed-rule-on-organizational-conflicts-of-interest-signals-significant-changes-for-contractors/) — PilieroMazza
- [Public Law 117-324, Preventing Organizational Conflicts of Interest in Federal Acquisition Act](https://www.congress.gov/117/plaws/publ324/PLAW-117publ324.pdf)

**Acquisition paths**
- [CIA Launches New Acquisition Framework](https://www.cia.gov/stories/story/cia-launches-new-acquisition-framework-to-turbocharge-collaboration-with-private-sector/) — CIA, 9 Feb 2026
- [CIA announces new acquisition framework to speed tech adoption](https://www.nextgov.com/acquisition/2026/02/cia-announces-new-acquisition-framework-speed-tech-adoption/411285/) — Nextgov/FCW
- [CIA emphasizes speed under new acquisition framework](https://federalnewsnetwork.com/intelligence-community/2026/02/cia-emphasizes-speed-under-new-acquisition-framework/) — Federal News Network
- [CIA CPO Effie Fragogiannis interview](https://fedscoop.com/radio/cia-issued-a-new-acquisition-framework-that-it-hopes-will-turbocharge-collaboration/) — FedScoop, Jun 2026
- [IQT: About / Our History and investment model](https://www.iqt.org/about)
- [Q+A: A.J. Bertone, Managing Partner, In-Q-Tel](https://www.tectonicdefense.com/q-a-a-j-bertone-managing-partner-in-q-tel/) — Dec 2025
- [Kyle McNulty, In-Q-Tel — investment structure](https://www.vcsheet.com/fun-raising/kyle-mcnulty-in-q-tel)
- [In-Q-Tel's Steve Bowsher, Stanford Seminar](https://www.youtube.com/watch?v=ShjFX4r9J78)
- [10 U.S.C. 3458](https://uscode.house.gov/view.xhtml?req=(title:10%20section:3458%20edition:prelim)) — current through 9 Aug 2026
- [DFARS Subpart 212.70, Defense Commercial Solutions Opening](https://www.acquisition.gov/dfars/subpart-212.70-defense-commercial-solutions-opening)
- [An Offeror's Legal Guide to Commercial Solutions Openings](https://www.hklaw.com/en/insights/publications/2026/03/an-offerors-legal-guide-to-commercial-solutions-openings) — Holland & Knight, Mar 2026
- [NDAA: Massive expansion of commercial solutions openings](https://www.nextgov.com/ideas/2026/01/ndaa-massive-expansion-commercial-solutions-openings-and-other-key-takeaways-defense-contractors/410418/) — Nextgov, Jan 2026
- [The Rise of OTA in Defense Contracting, Part 5](https://www.pilieromazza.com/the-rise-of-ota-in-defense-contracting-part-5-commercial-solutions-openings-and-ndaa-fy26/) — PilieroMazza

**Code, verified this session (absolute paths)**
- `/Users/possible/Documents/Proteus/engine/src/artifact/store.ts:27–35` — `RunIdentity` has no panel field
- `/Users/possible/Documents/Proteus/engine/src/sim/adapters/influence-ops/config.ts:4–8` — scope-boundary invariant; zero string fields (grep verified, exit 1)
- `/Users/possible/Documents/Proteus/engine/src/sim/adapters/recruitment/config.ts:9–19` — scope-boundary invariant; zero string fields (grep verified, exit 1)
- `/Users/possible/Documents/Proteus/engine/src/sim/adapters/recruitment/workforce.ts:10–35` — `Person` is six numbers and a boolean
- `/Users/possible/Documents/Proteus/engine/src/agents/framer.ts:37–45` — `RunSpecSchema`; `label` and `rationale` are unguarded `z.string()`
- `/Users/possible/Documents/Proteus/engine/src/agents/panel.ts:33–36` — `systemPrompt` is unguarded, unpersisted, unhashed `z.string()`
- `/Users/possible/Documents/Proteus/engine/src/corpus/as-of.ts:151` — `LeakageError` thrown on post-as-of citation
- `/Users/possible/Documents/Proteus/engine/src/sim/kernel.ts` — domain-agnostic driver, seeded fork scheme
- `/Users/possible/Documents/Proteus/engine/tests/sim/determinism-guards.test.ts` — the source-scanning enforcement pattern the red-line suite should reuse