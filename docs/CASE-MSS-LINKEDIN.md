# Case study: MSS recruitment via LinkedIn

The real-world case the `recruitment` domain is modelled on. Written for an
evaluator who needs to know which numbers come from public reporting, which are
inferred, and which the model simply invented.

**Every figure below is sourced. Every figure in the model that is NOT sourced
is labelled an assumption in §4.**

---

## 🧑 In Plain English

**What happened:** Chinese intelligence used LinkedIn at scale to find people
with security clearances, started friendly professional conversations with them,
paid them small sums for harmless-looking "consulting reports", and escalated the
requests from there. Germany's domestic security service found more than ten
thousand of its citizens had been approached this way.

**Why it is worth modelling:** it is a funnel. Lots of people get contacted, far
fewer reply, fewer still take money, and a very small number end up handing over
things they should not. Each of those steps has a rate, and a defender who knows
the rates can work out where to spend effort.

**What the model is for:** not predicting the next campaign. Working out how much
damage accumulates before a defender could realistically notice — and which
defences actually move that number.

---

## 1. The public record

### 1.1 Germany — scale

Germany's Federal Office for the Protection of the Constitution (BfV) announced
in December 2017 that a nine-month investigation had identified **more than
10,000 German citizens contacted** through fake LinkedIn profiles posing as
headhunters, consultants, think-tankers and scholars. The BfV took the unusual
step of publicly naming **eight fake profiles and three fake companies**, and
described the effort as a broad-based attempt to infiltrate parliaments,
ministries and government agencies. The stated collection interest included
users' habits, hobbies and political interests — profile-level data, not
secrets.

_What this anchors:_ the top of the funnel, and the fact that targeting is
directed at particular institutions rather than spread evenly.

_What it does not anchor:_ the denominator. The number of people approached was
published; the size of the pool they were drawn from was not. Any "contact rate"
derived from it would be invented.

### 1.2 Dickson Yeo — the fullest funnel on the record

Jun Wei "Dickson" Yeo, a Singaporean PhD student, pleaded guilty in July 2020 to
acting as an illegal agent of Chinese intelligence.

| Step                             | What the record says                                                                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Spotted**                      | Approached in Beijing in 2015 after presenting on Southeast Asian politics; offered money for political reports. At least four of the individuals were later established to be Chinese intelligence officers.      |
| **Tasked to spot others**        | Searched LinkedIn for people whose job descriptions implied access to valuable non-public information.                                                                                                             |
| **Selection criteria**           | Chose targets by **vulnerability — dissatisfaction with work, or financial difficulty**.                                                                                                                           |
| **Scaled the top of the funnel** | In 2018 created a fake consulting company using the same name as a real US firm and posted job advertisements under it.                                                                                            |
| **Yield**                        | Received **more than 400 résumés**; **90% came from US military and government personnel with security clearances**.                                                                                               |
| **Payments**                     | An Army officer, described as traumatised by tours in Afghanistan, was paid **$2,000** for a report — routed to his wife's account. A State Department employee with financial concerns received **$1,000–2,000**. |
| **Handling**                     | Roughly **40 trips to China** between 2015 and 2019; processed away from the customs line to conceal his movements; issued a bank card by his handlers to pay targets.                                             |
| **Tasking**                      | Directed to obtain non-public material on the Department of Commerce, artificial intelligence, and the trade dispute with China.                                                                                   |
| **Outcome**                      | Arrested November 2019; pleaded guilty 24 July 2020; sentenced to 14 months.                                                                                                                                       |

_What this anchors:_ the shape of the ladder, the selection criterion, and the
order of magnitude of the payments — **single thousands of dollars, not
millions**, for the first rungs.

### 1.3 Kevin Mallory — the far end of the funnel

A former CIA officer, contacted on LinkedIn in 2017 by a purported headhunter.
He was **$230,000 in debt** and months behind on his mortgage. He travelled to
Shanghai twice in 2017, met a contact associated with the Shanghai Academy of
Social Sciences — an institution with well-reported intelligence links — and
received **$25,000** for defence information. Convicted under the Espionage Act,
sentenced to 20 years.

_What this anchors:_ that financial distress is the operative vulnerability, and
that the payment ladder climbs by roughly an order of magnitude between the
"write me a report" rung and the "hand me classified material" rung.

---

## 2. The funnel, as the model implements it

```
  untouched ──► contacted ──► engaged ──► cultivated ──► tasked
                    │             │            │
                    ▼             ▼            ▼
                 reported     reported    (reporting collapses
                                           once money is taken)
```

| Rung           | Real-world analogue                                            |
| -------------- | -------------------------------------------------------------- |
| **contacted**  | The connection request or InMail from a "headhunter"           |
| **engaged**    | A reply; a conversation begins                                 |
| **cultivated** | The first paid "consulting report" — $1–2k, nothing classified |
| **tasked**     | Requests for non-public material, for money                    |

Two exits: the target **declines**, or the target **reports** the approach to a
security office. Reporting is the only defensive signal in this model that comes
from the workforce itself rather than from the platform.

---

## 3. What a defender can actually see

This is the whole reason the case is worth modelling. Ground truth — who is at
which rung, who took money, who holds a clearance — is invisible to everyone
except the adversary and the target. What a platform and a security office can
observe is much thinner:

| Observable                                      | Why it is observable                   |
| ----------------------------------------------- | -------------------------------------- |
| Connection requests, and how many were accepted | Platform logs                          |
| Which employers the requests cluster on         | Platform logs + profile employer field |
| Age of the sending accounts                     | Platform logs                          |
| Approaches reported to security                 | Someone walked down the hall           |

