/**
 * The targeted-recruitment adapter — the kernel's second real domain.
 *
 * Nothing in sim/kernel.ts changed to accommodate this. That is the point: the
 * kernel's claim to be domain-free had only ever been exercised by a toy test
 * domain, and a second real one is the only way to find out whether the seam
 * holds. It does — init/step/observe were enough.
 *
 * Closed-world and synthetic throughout; see config.ts for the scope boundary.
 */

import type { Rng } from "../../rng.js";
import type { SimEvent, SimulationAdapter } from "../../kernel.js";
import { validateConfig } from "./config.js";
import type { RecruitmentConfig } from "./config.js";
import { buildWorkforce } from "./workforce.js";
import type { Workforce } from "./workforce.js";
import {
  buildTargetOrder,
  initialTargets,
  selectDefenseCoverage,
  stepFunnel,
} from "./funnel.js";
import type { TargetState } from "./funnel.js";
import { census, clearedConversionRate, reportRate } from "./measures.js";
import { observeTick, YOUNG_ACCOUNT_DAYS } from "./observable.js";
import type { ObservableTick } from "./observable.js";

export const ADAPTER_NAME = "recruitment";
export const ADAPTER_VERSION = "1";

export interface RecruitmentState {
  readonly workforce: Workforce;
  readonly targets: TargetState[];
  readonly order: readonly number[];
  readonly coveredByDefense: ReadonlySet<number>;
  /** Per-organisation awareness, raised by reports from inside it. */
  readonly awareness: number[];
  /** Telemetry so far — the only history the detector may read. */
  readonly observables: ObservableTick[];
  cursor: number;
  totalDefenseCost: number;
}

export const recruitmentAdapter: SimulationAdapter<
  RecruitmentConfig,
  RecruitmentState
> = {
  name: ADAPTER_NAME,
  version: ADAPTER_VERSION,

  totalTicks(config) {
    return config.ticks;
  },

  init(config, rng) {
    validateConfig(config);
    const workforce = buildWorkforce(config, rng.fork("workforce"));
    return {
      workforce,
      targets: initialTargets(workforce),
      order: buildTargetOrder(
        workforce,
        config.campaign?.selectivity ?? 0,
        rng.fork("targeting"),
      ),
      coveredByDefense: selectDefenseCoverage(
        workforce,
        config,
        rng.fork("defense"),
      ),
      awareness: new Array<number>(config.workforce.organizations).fill(0),
      observables: [],
      cursor: 0,
      totalDefenseCost: 0,
    };
  },

  step(state, tick, config, rng): SimEvent[] {
    const { outcome, cursor } = stepFunnel({
      workforce: state.workforce,
      targets: state.targets,
      order: state.order,
      cursor: state.cursor,
      awareness: state.awareness,
      coveredByDefense: state.coveredByDefense,
      config,
      tick,
      rng,
    });
    state.cursor = cursor;
    state.totalDefenseCost += outcome.defenseCost;

    const perOrganization = new Array<number>(
      config.workforce.organizations,
    ).fill(0);
    for (const id of outcome.contactedIds) {
      perOrganization[state.workforce.people[id]!.organization]!++;
    }

    // ── Legitimate traffic ──
    // The platform sees ordinary hiring and networking alongside the campaign,
    // and cannot label which is which. Adding it here rather than in the funnel
    // is deliberate: these approaches are not the adversary's, so they must not
    // enter anyone's funnel — they exist only to make the defender's problem
    // the real one, which is separation rather than noticing.
    const bg = config.background;
    const noise = 1 + (rng.uniform(0, 1) * 2 - 1) * bg.volatility;
    const backgroundRequests = Math.max(
      0,
      Math.round(bg.requestsPerTick * noise),
    );
    for (let n = 0; n < backgroundRequests; n++) {
      perOrganization[rng.int(config.workforce.organizations)]!++;
    }
    const backgroundAccepted = Math.round(backgroundRequests * bg.acceptRate);
    const backgroundReports = rng.bernoulli(backgroundRequests * bg.reportRate)
      ? 1
      : 0;

    const campaignRequests = outcome.contactsAttempted;
    const campaignAge =
      (config.campaign?.accountAgeDays ?? 0) +
      Math.max(0, tick - (config.campaign?.startTick ?? 0));
    const totalRequests = campaignRequests + backgroundRequests;

    const observable = observeTick({
      tick,
      connectionRequests: totalRequests,
      accepted: outcome.accepted + backgroundAccepted,
      reportsFiled: outcome.reported + backgroundReports,
      activeAccounts:
        (campaignRequests > 0 ? (config.campaign?.accounts ?? 0) : 0) +
        backgroundRequests,
      contactsPerOrganization: perOrganization,
      youngAccountRequests:
        (campaignAge < YOUNG_ACCOUNT_DAYS ? campaignRequests : 0) +
        (bg.accountAgeDays < YOUNG_ACCOUNT_DAYS ? backgroundRequests : 0),
    });
    state.observables.push(observable);

    const snapshot = census(state.workforce, state.targets);

    // Ground truth and telemetry travel in separate event kinds so a consumer
    // cannot accidentally read the answer out of the observable stream.
    return [
      {
        tick,
        kind: "truth",
        data: {
          contacted: snapshot.contacted,
          contactedCleared: snapshot.contactedCleared,
          tasked: snapshot.tasked,
          taskedCleared: snapshot.taskedCleared,
          reported: snapshot.reported,
          compromisedAccess: snapshot.compromisedAccess,
          paidK: snapshot.paidK,
          clearedConversionRate: clearedConversionRate(snapshot),
          reportRate: reportRate(snapshot),
          stageHistogram: [...snapshot.byStage],
          newlyTasked: outcome.newlyTasked,
          advanced: outcome.advanced,
        },
      },
      {
        tick,
        kind: "telemetry",
        data: {
          connectionRequests: observable.connectionRequests,
          accepted: observable.accepted,
          reportsFiled: observable.reportsFiled,
          activeAccounts: observable.activeAccounts,
          employerConcentration: observable.employerConcentration,
          youngAccountShare: observable.youngAccountShare,
        },
      },
    ];
  },

  observe(state, tick) {
    const latest = state.observables[state.observables.length - 1];
    return {
      tick,
      connectionRequests: latest?.connectionRequests ?? 0,
      accepted: latest?.accepted ?? 0,
      reportsFiled: latest?.reportsFiled ?? 0,
      activeAccounts: latest?.activeAccounts ?? 0,
      employerConcentration: latest?.employerConcentration ?? 0,
      youngAccountShare: latest?.youngAccountShare ?? 0,
    };
  },
};

export * from "./config.js";
export * from "./measures.js";
export * from "./observable.js";
export {
  buildWorkforce,
  targetPriority,
  employerConcentration,
} from "./workforce.js";
export type { Person, Workforce } from "./workforce.js";
export {
  buildTargetOrder,
  initialTargets,
  selectDefenseCoverage,
  stepFunnel,
} from "./funnel.js";
export type { TargetState, FunnelOutcome } from "./funnel.js";
