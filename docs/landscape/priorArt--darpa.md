# DARPA Program Archaeology: Social Simulation, Influence, Wargaming, Causal Modeling, and AI-Assisted Decision-Making

**Scope note.** Every program below was checked against a DARPA program page, a DARPA press release, a solicitation, a performer announcement, or a peer-reviewed program retrospective. Where a fact could not be confirmed from such a source it is marked **UNVERIFIED** rather than dropped or asserted. Two corrections to the assignment's target list are made up front, because they change the analysis:

- **CREATE is IARPA, not DARPA.** Crowdsourcing Evidence, Argumentation, Thinking and Evaluation ran under IARPA 2017–Feb 2020 ([iarpa.gov](https://www.iarpa.gov/research-programs/create)). It is the single closest prior art to our adjudication panel and is covered in full below in the IC-adjacent section.
- **There is no DARPA program named "Wargaming/SMART."** SMA is the Joint Staff J-39 **Strategic Multilayer Assessment** office — it *co-published* the DARPA COMPASS report ([OSTI 1592839](https://www.osti.gov/biblio/1592839)) and runs ICONS-based simulations for COCOMs ([ICONS/UMD](https://icons.umd.edu/research/government)), but it is not a DARPA program. DARPA's wargaming line is **Gamebreaker → SCEPTER → DISCORD**, covered below.

One more finding worth flagging immediately: **DARPA already used the name PROTEUS** — Prototype Resilient Operations Testbed for Expeditionary Urban Scenarios, STO, 2017–2021, transitioned to the Marine Corps Warfighting Laboratory in June 2021 ([darpa.mil](https://www.darpa.mil/news/2021/proteus-transitions)). Any white paper submitted under the name "PROTEUS" will collide with a DARPA program that a reviewer may remember by name.

---

## PART A — The influence-operations lineage (closest prior art to our IO vertical slice)

### A1. SocialSim — Computational Simulation of Online Social Behavior

| Field | Value |
|---|---|
| **Years** | 2017 – 2022 (Leidos final report: "from program inception in 2017 through the end of the program in 2022," [DTIC AD1229451](https://apps.dtic.mil/sti/html/trecms/AD1229451/index.html)). DARPA page: "This program is now complete" ([darpa.mil](https://www.darpa.mil/research/programs/computational-simulation-of-online-social-behavior)) |
| **Office** | I2O (now IPTO) |
| **PM** | Jonathan Pfautz at Proposers Day ([proposers-day slides](https://www.cs.ucf.edu/~garibay/PDFs/SocialSim_PD_Slides_v10)); Brian Kettler listed as PM on performer award records ([UCF award page](https://www.cs.ucf.edu/~garibay/page_grant_socialsim.html)) |
| **Funding** | "Expected available program funding: $42M" (proposers-day slides) |
| **Performers** | USC ISI + Indiana University (Blythe, Ferrara, Lerman, Menczer, Flammini — [AAMAS 2019](https://www.ifaamas.org/Proceedings/aamas2019/pdfs/p1835.pdf)); University of Central Florida "Deep Agent," PI Ivan Garibay, $6.2M, contract FA8650-18-C-7823, Oct 2017–Dec 2021, with Joshua Epstein, William Rand, Gita Sukthankar ([UCF](https://complexity.cecs.ucf.edu/projects/socialsim/)); University of South Florida (Ng, Mubang, Hall — [Frontiers 2023](https://www.frontiersin.org/journals/big-data/articles/10.3389/fdata.2023.1135191/full)); Leidos (PEGASIS — data provisioning, anonymization, gold-standard ground truth, then challenge-problem scenario development from mid-2019, then T&E + visualization + transition outreach from mid-2020) |

**What was built.** Agent-based and ML simulators of information spread and evolution across GitHub, Twitter, and Reddit, plus a formal T&E technical area (TA3) whose charter was explicitly to "develop rigorous methods and metrics for quantitatively assessing the accuracy and scalability of simulations," issue challenge problems, and "deliver formal evaluation reports on test events."

**What was measured.** Given 30 months of GitHub metadata, predict the next month's activity — roughly **3 million users, 30 million actions, 6 million repositories**, over 10 event types, scored on a dozen-plus metrics (RBO for popularity, RMSE for contributor counts, R² for issue counts) against held-out ground truth ([AAMAS 2019](https://www.ifaamas.org/Proceedings/aamas2019/pdfs/p1835.pdf)).

**Headline result.** Two findings, both awkward:
1. **No method dominated.** "Across a broad array of prediction metrics, no single approach dominated the others." The broadly best performer was the least sophisticated: sampling from a **stationary probability distribution** of each agent's past actions — i.e., "everyone keeps doing what they did."
2. **More data hurt.** "It was detrimental to use all available training data in building the agents. Instead, one month of data proved optimal across most of the agents."

The USF team's five-year retrospective is blunter still: they abandoned the monolithic agent-based approach entirely for a "decompositional" pipeline of per-platform, per-topic time-series regressors (LSTM/XGBoost) plus a cascade model plus user assignment, and that "divide-and-conquer simulation framework showed a significant improvement over our previous solutions" ([Frontiers 2023](https://www.frontiersin.org/journals/big-data/articles/10.3389/fdata.2023.1135191/full)).

**Why it ended.** Scheduled completion, 2022.

**Gap left.** SocialSim measured *fidelity of volume and cascade shape* — how many posts, by whom, in what tree. It never measured a decision-relevant judgment: no probability over an outcome, no Brier score, no calibration curve, no abstention, no baseline-relative skill. It produced the only DoD-funded, at-scale, publicly documented online-behavior challenge corpus and then stopped. Leidos ran "outreach engagements with potential transition partners"; **no transition to a program of record is documented in any source reviewed (UNVERIFIED).**

### A2. INCAS — Influence Campaign Awareness and Sensemaking

| Field | Value |
|---|---|
| **Years** | BAA HR001121S0008 posted 26 Oct 2020; awards announced 2 Sep 2021; program structured as Phase 1 (18 mo) + Phase 2 (18 mo) + Phase 3 (12 mo), final report at 47 months ⇒ ~2021–2025. DARPA page now reads "This program is now complete" ([darpa.mil](https://www.darpa.mil/research/programs/influence-campaign-awareness-and-sensemaking)) |
| **Office** | I2O (now IPTO) |
| **PM** | Brian Kettler, PhD ([Proposers Day deck](https://www.darpa.mil/sites/default/files/attachment/2025-02/program-darpa-incas-presentation.pdf)) |
| **Performers** | **TA1 (influence indicator detection):** SIFT, Protagonist Technology (project DISCOURSE), USC ISI. **TA2 (population response):** University of Illinois Urbana-Champaign (Tarek Abdelzaher, $5.8M — [Illinois](https://siebelschool.illinois.edu/news/abdelzaher-leading-DARPA-effort-understand-how-people-respond-influence-messaging)), USC ISI. **TA3 (campaign modeling, single award):** Uncharted Software. **TA4 (data + testbed, single award):** Lockheed Martin ATL. **TA5 (evaluation, UARC/FFRDC):** University of Maryland ARLIS ([DARPA announcement](https://www.darpa.mil/news/2021/incas-program)) |

**Objective, verbatim.** "Develop analyst-guided techniques and tools to detect and track geopolitical influence campaigns **with quantified confidence**."

**The problem statement is our problem statement.** From the Proposers Day deck: "Analysts have difficulty assessing confidence in analytic conclusions due to varying expertise, experience, and biases"; "Confidence assessment by analysts is ad hoc, manual, subjective, qualitative and susceptible to analyst biases." TA3's charter: "Machine curates, elicits, combines, and surfaces confidence assessment information & evidence **to mitigate biases**," must "handle multiple sources of potential bias/error (e.g.: data, algorithms, analyst)," and must "scale to 100s-1000s of concurrent models, 0.1K-10K elements each."

**What was measured — the exact program metrics (Proposers Day, slide 18):**

| TA | Metric | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|---|
| TA1 | Influence-message classification | F > 0.8 | F > 0.9 | F > 0.9* |
| TA1 | Indicator extraction (agenda / concerns / emotions + 2 more per phase) | avg F > 0.7 | avg F > 0.8 | avg F > 0.8* |
| TA2 | Demographic attribute extraction | all F > 0.85 | all F > 0.9 | all F > 0.9* |
| TA2 | Psychographic attribute extraction | avg F > 0.7 | avg F > 0.75 | avg F > 0.8* |
| TA2 | Indicator↔segment correlation, out-of-sample | acc > 0.7 | acc > 0.8 | acc > 0.8* |
| TA3 | **Effect of tools on analyst sensemaking** | Cohen's d ≥ 0.5 on ≥2 measures | d ≥ 0.8 on ≥3 measures | d ≥ 0.8 on all measures* |
| TA3 | Usability | 0.7 | 0.8 | 0.8* |
| TA4 | Scenarios | 2 historical (e.g. the SocialSim Syria scenario) | 2 ongoing (e.g. China's Belt and Road Initiative) | operational scenario with an operational partner |

(*computed against analyst/SME judgment during Phase 3 operational testing.)

**The single most important thing in the whole archaeology.** INCAS set a goal of "quantified confidence" and then **measured confidence by questionnaire.** TA5's stated T&E objective 2 for TA3 is "Usability of INCAS tools **and calibration, utility, and usability of confidence assessment information**," with the method given as "leverage after-scenario questionnaire (e.g. System Usability Scale – usability.gov)," and the program-metric row reduces to "Utility & usability of confidence assessment information (SME judged)." There is **no Brier score, no reliability diagram, no ECE, no resolution/calibration decomposition, and no abstention rate anywhere in the INCAS metric table.** The program that made "quantified confidence" its objective never quantified whether the confidence was right.

**Why it ended.** Scheduled 48-month completion.

**Gap left.** (a) Confidence was asserted and surveyed, never scored. (b) The unit of output was a *campaign model* (a link structure), not a *resolvable forecast*, so there is nothing to be right or wrong about. (c) No abstention: INCAS has no notion of "the evidence does not support an answer." (d) No published Phase 3 capstone results, and no named transition partner or program of record in any public source (**UNVERIFIED**). (e) All research was unclassified and demonstrated on publicly available data on non-US populations — so the classified-data integration the CIA solicitation asks for was explicitly out of scope.

### A3. AIDA — Active Interpretation of Disparate Alternatives

**Years** ~2017–2023 (TAC SM-KBP evaluations: Phase 1 Jun–Aug 2019; Phase 2 Aug 2020–Jan 2021; Phase 3 Jan 2022–Jan 2023, [NIST TAC](https://tac.nist.gov/2022/KBP/SM-KBP/)). **Office** I2O.

**What was built.** "A multi-hypothesis semantic engine that generates explicit **alternative interpretations** of events, situations, and trends… for use in noisy, conflicting, and **potentially deceptive** information environments," which "must establish confidence measures for the derived knowledge and hypotheses" ([darpa.mil](https://www.darpa.mil/research/programs/active-interpretation-of-disparate-alternatives)). Three tasks: extract knowledge elements per document (Task 1), aggregate into a cross-document KB without access to source documents (Task 2), **generate semantically coherent alternative hypotheses** (Task 3). Corpora were English/Spanish/Russian/Ukrainian, ~90K documents in the pilot.

**Headline result and the fatal caveat.** AIDA is the direct architectural ancestor of a multi-hypothesis engine with confidence — and its own performers state the limit plainly. From PNNL's TAC system report: "**Any hypotheses algorithmically derived from this data were not judged for their correctness. Our claims of coherence are also derived algorithmically rather than by which are actually correct or incorrect**" ([TAC 2018 HyperThesis](https://tac.nist.gov/publications/2018/participant.papers/TAC2018.Hyperthesis.proceedings.pdf)). Hypotheses were scored for **internal coherence against gold-standard annotation**, not for **truth against outcomes**.

**Gap left.** DARPA built the mutually-alternative-hypotheses machinery and the confidence plumbing, and never once scored a hypothesis set against what actually happened. That is precisely the seam our outcome-band framing and Brier-skill metrics fill.

### A4. Understanding Group Biases (UGB), Habitus, KAIROS — the adjacent human-terrain line

- **UGB** — DSO "Disruptioneering" Special Notice DARPA-SN-18-02, March 2018; complete ([darpa.mil](https://www.darpa.mil/research/programs/understanding-group-biases)). Goal: "radically enhance the scale, speed, and scope of automated, ethnographic-like methods for capturing group biases and cultural models," by "turning a common bug of machine-learning (a tendency to pick up non-obvious and implicit biases from the datasets on which it is trained) into a useful feature." Performers included University of Pittsburgh (Yu-Ru Lin, Rebecca Hwa — TRIBAL, [Pitt momacs](https://www.momacs.pitt.edu/process/tribal-a-tripartite-model-for-group-bias-analytics/)), Gallup ([GallupGovt/ugb](https://github.com/GallupGovt/ugb)), Ohio State. **No quantitative program outcome published (UNVERIFIED).**
- **Habitus** — DSO, BAA ~Feb 2020, 42 months, 3 phases, 2 TAs (model development; engagement); now complete ([darpa.mil](https://www.darpa.mil/research/programs/habitus)). Goal: "capture and make local knowledge available to military operators, providing them with an insider view," building "predictive, causal models of local systems based on input from locals," generalizable across regions, adaptive, self-sustaining. Known performer: Raytheon BBN prime, Kairos Research subcontract (Amy Summerville) ([Kairos Research](https://kairosresearch.com/2021/03/kairos-research-wins-subcontract-to-support-darpas-habitus-program/)). **No public outcome metrics (UNVERIFIED).**
- **KAIROS** — I2O, Proposers Day 9 Jan 2019, now complete ([darpa.mil](https://www.darpa.mil/research/programs/knowledge-directed-artificial-intelligence-reasoning-over-schemas)). Schema induction from big data, then schema-driven complex-event discovery over multimedia/multilingual input. NIST built the KAIROS Evaluation Software Suite ([data.gov](https://catalog.data.gov/dataset/kairos-evaluation-software)); DOT&E tracked it ([dote.osd.mil](https://www.dote.osd.mil/News/What-DOT-Es-Following/Following-Display/Article/3025086/kairos-knowledge-directed-artificial-intelligence-reasoning-over-schemas/)). Performers included RPI Tetherless World, UPenn Cognitive Computation Group, Stony Brook ($4.2M, Balasubramanian/Nguyen, with UT Austin, UMBC, USNA); produced CHRONOS, a schema-based event prediction system ([AAAI 2024](https://ojs.aaai.org/index.php/AAAI/article/view/30323/32342)). **Gap:** events were scored against annotation, not against the future.

---

## PART B — The social-simulation and causal-modeling lineage

### B1. Ground Truth — the most important negative result in the portfolio

| Field | Value |
|---|---|
| **Years** | Announced 7 Apr 2017; three challenge phases; results published 2021–2022; complete ([darpa.mil](https://www.darpa.mil/research/programs/ground-truth)) |
| **Office** | Defense Sciences Office |
| **PM** | Adam Russell ([DARPA 2017](https://www.darpa.mil/news/2017/social-science-modeling)) |
| **Performers** | **TA1 (4 simulation worlds):** Urban Life (Züfle et al.), Financial Governance (Rager et al.), Disaster (Parunak 2022), Geopolitical Conflict (Pynadath et al.). **TA2 (research teams):** University of Chicago, JHU/APL, WSRI. **Reproducibility analysis:** PNNL (Volkova). **T&E:** Sandia National Laboratories (Naugle et al.) |

**What was built.** Four synthetic social worlds with **known, hidden causal ground truth**. Research teams had to (1) *explain* — recover the causal graph; (2) *predict* — answer forward questions; (3) *prescribe* — recommend policies that produce desired outcomes. Firewalled TA1/TA2. Russell's framing: "We call it forensic social science."

**What was measured.** Node and edge precision/recall/F1 against the true causal graph; predict/prescribe **robustness** = fraction of answers falling in acceptable ranges ([Springer, Naugle et al. 2022](https://link.springer.com/article/10.1007/s10588-021-09349-6)).

**Headline results — three of them, all uncomfortable:**

1. **Causality was not recoverable.** Node scores were "generally high precision… lower recall"; edge scores were "**much lower than node scores… Causality is tough to infer**" ([Sandia program-results deck, OSTI 1812594](https://www.osti.gov/servlets/purl/1812594)).
2. **Causal understanding did not buy prediction.** "None of the factors associated with causal understanding were significantly correlated with predict or prescribe performance in the pairwise analyses… causal understanding factors explain[ed] just **1% of the variance in the predict performance metric and 9% in the prescribe** metric." Two candidate reasons given: teams ignored their own causal findings when predicting, or they never recovered enough causal structure to help.
3. **More data did not help.** Data-collection factors "showed no significant relationships with performance," and simulation complexity had "some significant **positive** correlations with performance — counter to our hypothesis."

The University of Chicago team's own paper is the most quotable artifact in the entire archaeology: the program "reveals the limits of contemporary quantitative social science methodology," naming (i) no shared ontology, (ii) data labels biasing analysts away from the true generating process, (iii) publication norms rewarding novel causes over important ones, and (iv) "most singular quantitative methods applied on their own did not help to solve most analytical challenges." Their one positive: "**even imperfect knowledge can be sufficient to identify robust prediction if a more pluralistic approach is applied**. Applying competing approaches by distinct subteams… enabled discovery of many aspects of the relevant structure underlying worlds that singular methods could not" ([PMC9713146](https://pmc.ncbi.nlm.nih.gov/articles/PMC9713146/)). PNNL's independent replication of the causal-discovery methods found the SOTA models "are not designed to take advantage from vast amounts of data… do not generalize well across simulation scenarios and are not robust to sampling… the results are hard to reproduce" ([OSTI 1969000](https://www.osti.gov/biblio/1969000)).

**Why it ended.** Scheduled completion. Sandia's own recommendation for future work was a **more controlled** version — simulations progressing from very simple to complex, all teams applying the same methods to the same data — and, separately, a study of whether performance on a simulation test bed transfers to the real world, which was "out of scope for the initial program."

**Gap left — and it is enormous.** DARPA built and validated the *instrument* (a synthetic world where ground truth exists because you made it) and then put it down. It never became a standing evaluation harness for analytic tooling. It also proved, on DARPA's own dime, that (a) ensembles of divergent approaches beat any single method, and (b) causal-graph recovery is a dead end as a route to prediction. Both are load-bearing arguments *for* our architecture — divergent hypothesis fan-out scored on outcomes, not causal-graph fidelity.

### B2. World Modelers

**Years** ~2017/2018–2021 (Charles River four-year contract awarded Mar 2018; AGU program talk Dec 2021); complete ([darpa.mil](https://www.darpa.mil/research/programs/world-modelers)). **PM** Joshua Elliott.

**Performers and stack** ([worldmodelers.com](https://worldmodelers.com/)): Uncharted Software (Causemos, the analyst HMI); TwoSix Labs (DART document pipeline); three machine readers — Eidos (Arizona), Hume (Raytheon BBN), Sofia (CMU); INDRA assembly (Harvard Medical School); three qualitative inference engines — DySE (Pittsburgh), Delphi (Arizona), Sensei (Jataware); Dojo (Jataware) for quantitative model registration; Charles River Analytics SAUCE, $4.4M ([CRA](https://cra.com/sauce-and-security-charles-river-analytics-awarded-contract-to-model-domestic-and-global-issues-such-as-food-insecurity/)); American Institutes for Research built 13 East African models ([AIR](https://www.air.org/project/darpa-world-modelers)); Columbia; CSIRO.

**Goal, verbatim.** Integrate "dozens of contributing models connected by thousands of pathways — orders of magnitude beyond what is possible today," delivering "clearly parameterized, quantitative projections within weeks or even hours," at **subnational scale, 1–5 years out**. First use case: food insecurity in South Sudan / Ethiopia.

**What was measured.** **Nothing scored, publicly.** No forecast accuracy, calibration, or skill metric for World Modelers appears in any source reviewed (**UNVERIFIED**). Outputs were capability demonstrations and use-case analyses.

**Why it ended / what transitioned.** Completed; some crop, market-price, conflict and accessibility models are "actively utilized by USAID in work relating to Food Security Third Party Monitoring," and CSIRO open-sourced the coupling platform ([CSIRO](https://www.csiro.au/en/work-with-us/industries/agriculture/Securing-Our-Agrifood-Systems/Understanding-and-navigating-global-change-in-our-food-systems/Linking-agriculture-household-and-transport-modelling-for-national-Food-Security)).

**Gap left.** The most complete "assemble causal models from literature and run scenarios" system DoD ever funded, with **zero forecast scoring, zero calibration, and zero abstention**. It answers "what could happen and through what pathway"; it never answers "how often is this system right, and how confident should you be."

### B3. Causal Exploration of Complex Operational Environments

I2O, ~2016–2020, complete ([darpa.mil](https://www.darpa.mil/research/programs/causal-exploration)). Prime performer BAE Systems, $4.2M, building CONTEXTS — Causal Modeling for Knowledge Transfer, Exploration, and Temporal Simulation ([BAE](https://www.baesystems.com/en-us/article/bae-systems-to-develop-first-of-its-kind-software-for-darpa-to-model-conflicts)). Focus: hybrid/irregular conflicts "dominated by complex human dynamics with intertwining political, territorial, economic, ethnic, and/or religious tensions." The program page contains the most useful sentence for our positioning: existing modeling tools "are not generally suitable for use directly by operational planners as they require expert modelers to assemble, configure, run, and interpret the outputs." **No published evaluation results (UNVERIFIED).**

### B4. CASCADE — and the one transition that worked

DSO, ~2015–2019/20, complete ([darpa.mil](https://www.darpa.mil/research/programs/complex-adaptive-system-composition-and-design-environment)). PM John Paschkewitz. Mathematical foundations (sheaf theory and related) for composing system-of-systems with "a unified view of system behavior" and "a formal language for complex adaptive system composition and design." **Headline outcome:** CASCADE's foundational technology became the EMSO and logistics "wizards" inside **PROTEUS**, which transitioned to the Marine Corps Warfighting Laboratory in June 2021 and fed Marine Corps Force Design 2030 ([darpa.mil](https://www.darpa.mil/news/2021/proteus-transitions)). **Lesson:** in this portfolio, the things that transitioned were *composable planning tools embedded in an existing user's workflow*, not analytic engines.

### B5. ASKE / ASKEM — Automating Scientific Knowledge Extraction (and Modeling)

- **ASKE** was DARPA's *first* AI Exploration opportunity, August 2018, PM Joshua Elliott. **Measured headline:** "The ASKE AIE demonstrated a **50x speedup**, extending an existing epidemiology model with additional dimensions and states when compared to state-of-the-art manual processes… it also showed that a new computational model in a different domain could be created **8x faster**" ([darpa.mil](https://www.darpa.mil/news/2021/leveraging-ai-accelerate-models)).
- **ASKEM** followed: 42 months, two 21-month phases, performers selected Sept 2022, four technical areas, use cases in viral epidemics and space weather, delivering the TERArium modeling workbench ([darpa.mil](https://www.darpa.mil/news/2022/models-simulations), [DARPA-ASKEM/terarium](https://github.com/DARPA-ASKEM/TERArium)). Explicit design goal: "**traceability across knowledge sources, model assumptions, and model fitness**."

**Gap left.** ASKE/ASKEM is the strongest DARPA precedent for *speed-of-analysis* metrics (50x, 8x) — the exact benefit category (b)/(d) language in the CIA solicitation. It measures model-building throughput, never judgment quality.

---

## PART C — The wargaming / adversary-decision lineage

### C1. COMPASS — the gray-zone hypothesis engine

**Years** kicked off ~early 2019 ("We kicked the program off less than a year ago," Mar 2020); complete ([darpa.mil](https://www.darpa.mil/research/programs/collection-and-monitoring-via-planning-for-active-situational-scenarios)). **Office** STO. **PM** Fotis Barlos. **Performers** (three competing prototypes) Raytheon BBN Technologies, Systems & Technology Research, Lockheed Martin ATL; the SMA technical report also lists Sandia, Northrop Grumman, Uncharted Software, SIFT, CMU, Avata Intelligence, Hazardous Software, Strategic Analysis Enterprises, AECOM ([OSTI 1592839](https://www.osti.gov/biblio/1592839)).

**What was built.** "COMPASS tries to put all the incoming data into what we call 'lines of effort' and then **automatically generates multiple hypotheses**… 'Based on what I'm seeing, I believe these activities are part of a sequence, an adversarial competition campaign' — and provides that information in a graphical form for the human to evaluate. **Regardless of the sophistication of the underlying algorithms, there will always be some uncertainty about the hypotheses an AI system can produce. This is an area that COMPASS addresses directly**" — Barlos ([darpa.mil](https://www.darpa.mil/news/2020/competition-tool-demonstration)).

**What was measured — and this is a good design.** December 2019, U.S. Indo-Pacific Command HQ, three days. Analysts and operators were given "the equivalent of 10 days' worth of events from four major actors in the Indo-Pacific area of responsibility — a nation state, a terrorist actor, a background actor, and a proxy actor for the nation state." Task: identify each actor's lines of effort **as early as possible** in the simulated 10 days. **Metric: days-to-correct-identification, fewer is better.** That is a real, decision-relevant, time-to-insight metric on a synthetic scenario with known ground truth.

**Headline result.** **Not published.** No days-to-identification numbers, no comparison across the three prototypes, appear in any public source (**UNVERIFIED**).

**Why it ended / gap left.** Program complete; no transition of record documented. COMPASS proves the CIA-relevant evaluation design exists and was run at a COCOM — and that DARPA never published the number. The gap: multi-hypothesis generation over gray-zone activity, with uncertainty acknowledged but never calibrated, and no abstention output.

### C2. SI3-CMD — Serial Interactions in Imperfect Information Games

DARPA-SN-18-80, Sept 2018, AIE-style; complete ([darpa.mil](https://www.darpa.mil/research/programs/serial-interactions-in-imperfect-information-games-applied-to-complex-military-decision-making)). Extends poker-derived game theory to settings with "multiple interacting agents, extremely large search spaces, sequential revelation of information, **use of deception**, continuous resource quantities, stochastic outcomes." Performers included HRL Laboratories ([HRL](https://www.hrl.com/news/2019/03/11/wargaming-at-the-next-level)) and Boeing; **full performer list UNVERIFIED**. Program deliverable was "new techniques and assessments of their effectiveness for military uses"; **no public assessment results (UNVERIFIED)**. Gap: equilibrium-solving in adversarial games ≠ probabilistic forecasting of a socio-political outcome.

### C3. Gamebreaker

STO AI Exploration, kickoff 5 May 2020, PM Lt Col Dan "Animal" Javorsek; contract scale ~$1M ([Breaking Defense](https://breakingdefense.com/2020/08/darpa-wants-wargame-ai-to-never-fight-fair/)). **Nine teams**, each breaking two games to test generalization: Aurora Flight Sciences+MIT (StarCraft II, Google Research Football); BAE+UCSB+AIMdyn (StarCraft II, AFRL Strategem Wargame); Blue Wave AI Labs (SpringRTS:1944, OpenRA); EpiSci (miniRTS, StarCraft II); Heron Systems (DeepRTS, StarCraft II); Lockheed+Cycorp; Northrop+Hazardous+Matrix Games (Command: Modern Operations, TORCS); Purdue (microRTS, StarCraft II); Radiance+BreakAway (FreeCiv, Zero-K) ([darpa.mil](https://www.darpa.mil/news/2020/gamebreaker-ai)).

**Measured:** a "game balance state equation" — quantitative balance modeling, then search for destabilizing modifications. **Program-level results were never published (UNVERIFIED).** One performer self-reports: Blue Wave AI Labs claims "top 3 in 4 categories," ANNs predicting outcomes at "97% accuracy," and successful transfer from one RTS game to a different one via transfer learning ([Blue Wave](https://bluewaveailabs.com/darpa-gamebreaker/)) — vendor self-report, not DARPA evaluation.

### C4. SCEPTER — Strategic Chaos Engine for Planning, Tactics, Experimentation and Resiliency

**Years** BAA HR001122S0013 released Jan 2022; ~$39M over three years; Phase 1 18 months, **Phase 2 classified**; Phase 2 awards Dec 2024 ([militaryaerospace](https://www.militaryaerospace.com/computers/article/14223907/battle-planning-complex-military-engagements-machine-speed)). **Office** STO. **PM** Aaron Kofford (2023). **Performers, three divergent approaches** ([Breaking Defense](https://breakingdefense.com/2023/09/three-ways-darpa-aims-to-tame-strategic-chaos-with-ai/)): Charles River Analytics + Data Machines — MERLINS-STAFF neuro-symbolic ($4M Phase 1 → **$9.9M Phase 2**); Parallax Advanced Research — SCAMP causal-network simulator, Van Parunak ($4.4M); BAE Systems — "tailorable abstraction," simulating the simulations, Marco Pravia.

**Measured / claimed.** DARPA's program page states SCEPTER "is able to achieve scenario exploration speeds of **10k–100k times faster than real-time in scenarios with up to 10,000 agents**" ([darpa.mil](https://www.darpa.mil/research/programs/scepter-strategic-chaos)). Charles River's Phase 1: games "greater than 1 day" in duration, "reducing training time by **1000x**," more complex entity control, human-understandable plans ([CRA](https://cra.com/charles-river-analytics-awarded-9-9m-darpa-contract-to-develop-trusted-ai-approach-for-complex-operations-planning/)). Evaluation method per the PM: "We're having [military] planning experts look at the outputs and say, 'actually, that was kind of useful' — or not… Ultimately, it's going to be up to planners to let us know if we're wasting time or helping them."

**Gap left.** SCEPTER's quality metric is **expert preference**, same failure class as INCAS's questionnaire. It produces COAs, not calibrated probabilities. Phase 2 is classified, so no public results will appear.

### C5. ACK — Adapting Cross-Domain Kill-Webs

STO, complete ([darpa.mil](https://www.darpa.mil/research/programs/adapting-cross-domain-kill-webs)). BAE FAST Labs with CMU and **Uncharted Software** built MARS (Multi-domain Adaptive Request Service); Phase 2 contract $6.5M; participated in the ABMS on-ramp of 31 Aug–4 Sep 2020 with live aircraft, ships, and air-defense batteries. Architecture is an e-commerce-derived "Capability Marketplace" with a "Virtual Liaison" abstraction — notably designed so suppliers "offer assets across domains in terms of the effects they can provide, **without exposing details regarding how those effects will be achieved (i.e. without revealing sources and methods)**." Transition status ambiguous; commentary notes tools like ACK "participated in ABMS on-ramps [but] it is not clear whether they will be folded into the ABMS portfolio" ([Air & Space Forces Magazine](https://www.airandspaceforces.com/article/accelerating-the-air-forces-ability-to-adapt-and-win/)). **Relevance to us:** the sources-and-methods-preserving abstraction pattern is directly reusable for classified-provenance handling.

### C6. DISCORD (2026) — the live competitor in this lane

**Solicitation DARPA-PS-26-27**, published 15 May 2026, proposals due 9 July 2026; **24 months, two 12-month phases, multiple performers**; STO; PM **Eric Davis** ([darpa.mil](https://www.darpa.mil/research/programs/discord), [SAM.gov](https://sam.gov/workspace/contract/opp/bb49a69d727e45f891005ac34cb3d310/view)). Implements **Ender's Foundry**, a Department of War **Pace-Setting Project** whose intent is "to accelerate AI-enabled simulation capabilities to ensure we stay ahead of AI-enabled adversaries."

Three features of DISCORD matter enormously for positioning:
1. **Diversity as the objective.** "By discovering a wide range of superior and **genuinely diverse** strategies, rather than just a single optimized solution, the engine will help create true strategic flexibility." This is our ensemble-diversity metric, stated as a program goal, in 2026.
2. **Explainability as a trust mechanism.** "DISCORD is designed to produce **explainable outcomes that human operators and commanders can validate**, fostering trust in AI-driven decision support."
3. **Anti-predictability framing.** Diversity is justified because it lets commanders act "in ways that adversaries **cannot poison, stymie, or accurately predict**."

DISCORD is tactical/kinetic and sensor-fed, not socio-political — but it establishes that DARPA is currently buying *diverse-strategy generation with validatable explanations*, and it is the most direct 2026 adjacency to our fan-out architecture.

---

## PART D — The calibration, confidence, and abstention lineage (closest prior art to our calibration story)

### D1. SCORE — the definitive negative result on machine confidence scoring

| Field | Value |
|---|---|
| **Years** | 2019 – 2026 (results published in *Nature*, 2 April 2026) ([COS](https://www.cos.io/score)) |
| **Office** | Defense Sciences Office |
| **PM** | Not confirmed in sources reviewed — **UNVERIFIED** |
| **Scale** | **865 researchers**; claims sampled from **3,900 papers**, 2009–2018, across **62 journals** in criminology, economics, education, finance, health, management, marketing, organizational behavior, psychology, political science, public administration, sociology |
| **Teams** | Center for Open Science (sampling, replications, reproductions); **repliCATS** (Univ. Melbourne) and **Replication Markets** (human forecasting); **Penn State (Rajtmajer), TwoSix Technologies, USC** (machine/algorithmic prediction); **Metascience Lab, Eötvös Loránd Univ.** (robustness) |

**Stated goal, verbatim.** "Develop and deploy **automated tools to assign 'confidence scores'** to different SBS research results and claims… These tools will assign **explainable confidence scores with a reliability that is equal to, or better than, the best current human expert methods**" ([darpa.mil](https://www.darpa.mil/research/programs/systematizing-confidence-in-open-research-and-evidence)).

**Headline results (all from [COS](https://www.cos.io/about/news/large-scale-collaboration-releases-new-findings-on-research-credibility), [Nature/Miske et al. 2026](https://suchow.io/assets/docs/miske2026reproducibility.pdf), [EurekAlert](https://sciencesources.eurekalert.org/news-releases/1121267)):**

- **Transparency:** data available for only **24%** of 600 sampled papers.
- **Reproducibility** (same data, same analysis, n=143): **74%** at least approximately reproduced, **54%** precisely. When both original data *and* code were shared: 91% / 77%. When the dataset had to be reconstructed from public sources: **38% / 11%**.
- **Robustness** (same data, ≥5 independent analysts, n=100 papers): only **34%** of reanalyses landed within ±0.05 Cohen's d of the original; **57%** within 4× that tolerance. **74%** reached the same qualitative conclusion; **24%** null/inconclusive; **2%** the *opposite* effect.
- **Replicability** (new data, n=164): **49%** replicated by the standard criterion; replication effect sizes **r = 0.10 vs. original r = 0.25** — median reduction >50% in effect size and >80% in explained variance.
- **Humans could forecast replication.** repliCATS and Replication Markets achieved **76% and 78%** success by their best-performing metric.
- **Machines could not.** "**None of the three [machine] methods** — Synthetic Markets, MACROSCORE, and A+ — **were consistently effective at predicting which claims would replicate successfully or not, suggesting some caution for earlier evidence of successful use of machine methods for such assessments**" (Rajtmajer and 39 co-authors).
- **Credibility is not one number.** "The three measures of repeatability… were only **modestly correlated with one another**, and their relationships with expert or machine predictions were similarly modest."

**Why it ended.** Completed on schedule; outputs published 2026.

**Gap left — and it is the most exploitable one in the entire archaeology.** DARPA spent seven years and 865 researchers explicitly trying to build automated confidence scoring that beats human experts, and **it did not work**. The failure was published four months ago, in *Nature*, with all data, code, and materials open on OSF. That means: (a) the "machines can score confidence" claim is now *disproven prior art* that any credible proposal must address head-on; (b) there exists a freshly released, publicly available, ground-truth-labeled benchmark of thousands of claims with known replication outcomes — a ready-made **historical_backtest** corpus for an abstention-and-calibration system; and (c) the specific thing machines failed at was **point-scoring a claim's credibility**, which is precisely the collapse our architecture refuses to make (likelihood and confidence as separate fields, weakest-link aggregation, abstention as a first-class verdict).

### D2. ITM — In the Moment

| Field | Value |
|---|---|
| **Years** | Announced 3 Mar 2022; performers announced 6 Jun 2023; 3.5 years — Phase 1 = 24 months (small-unit triage), Phase 2 = 18 months (mass casualty), optional Phase 3 for transition maturation. **Phase 2 began April 2025 and is ongoing** ([darpa.mil](https://www.darpa.mil/news/2022/algorithms-human-experts), [Kitware](https://www.kitware.com/ethical-explainable-ai-in-action-darpa-itm-phase-1-contributions/)) |
| **Office** | I2O → IPTO |
| **PM** | Matt Turek at launch; **Patrick Shafto** listed on the current program page ([darpa.mil](https://www.darpa.mil/research/programs/in-the-moment)) |
| **Performers** | **TA1 decision-maker characterization:** Raytheon BBN Technologies, Soar Technology. **TA2 aligned algorithmic decision-makers:** **Kitware** (contract FA8650-23-C-7316) and **Parallax Advanced Research** ($4.067M, "TAD," with Drexel University and Knexus Research). **TA3 evaluation:** **CACI International** (API endpoint `darpaitm.caci.com`). **TA4:** policy/legal/moral/ethical integration, DevEthOps ([darpa.mil](https://www.darpa.mil/news/2023/trustworthy-ai)) |

**Core premise, verbatim.** ITM "seeks to quantify the alignment of algorithms with trusted human decision-makers in **difficult domains where there is no agreed upon right answer**," focusing on "human attributes and characteristics (e.g., **risk tolerance**, rule following, or other personality characteristics; subject matter expertise; and human values)" rather than technical performance ([Turek, *Disaster Medicine and Public Health Preparedness*](https://www.cambridge.org/core/journals/disaster-medicine-and-public-health-preparedness/article/darpas-in-the-moment-itm-program-humanaligned-algorithms-for-making-difficult-battlefield-triage-decisions/AAA61F6CF25EE7AE85CA8292790B9B9A)).

**What was measured — precisely.** Scenarios are annotated with **Key Decision-Making Attributes (KDMAs)**, each answer choice carrying a ground-truth KDMA value 0–100 (e.g., "ingroup bias = 100" for treating your own soldier, "= 10" for treating the adversary). The metric is:

> **Alignment Score = 1 − (Average_ADM_KDMA_Value − Target_KDMA_Value)**

1 = perfect alignment, 0 = misalignment ([Kitware LLM-regression paper](https://www.kitware.com/main/wp-content/uploads/2025/08/LLMRegressionFine-grainedAlignedDecision-MakingMedicalTriage.pdf), code at [github.com/ITM-Kitware/align-system](https://github.com/ITM-Kitware/align-system)). The *trust* metric is separate: blinded triage professionals are shown decisions from an aligned algorithm, a baseline algorithm, and a human control, and asked **which decision-maker they would delegate to**.

**Headline results.**
- Kitware's aligned ADM "scores better than the baseline on most KDMA targets, providing a **31% overall average alignment score improvement**."
- Kitware, Phase 1: "AI successfully aligned with human decision-makers across multiple KDMAs, outperforming baseline models and achieving higher trust ratings," with **60 ITM-related publications** including 9 at ACL and 5 at ICML in 2025.
- Parallax: TAD "successfully demonstrated… in human-subject experiments, **meeting or exceeding all DARPA metrics for success**" ([Parallax](https://parallaxresearch.org/news/blog/moment-itm-milestone-new-era-human-ai-interaction)).
- **Phase 2 target:** raise delegation preference for aligned decision-makers from **60% → 85%**, extend to the **cyber security** domain (confidentiality/integrity/availability trade-offs), and handle **multiple, potentially conflicting KDMAs simultaneously**.

**Why it hasn't ended.** Active. Phase 2 runs from April 2025.

**Gap left — the sharpest distinction we can draw.** ITM is the closest thing DARPA has to our calibration story, and it measures a fundamentally different quantity. ITM's premise is that **there is no right answer**, so it measures *alignment to a chosen human's attribute profile* and *willingness to delegate*. It therefore has:
- **No accuracy metric.** Nothing in ITM asks whether a decision was correct, because correctness is definitionally excluded.
- **No calibration.** Alignment score is a distance to a target attribute value, not a probability that was right or wrong. There is no reliability diagram in ITM.
- **No abstention.** There is no "the evidence is insufficient" output. ITM's success metric moves *toward* more delegation (60%→85%), i.e., toward the machine deciding more often — the opposite direction from a first-class INSUFFICIENT_EVIDENCE verdict.
- **Two knobs we already share.** ITM's named example attributes are "**risk tolerance**, rule following" — nearly identical to our actor profile's `riskTolerance` and `escalationPropensity`. That is a citable pedigree, not a conflict: DARPA already validated that *encoding decision-maker attributes as tunable parameters* raises trust and delegation. We extend it from "align to a person" to "sweep the profile space to generate divergent hypotheses."

### D3. AIQ — Artificial Intelligence Quantified

| Field | Value |
|---|---|
| **Years** | BAA HR001124S0029, May 2024; Proposers Day 14 Jun 2024; abstracts 25 Jun, proposals 13 Aug 2024; **two 18-month phases**; active ([darpa.mil](https://www.darpa.mil/research/programs/aiq-artificial-intelligence-quantified), [militaryaerospace](https://www.militaryaerospace.com/computers/article/55076924/artificial-intelligence-ai-guarantee-performance-and-accuracy)) |
| **Office** | I2O → IPTO |
| **PM** | **Patrick Shafto** (also ITM's current PM) |
| **Partners** | **NIST** and the Department of War |
| **Performers** | TA1: multiple theory teams (spectral / scaling-limit / kernel-embedding approaches). **TA2 (T&E): Kitware, $3.7M**, building **MAGNET** — Mathematical Assurance of Generative AI Network Evaluation Toolkit ([Kitware](https://www.kitware.com/guaranteeing-foundation-models-for-high-stakes-settings-darpas-aiq-program/), [NeurIPS 2025 workshop paper](https://openreview.net/pdf?id=ZypC0qCMhT), [github.com/AIQ-Kitware/aiq-magnet](https://github.com/AIQ-Kitware/aiq-magnet)) |

**Core hypothesis, verbatim.** "Mathematical foundations, combined with advances in measurement and modeling, will guarantee an AI system's capabilities, **when they will or will not manifest, and why** in a quantified way."

**The framing DARPA uses to condemn benchmarks.** "Current AI evaluation focuses on **giving AI systems quizzes like we would give to a person. However, there is no reason to believe that the answers would be the same even for simple rewordings of the same question**, never mind real-world applications. That is, we want guarantees about generalization, and math is required for that."

**Structure.** Three nested capability levels — *specific problems* (correct answer on one input/output pair), *classes and compositions of problems* (does success on one reasoning step imply success on multi-step compositions), *natural classes* (families of problems implicitly supported by an architecture). Evaluation domains: training-time dynamics, text generation, text-to-image. **MAGNET's core abstraction is the "evaluation card"** — a structured encoding of a theoretical claim with its assumptions, guarantees, datasets, model families, metrics, and constraints, "serving as a **'contract' between developers and evaluators**," executed reproducibly to verify or falsify the claim.

**Headline result.** Too early. AIQ is mid-flight; no capability guarantee has been published.

**Gap left.** AIQ quantifies **a model's** generalization. It says nothing about **a pipeline's** forecast calibration on real-world questions, nothing about abstention, and nothing about socio-political judgment. But two AIQ artifacts are directly appropriable: (i) the **evaluation card as a machine-checkable contract** is a near-exact analogue of our required evaluation-regime tag and per-claim provenance record; (ii) the AIQ framing gives us the argument for why our metrics package must not be a benchmark score — "rewordings of the same question" is precisely why our inter-run stability and Krippendorff-alpha metrics exist.

### D4. SciFy — Scientific Feasibility

**Years** BAA HR001124S0013 (2024); **32 months, one phase, three technical sprints** in materials science → AI → quantum computing, "a progression in scientific complexity"; active ([darpa.mil](https://www.darpa.mil/research/programs/scientific-feasibility)). **Office** IPTO. **PM** the program page lists **Victoria Romero**; *Scientific American* quotes **Erica Briscoe** as SciFy PM ([Scientific American](https://www.scientificamerican.com/article/darpa-built-an-ai-to-fact-check-enemy-weapons-claims/)) — both are reported; which is current is **UNVERIFIED**. **Performers** include a UMBC-led team, **$3.8M**, with Stony Brook, UT Austin, and Cambridge ([UMBC](https://www.csee.umbc.edu/news-events/recent-news/post/148715/)); GTRI also participates.

**Method, verbatim.** "Demonstrate that the scientific feasibility of claims can be determined by **using automated reasoning to decompose claims into constituent, verifiable parts**," then assess each component against "existing technological advancements, foundational scientific principles, data, software, simulation results, and current industry standards or benchmarks," and finally "determine whether the claimed technological capability, **while theoretically possible in parts, is practical and realistic when considered as a whole**."

**Why it matters to us.** SciFy is the only active DARPA program whose core mechanic is *decompose a claim → verify each part against evidence → aggregate to a feasibility judgment*. That is structurally our provenance-and-falsifier layer. The domain is different (adversary technical capability claims, not geopolitical outcomes), and — critically — SciFy has **no published calibration or abstention metric**; its aggregation of part-level judgments into a whole-claim verdict is exactly the place where weakest-link vs. mean aggregation matters and where nothing public says which SciFy uses.

### D5. XAI — Explainable AI, and what it proved about analyst-facing explanation

2017–2021, four years, PM David Gunning (with Matt Turek); retrospective published in *Applied AI Letters* ([Wiley](https://onlinelibrary.wiley.com/doi/full/10.1002/ail2.61)). Evaluation team led by NRL (Eric Vorm) built an Explanation Scoring System. Scale: **~12,700 user-study participants** (~1,900 supervised, ~10,800 unsupervised). Artifacts collected at [xaitk.org](https://xaitk.org/).

**Lessons that constrain our product design directly:**
- "**Explanations are more helpful when an AI is incorrect and are particularly valuable for edge cases**" (UCLA, Rutgers).
- "**User cognitive load to interpret explanations can hinder user performance**… explanations and task difficulty need to be calibrated" (UCLA, Oregon State).
- "In order for explanations to improve user task performance, **the task must be difficult enough** that the AI explanation helps" (PARC, UT Dallas).
- "**Advisability** — the ability for an AI system to take advice from a user — **improves user trust beyond explanations**" (UC Berkeley).
- From a performer retrospective: "**human subjects conjure fantastically wrong mental models for AIs, and these models are often hard to break**"; and "many seemingly high performing RL agents are extremely brittle and are not amenable to explanation" ([arXiv 2106.05506](https://ar5iv.labs.arxiv.org/html/2106.05506)).
- A NeurIPS 2021 study from the same lineage found the benefit is **not universal**: novices gained from explanation but suffered cognitive overhead, while **expert performance significantly degraded** with explainability support ([NeurIPS 2021](https://proceedings.neurips.cc/paper_files/paper/2021/file/05d74c48b5b30514d8e9bd60320fc8f6-Paper.pdf)).

**Implication for us.** Provenance-on-every-claim is defensible only if it is *selective*. XAI's measured result is that undifferentiated explanation degrades expert performance. Our "unsupported assertions are counted and reported as a metric" design — rather than every claim carrying visible apparatus — is the XAI-compliant choice, and we can cite XAI for why.

### D6. ASIST — Artificial Social Intelligence for Successful Teams

I2O, complete ([darpa.mil](https://www.darpa.mil/research/programs/artificial-social-intelligence-for-successful-teams)). Machine theory-of-mind and shared mental models for AI teammates, evaluated in customizable open-world testbeds with standardized sensing and communication channels. Relevant as the "machine models the human" complement to ITM's "machine aligns to the human," and as further evidence that DARPA's human-machine investment is about *teaming*, not *accuracy*.

---

## PART E — The 2023–2026 landscape (what DARPA is buying right now)

| Program | Status | What it is | Why it matters here |
|---|---|---|---|
| **AI Forward** | 2023 initiative, complete | Two workshops (virtual June, Boston 31 Jul–2 Aug 2023), ~200 participants, ~800 raw ideas narrowed to 35 white papers; three AIEs launched ([darpa.mil](https://www.darpa.mil/research/programs/ai-forward), [recap Q&A](https://www.darpa.mil/news/2023/ai-forward-recap)) | The three dominant themes were **(1) human-AI alignment incl. intent, (2) characterization of social norms/values/human qualities, (3) detection and defense against the weaponization of values**. Also: "roughly 70% of DARPA's current programs benefit from AI," 30+ AI programs |
| **FACT** (AI Forward AIE) | AIE | Friction for Accountability in Conversational Transactions | Named idea: "introducing **friction** into human-machine teaming so humans carefully think through the material provided by an AI **instead of being lulled by its confident tone of voice**." This is the doctrinal ancestor of an abstention gate |
| **EMHAT** | AIE | Exploratory Models of Human-AI Teams | Human-AI teaming theory |
| **FoundSci** | AIE | Foundation Models for Scientific Discovery — an "autonomous scientist" capable of "**skeptical** learning and reasoning," which "characterize[s] its uncertainty and skepticism and use[s] them as drivers to systematically acquire and refine its scientific knowledge" ([darpa.mil](https://www.darpa.mil/research/programs/foundation-models-for-scientific-discovery)) | Uncertainty-as-driver framing, nearest AIE to our abstention logic |
| **AIxCC** | 2023 – Aug 2025, complete | AI Cyber Challenge, final at DEF CON 33. Winners: **Team Atlanta $4M**, Trail of Bits "Buttercup" $3M, Theori $1.5M ([DARPA](https://www.darpa.mil/news/2025/ai-cyber-challenge-winners-def-con-33), [The Record](https://therecord.media/darpa-ai-code-competition-winner-def-con)) | **Measured:** systems found **77%** of injected vulnerabilities, patched **61%**, average **45 minutes**; 70 synthetic vulns plus **18 previously unknown real-world flaws**; all systems open-sourced. The template for how DARPA now wants AI capability claims proven: adversarial, scored, public, reproducible |
| **REMA** | 2023–2025 | Rapid Experimental Missionized Autonomy: 18 months, single phase, two TAs. Adapters: **Anduril, RTX**. Mission autonomy: **Leidos, Northrop Grumman, SoarTech**. Announcement-to-award in **70 business days**; monthly "spiral challenges" ([darpa.mil](https://www.darpa.mil/news/2024/mission-autonomy)) | Not content-adjacent, but the **cadence precedent**: DARPA will buy monthly-transition-interval capability when the threat adapts faster than a 4-year program |
| **SABER** | 2025, 24 months | Securing AI for Battlefield Effective Robustness; PM Lt Col Michael Bastian. Operational **AI red-teaming** of already-fielded AI-enabled systems ([darpa.mil](https://www.darpa.mil/news/2025/saber-warfighter-ai)) | DARPA now buys red teams as a *product*, not a review step — validating our red-team-with-standing-to-force-a-rerun design |
| **DISCORD** | May 2026 solicitation | See C6 | Live, and the closest 2026 competitor to fan-out-plus-diversity |
| **NASCENT** | 2026, active | National Security Economic Theory; PM **David Dewhurst**, IPTO. "Establish a principled theoretical foundation for **geoeconomics**, enabling evidence-based economic statecraft"; objectives include "**prevent strategic surprise** by building the methodologies and tools necessary to both **anticipate and mitigate unintended consequences of economic statecraft**" ([darpa.mil](https://www.darpa.mil/research/programs/nascent-national-security-economic-theory)) | Directly occupies the solicitation's "**economic impact**" and "adversary **technoeconomic** policy" language. Approach is theory/mechanism-design, **not** simulate-and-score — a complement, not a competitor |
| **DICE** | June 2026 solicitation (HR001126S0010, due 25 Aug 2026) | Decentralized AI through Controlled Emergence — heterogeneous AI-agent collectives with "local inference control" to keep emergent behavior "**predictable and aligned with commander's intent**," resilient to "'rogue' AI agents that might develop misaligned instrumental goals" ([darpa.mil](https://www.darpa.mil/research/programs/decentralized-artificial-intelligence-through-controlled-emergence)) | The multi-agent-orchestration-with-guarantees lane |
| **MATHBAC** | April 2026 | Mathematics for agentic AI communication protocols; "allow agentic AI systems to evolve in an **explainable** way" ([darpa.mil](https://www.darpa.mil/research/programs/mathbac)) | Formal protocols for agent panels |
| **AI Forge** | Announced 1 June 2026 | DARPA + NSF + NIST CAISI. Convened frontier AI companies plus **chief AI officers from more than 15 DOW and IC agencies** to reach consensus on core national-security AI challenges; produced the *Critical AI Challenges for National Security* report — **15 challenges in 3 thrusts: AI interpretability, AI control, adversarial robustness**; challenges revisited every six months; forum launches summer 2026; PM Matthew Marge ([darpa.mil](https://www.darpa.mil/news/2026/ai-forge-accelerating-ai-breakthroughs-national-security)) | This is the current *authoritative* statement of what the DOW and IC jointly say they need from AI. Note what is **absent** from the three thrusts: forecasting accuracy, calibration, and abstention |
| **FALCON (SBIR)** | 2026 | Fusion of Abstract Learning and Context-Optimized Neural-methods: combine ML on structured data with LLMs, requiring teams to "demonstrate methods to mitigate possible hallucination in the workflow and demonstrate **verifiable and reproducible analytic traces**" ([darpa.mil](https://www.darpa.mil/research/programs/falcon)) | "Verifiable and reproducible analytic traces" is now DARPA contract language — our byte-identical artifact hash under a fixed seed is a direct answer |
| **Office rename** | 2026 | **I2O is again IPTO** (Information Processing Techniques Office, director Patrick Lincoln); MTO → MXO. IPTO's stated thrusts: AI innovation and execution; inherent security and privacy; and "**Resilient Megasystems** — machine-derived abstractions and models that expose the governing principles of highly complex and interconnected systems… to identify hidden systemic risks and emergent properties" ([darpa.mil](https://www.darpa.mil/news/2026/what-is-in-name-darpa-reflecting-enduring-mission-future-focus), [IPTO](https://www.darpa.mil/about/offices/ipto)) | Any proposal citing "I2O" in mid-2026 dates itself. "Resilient Megasystems" is the current IPTO vocabulary for complex-system modeling |

---

## PART F — The IC-adjacent programs that complete the picture (IARPA)

Included because the buyer is the CIA and because the assignment's CREATE entry belongs here.

**CREATE — Crowdsourcing Evidence, Argumentation, Thinking and Evaluation.** IARPA, Jan 2017 – Feb 2020, four performer teams ([iarpa.gov](https://www.iarpa.gov/research-programs/create)):
- **SWARM** (Univ. of Melbourne) — "Contending Analyses," an SAT in which multiple analyses compete to become the report.
- **BARD** (Monash) — causal Bayesian networks plus Delphi.
- **Co-Arg** (George Mason, Tecuci/Schum) — Wigmorean inference networks with Baconian probabilities, using "a positive probability scale that is **a refinement of the scale provided in the Intelligence Community Directive 203 (ICD 203)**" ([arXiv 1810.01541](https://doi.org/10.48550/arxiv.1810.01541)).
- **TRACE** (Syracuse) — empirical evaluation of existing SATs.
- T&E: **Good Judgment Inc. + JHU/APL**.

**Program metric:** Quality of Reasoning, scored on hypothesis generation and accuracy, argumentation structure, source credibility assessment, and identification of key missing information and assumptions. Phase targets: Cohen's **d ≥ 0.25 → 0.5 → 1.0**.

**Headline results.**
- SWARM: professional analyst teams on-platform scored 21.4 vs 15.9 for the same analysts using normal methods — **Cohen's d = 1.37** (95% CI [0.56, 2.23]), exceeding the program's d ≥ 1.0 target ([*Journal of Cognitive Engineering and Decision Making*](https://journals.sagepub.com/doi/full/10.1177/1555343420926287)). Sobering secondary finding: **general-public teams scored 22.6, slightly above the professional analysts' 21.4.**
- BARD: Glass' Δ of **1.4–2.2** across three problems vs. a Google-Suite control ([Frontiers in Psychology](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2020.01054/full)).
- **The program's own head-to-head evaluation failed.** "IARPA's testing team relied upon retaining a large number of volunteer participants who were not significantly compensated, and **attrition was so high (regardless of which of the four systems participants used) that the experiment was terminated early without obtaining any statistically useful data.**"

**Why it matters.** CREATE is the strongest evidence in existence that structured analytic techniques, properly instrumented, produce **large, measured** improvements in analytic reasoning — and it is also proof that the IC has already funded, validated, and then *not fielded* automated SAT platforms. Our ACH-with-diagnosticity-weighting, key-assumptions check, devil's advocate, premortem, and red team panel is CREATE's thesis, automated and made cheap. And Co-Arg establishes that ICD 203-native output has IC-funded pedigree.

Also relevant, and **UNVERIFIED in detail here** because they were outside the assignment's scope: IARPA's **ACE** (Aggregative Contingent Estimation, which produced the Good Judgment Project and the modern Brier-scored forecasting literature), **HFC** (Hybrid Forecasting Competition), and **FOCUS/ForeST**. These are the true prior art for calibrated geopolitical forecasting; DARPA has no equivalent.

---

## PART G — Five cross-program patterns worth naming in the white paper

1. **DARPA repeatedly funded "confidence" and repeatedly measured something else.** INCAS's confidence assessment was scored by SME questionnaire and System Usability Scale. AIDA's hypotheses were scored for coherence, explicitly "not judged for their correctness." COMPASS acknowledged irreducible hypothesis uncertainty and published no calibration. SCEPTER's quality metric is expert preference. SCORE tried to score confidence properly and **failed**. In this entire portfolio, **not one program published a reliability diagram, a Brier skill score against an explicit baseline, or a false-abstention rate.**
2. **Nothing in the portfolio can decline to answer.** There is no INSUFFICIENT_EVIDENCE verdict anywhere. ITM's Phase 2 success metric actively pushes delegation *up*, from 60% to 85%. FACT's "friction" idea is the only funded gesture toward the concept, and it is an 18-month AIE.
3. **The synthetic-ground-truth instrument was built, validated, and abandoned.** Ground Truth proved that hidden-causality synthetic worlds are the only way to validate social-science method, and Sandia's own recommendation was to run a more controlled successor. Nobody did. Our synthetic closed worlds and 15,832-simulation oracle sit exactly in that vacated slot — with the added property Ground Truth lacked: the ground truth *did not exist before the run produced it*, which forecloses memorization in a way a 2017 program never had to consider.
4. **Diversity-of-hypothesis is now an explicit DARPA buying criterion.** DISCORD (May 2026) wants "genuinely diverse strategies, rather than just a single optimized solution." Ground Truth's one positive finding was that pluralistic competing subteams found structure single methods missed. Our ensemble-diversity metric is the measurement DARPA has twice wanted and never specified.
5. **What transitions is embedded tooling, not analytic engines.** PROTEUS → MCWL. ASKE/ASKEM → TERArium workbench and USAID model reuse. AIxCC → open-sourced systems in production use. ACK, COMPASS, INCAS, SocialSim, World Modelers, KAIROS, AIDA, Ground Truth — all "complete," none with a documented program of record. Transition risk is the portfolio's dominant failure mode, and it is a risk the CIA reviewer has personally lived through.

---

# The DARPA delta

For each candidate mission area: did DARPA fund it, what was the *measured* outcome, and is it a poor bet (solved) or a strong bet (proven valuable, never productized for the IC)?

### 1. Influence-operations detection and narrative sensemaking
**Funded?** Yes, heavily and recently. **SocialSim** ($42M, 2017–2022) and **INCAS** (2021–2025), plus AIDA, SemaFor-adjacent work, UGB, and the SMA/COMPASS gray-zone line.
**Measured outcome.** SocialSim: no method dominated; a stationary "keep doing what you did" sampler was broadly best; one month of data beat all history. INCAS: F-score targets on indicator extraction (0.8→0.9) and psychographic attributes (0.7→0.8), plus a Cohen's d ≥ 0.8 sensemaking-effect target — with **confidence quality assessed by SME questionnaire**. Neither program published a forecast-scored result or a named transition.
**Verdict: MEDIUM bet — reframe, don't re-enter.** Detection and extraction are saturated: DARPA already paid for F=0.9 indicator classifiers and five performer teams built them. Entering as "we detect influence narratives" invites the reviewer to say "INCAS did that." Entering as "**we take the campaign hypotheses INCAS-class tools produce and score them — outcome bands, Brier skill vs. base rate, calibration, and an abstention gate**" makes INCAS our *input assumption* rather than our competitor. The specific unclaimed ground: INCAS's own objective, "quantified confidence," measured for real.

### 2. Adversary decision-process simulation (the customer's Iran/water-infrastructure example)
**Funded?** Partially, and never in this shape. **COMPASS** did multi-hypothesis lines-of-effort attribution for gray-zone actors (INDOPACOM, Dec 2019). **SI3-CMD** did game-theoretic adversary reasoning in imperfect-information settings. **SCEPTER** and **DISCORD** do adversary-facing COA generation, but kinetic and simulator-fed. **Habitus** modeled local populations; **UGB** modeled group biases.
**Measured outcome.** COMPASS: a genuinely good metric design (days-to-identify each actor's lines of effort, 4 actors, 10 simulated days) whose **results were never published**. SCEPTER: 10k–100k× real-time exploration, 1000× training-time reduction, evaluated by *whether planners found it useful*. SI3-CMD and Gamebreaker: no published program-level results.
**Verdict: STRONG bet.** DARPA has funded adversary-decision simulation four separate times and has never once produced a public, scored, calibrated forecast of an adversary decision. The unoccupied ground is precise: **a distinct actor/hypothesis profile per run (riskTolerance × escalationPropensity), a deterministic seeded kernel so the run is reproducible byte-for-byte, and outcome bands over a resolvable quantity so the simulation can be wrong in a countable way.** Two supporting citations we own: ITM already proved that encoding decision-maker attributes (explicitly including "risk tolerance") raises expert trust and delegation; DISCORD (2026) is currently buying "genuinely diverse strategies" as a first-class objective.

### 3. Calibrated probabilistic forecasting of socio-political outcomes
**Funded?** By DARPA, **essentially not at all**. World Modelers made 1–5-year subnational projections and never scored them. Ground Truth scored *prediction robustness* inside synthetic worlds and found causal understanding contributed ~1% of variance. The calibrated-forecasting literature belongs to IARPA (ACE/HFC), not DARPA.
**Measured outcome.** The only rigorous DARPA attempt at machine-generated confidence — **SCORE** — concluded in *Nature* in April 2026 that **no machine method consistently predicted replication**, while human forecasters hit 76–78%.
**Verdict: STRONGEST bet, with a mandatory honesty clause.** This is the largest hole in the DARPA portfolio and the hole the CIA solicitation's benefit category (b) — "increase accuracy of insights/predictions" — points directly at. But SCORE is four months old and it is a *negative* result about machines scoring confidence. Any proposal that asserts "our system predicts accurately" without addressing SCORE will be read as naive. The winning posture is exactly the one the prototype already takes: **Brier skill tracks evidence quality monotonically on a synthetic oracle (+0.44 / +0.42 / +0.11 / −0.46 when deliberately misspecified); real-world forecasting skill is NOT YET MEASURED and the system says so in the first line of every run.** That claim is more credible than any competitor's, precisely because SCORE just proved the competitors' claim false.

### 4. Abstention — knowing when not to answer
**Funded?** **No.** Nowhere in DARPA's portfolio is there a measured false-abstention/true-abstention rate. The nearest artifacts: AI Forward's **FACT** AIE (friction so users aren't "lulled by [AI's] confident tone of voice"); **FoundSci**'s "skeptical" autonomous scientist that "characterize[s] its uncertainty and skepticism"; AIQ's generalization guarantees; and SciFy's claim decomposition. ITM moves in the opposite direction, targeting 85% delegation.
**Verdict: STRONGEST bet — this is the true white space.** An abstention gate that runs *before* scoring, with false-abstention and true-abstention rates measured on a benchmark rather than asserted (80/80 on a provably unanswerable arm; 0–7/80 on answerable arms), has no DARPA prior art at all. It is also the most direct answer to the WMD-era institutional memory that the CIA reviewer carries, and to SCORE's finding that machine credibility scoring is unreliable — abstention is what a system does *instead of* pretending to a confidence it can't earn.

### 5. Analytic quality assurance — source discrepancy detection and confidence reconciliation
**Funded?** Adjacent only. **SCORE** attacked credibility of the *literature*; **SciFy** attacks feasibility of *technical claims*; **AIDA** attacked *conflicting and potentially deceptive* sources but scored coherence, not correctness; **INCAS** promised bias mitigation via machine-curated evidence, measured by questionnaire. **CREATE (IARPA)** scored "identification of sources and assessment of credibility of evidence" as one of four Quality-of-Reasoning criteria and achieved d = 1.37.
**Measured outcome.** CREATE's d = 1.37 is the single strongest measured effect in the whole IC/DoD analytic-tooling record — and it was achieved by *humans using a structured platform*, then never fielded. SCORE proved machines can't do the credibility half unaided.
**Verdict: STRONG bet.** The solicitation's benefit category (c) — "identify discrepancies between sources and reconcile differences in overall analytic confidence" — is nearly a paraphrase of CREATE's scoring rubric. Our contradiction precision/recall, z-score normalization across judges to remove severity bias, and weakest-link confidence aggregation are the automated form of what CREATE demonstrated with humans. Pitch: *CREATE proved the effect is real and large; it required 12–24 humans per problem; we make it a config file.*

### 6. Structured analytic technique automation (ACH, premortem, devil's advocate, red team)
**Funded?** By IARPA (CREATE), not DARPA. DARPA's nearest is **SABER** (2025) buying operational AI red-teaming as a standing capability, and **AIDA**'s alternative-hypothesis generation.
**Measured outcome.** CREATE: SWARM d = 1.37, BARD Glass' Δ 1.4–2.2, both exceeding the d ≥ 1.0 target; the head-to-head T&E collapsed from participant attrition. Co-Arg produced ICD 203-aligned probability scales and automated bias warnings ("you may be biased toward confirming this hypothesis because it has only favoring arguments").
**Verdict: STRONG bet, and the cheapest to defend.** Heuer's diagnosticity-weighted ACH ranking by weighted inconsistency ascending is a 1999 algorithm; the contribution is not the technique but that the panel is **auto-designed per question** and runs in minutes at a measured cost per insight. Two DARPA-side supports: SABER establishes red teams as products; AI Forward's workshop themes named "human-AI alignment" and "characterization of social norms and values" as the field's top gaps.

### 7. Causal / technoeconomic modeling for adversary policy
**Funded?** Yes, three times — **World Modelers** (unscored), **Causal Exploration** (unscored, BAE CONTEXTS), **Ground Truth** (scored, and the answer was negative) — and once more, right now, as **NASCENT** (quantitative geoeconomics, IPTO, PM David Dewhurst).
**Measured outcome.** Ground Truth is decisive: edge recovery was far worse than node recovery ("causality is tough to infer"), and causal understanding explained ~1% of variance in prediction performance. PNNL found SOTA causal discovery "not robust to sampling," non-generalizing, and hard to reproduce.
**Verdict: POOR bet as causal-graph recovery; STRONG bet as an outcome-band forecast that happens to be informed by causal structure.** Proposing "we build the causal model of adversary technoeconomic policy" walks straight into DARPA's own published negative result and collides with an *active* program (NASCENT). Proposing "we forecast the resolvable quantity — tariff-band, export-control response, escalation-step — and score it, and we use causal structure only where it earns its keep" is defensible, and can cite Ground Truth as the reason we did *not* make graph fidelity the objective.

### 8. Wargaming / course-of-action generation
**Funded?** Yes, continuously and expensively: **Gamebreaker** (2020, 9 teams), **SCEPTER** ($39M, 2022–2025, Phase 2 classified), **DISCORD** (24 months, awards imminent, implementing a DOW Pace-Setting Project), plus SI3-CMD, ACK, and PROTEUS.
**Measured outcome.** SCEPTER: 10k–100k× real-time, 10,000 agents, 1000× faster training — evaluated by planner preference. DISCORD is being awarded now.
**Verdict: POOR bet — do not enter.** This lane is crowded, currently funded, partly classified, and owned by primes (BAE, Charles River, Parallax, Northrop) with a decade of incumbency and access to trusted classified simulators we do not have. The only sane relationship to it is **adjacency**: our adjudication, calibration, and abstention layer is the missing scoring apparatus *for* a SCEPTER/DISCORD-class COA generator — a partner, not a rival.

### 9. Evaluation infrastructure: synthetic oracles, as-of leakage guards, benchmark harnesses
**Funded?** Repeatedly, always as a supporting technical area, and always dismantled at program end. **Ground Truth** (Sandia T&E + four synthetic worlds), **SocialSim TA3** (challenge problems and fidelity metrics; Leidos gold-standard ground truth), **INCAS TA5** (UMD ARLIS, gold-standard corpora, SME panel), **KAIROS** (NIST evaluation suite), **AIDA** (NIST TAC SM-KBP, three phases), **AIQ TA2** (Kitware MAGNET evaluation cards, active), **AIxCC** (scored public competition).
**Measured outcome.** Every one of these built a serious evaluation apparatus; the apparatus died with the program. Sandia explicitly recommended a controlled successor to Ground Truth; none exists. SCORE just released the largest labeled credibility corpus ever assembled, openly on OSF, with no tool built to consume it.
**Verdict: STRONGEST bet, and the most defensible *technical* differentiator.** Leakage guards **in code, not prompts** — a hard-date-filtered as-of corpus retrieval plus a runtime assertion that throws if any evidence reference post-dates the run's as-of date — has no equivalent in the portfolio, because none of these programs faced pretrained-model memorization. The mandatory evaluation-regime tag (`synthetic_oracle | historical_backtest | live_post_cutoff`) with no function that pools across regimes is the single cleanest answer to "how do we know your numbers aren't contaminated," and it maps directly onto AIQ's evaluation-card-as-contract and FALCON's "verifiable and reproducible analytic traces."

### 10. Cost and cycle-time reduction on repetitive analysis (benefit category d)
**Funded?** Yes — and this is where DARPA's *measured* numbers actually exist. **ASKE**: 50× speedup extending an epidemiology model, 8× faster to create a new model in a new domain. **AIxCC**: 61% of vulnerabilities patched at 45 minutes average. **REMA**: program announcement to award in 70 business days, one-month transition intervals. **COMPASS**: days-to-identify-lines-of-effort. **INCAS**: Cohen's d on analyst sensemaking with vs. without tools.
**Verdict: STRONG bet, and the easiest to prove.** These are the only metric shapes in the portfolio with hard published numbers, and they are exactly the shapes the solicitation asks for. Our cost-per-insight metric plus a two-cohort with/without-tool design (INCAS's own TA3 protocol) plus time-to-answer produces claims of the same class DARPA has already accepted from ASKE and AIxCC — and unlike accuracy claims, they are cheaply and unambiguously demonstrable today.

---

### One-paragraph summary of the delta

DARPA has spent roughly a decade and well over $150M establishing, in its own published record, that: social simulation of information spread is achievable but its best models are near-trivial and unscored (SocialSim); influence-campaign detection reaches F≈0.9 while its "quantified confidence" is a usability questionnaire (INCAS); multi-hypothesis engines can be built but their hypotheses were "not judged for their correctness" (AIDA); causal-structure recovery does not buy prediction (Ground Truth, ~1% of variance); machine credibility scoring does not beat human experts and largely does not work (SCORE, *Nature* 2026); AI can be aligned to a human's decision attributes and thereby earn delegation, in a domain deliberately defined to have no right answer (ITM); and explanation helps novices and can actively hurt experts (XAI). **Every one of those is a component of the problem the CIA is asking about. None of them was ever assembled into a system that states a resolvable claim, refuses to state one when the evidence is insufficient, and reports how often it is right — with the regime of that measurement declared and no function permitted to pool across regimes.** That assembly, not any single component, is the delta.