The BfV finding is essentially the second row: approaches concentrating on
particular ministries and agencies rather than spreading the way ordinary
recruiting does.

The model keeps these two sets in separate event streams, and a test asserts the
detector can never read the first set.

---

## 4. Assumptions the model makes that the record does not support

Listed in descending order of how much the results depend on them. **None of
these is measured. All are swept in the demo cases.**

| #   | Assumption                                       | Value used                              | Status                                                                                                             |
| --- | ------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | Taking money suppresses the chance of reporting  | 85% reduction                           | **Invented.** Directionally uncontroversial — a paid target is complicit — but the magnitude has no source.        |
| 2   | Chance an individual reports a fresh approach    | 2% per approach, within a 4-tick window | **Invented.** Produces ~9% of contacted people reporting overall. No public base rate exists.                      |
| 3   | Reporting only happens shortly after an approach | 4-tick window                           | **Inferred.** People flag odd messages promptly or not at all.                                                     |
| 4   | Legitimate background recruiting traffic         | ~26 requests/tick                       | **Invented.** Necessary — see §5 — but the ratio to campaign traffic is a guess, and it sets detection difficulty. |
| 5   | Employers differ in sensitivity                  | 0.45× to 1.0×                           | **Inferred** from the BfV targeting description.                                                                   |
| 6   | Escalation probability per tick                  | 2–12%                                   | **Invented**, tuned so the funnel neither saturates nor never converts.                                            |
| 7   | One report raises colleagues' guard              | +1.5%, capped at 35%, decaying          | **Invented** entirely.                                                                                             |

**Consequence for any claim made from this model:** it describes the funnel's
_structure_, not any real campaign's _rates_. A statement like "23 people would
be compromised" is a statement about the simulation. The defensible claims are
comparative — this defence beats that one, this campaign profile evades
detection and that one does not.

---

## 5. Two defects found by building it

Both were found by probing the model, not by reasoning about it, and both would
have produced a confident and wrong demo.

**A per-tick reporting hazard compounds to certainty.** Applying a 2%-per-tick
chance to everyone still in the funnel over a 140-tick campaign yields ~94%.
The first version reported **62% of contacted people reporting the approach**,
which is absurd. Reporting is now scoped to a window after each new approach.

**With no legitimate background traffic, detection is trivial and meaningless.**
A campaign beginning from a dead-silent baseline is detectable at the first tick
it sends anything, so detection lag was always zero and "exposure before
detection" was always zero. The model now carries ordinary recruiting traffic,
and the defender's problem is separation rather than noticing.

A third defect was structural: **statistically identical employers**. With every
organisation the same, a selective adversary spreads across them evenly, and
employer concentration — the one signal the BfV actually reported publicly —
stayed pinned at 1/n no matter what the adversary did. Organisations now differ
in clearance density and access value.

---

## 6. The finding

Measured over 8 seeds per profile, detector threshold 0.50, 20-tick baseline:

| Campaign profile                      | Detected        | Cleared personnel compromised at detection |
| ------------------------------------- | --------------- | ------------------------------------------ |
| Loud — 10 accounts, new, fast         | 8/8, by tick 20 | 0                                          |
| Reference                             | 8/8, by tick 22 | 0                                          |
| **Patient — 2 aged accounts, slow**   | **0/8**         | **18**                                     |
| **Starts before the baseline period** | **0/8**         | **36**                                     |

The detector catches everything noisy and nothing patient — and the patient
campaigns are the ones that compromise people. Both blind spots are structural
rather than tuning artefacts: a deviation detector cannot see a campaign that
was already running when it started learning what normal looks like, and it
cannot see one whose volume never departs from normal.

**Caveat that must travel with this table:** the model does not simulate
response. Detection stops nothing; it only marks the point after which a
defender could have acted. "Compromised at detection" is damage already done
when the alarm rings, not total damage.

---

## Sources

- [Germany's BfV: Chinese spies used LinkedIn to snoop on politicians — CNBC](https://www.cnbc.com/2017/12/11/germanys-bfv-chinese-spies-used-linkedin-to-snoop-on-politicians.html)
- [German spy agency warns of Chinese LinkedIn espionage — BBC](https://feeds.bbci.co.uk/news/world-europe-42304297)
- [Chinese LinkedIn Profile Scam Targeted German Politicians — TIME](https://time.com/5057998/germany-china-cyberspying-linkedin/)
- [China's MSS using LinkedIn against the U.S. — CSO Online](https://www.csoonline.com/article/566195/chinas-mss-using-linkedin-against-the-us.html)
- [Singaporean National Pleads Guilty to Acting as an Illegal Agent of Chinese Intelligence — US DOJ](https://www.justice.gov/usao-dc/pr/singaporean-national-pleads-guilty-acting-united-states-illegal-agent-chinese)
- [Yeo Jun Wei — Wikipedia](https://en.wikipedia.org/wiki/Yeo_Jun_Wei)
- [Singaporean pleads guilty in US to working for Chinese intelligence — SCMP](https://www.scmp.com/news/china/article/3094663/singaporean-pleads-guilty-us-working-chinese-intelligence)
- [How a $230,000 debt and a LinkedIn message led an ex-CIA officer to spy for China — NBC News](https://www.nbcnews.com/politics/national-security/how-230-000-debt-linkedin-message-led-ex-cia-officer-n990691)
- [LinkedIn is becoming China's go-to platform for recruiting foreign spies — CyberScoop](https://cyberscoop.com/linkedin-china-spies-kevin-mallory-ron-hansen/)
- [Ex-CIA officer gets 20-year sentence for spying for China — Al Jazeera](https://www.aljazeera.com/news/2019/5/18/ex-cia-officer-gets-20-year-sentence-for-spying-for-china)
