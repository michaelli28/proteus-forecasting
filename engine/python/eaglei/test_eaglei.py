"""Run: engine/.venv/bin/python -m pytest python/eaglei/ -q -p no:cacheprovider (from engine/)."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from .outages import EPOCH, bridge, compact, parse_times, window
from .storms import storm_counties


def decl(**over) -> dict:
    row = {
        "id": "r1", "incidentId": "2020091301", "incidentType": "Hurricane", "declarationTitle": "HURRICANE SALLY",
        "declarationType": "DR", "state": "AL", "fipsStateCode": "01", "fipsCountyCode": "003",
        "incidentBeginDate": "2020-09-14T00:00:00.000Z", "incidentEndDate": "2020-09-16T00:00:00.000Z",
    }
    return row | over


def test_tribal_000_rows_are_dropped_not_expanded_and_never_set_dr():
    # S1 expanded a Poarch Creek DR row to every Alabama county; that must not happen.
    d = pd.DataFrame([decl(id="a", declarationType="EM"), decl(id="b", fipsCountyCode="000")])
    out = storm_counties(d)
    assert out["fips"].tolist() == ["01003"]
    assert not out["has_dr"].item()


def test_puerto_rico_out_virgin_islands_in():
    d = pd.DataFrame([decl(id="a", state="PR", fipsStateCode="72", fipsCountyCode="013"),
                      decl(id="b", state="VI", fipsStateCode="78", fipsCountyCode="010")])
    assert storm_counties(d)["fips"].tolist() == ["78010"]


def test_title_rule_keeps_other_types_naming_a_tropical_system_only():
    d = pd.DataFrame([decl(id="a", incidentType="Severe Storm", declarationTitle="REMNANTS OF TROPICAL STORM FRED"),
                      decl(id="b", incidentType="Coastal Storm", declarationTitle="COASTAL STORM", fipsCountyCode="005"),
                      decl(id="c", incidentType="Severe Storm", declarationTitle="REMNANTS OF IDA", fipsCountyCode="007")])
    assert storm_counties(d)["fips"].tolist() == ["01003"]


def test_split_uses_the_storms_earliest_begin_and_null_end_is_begin_plus_7d():
    # A storm that began Dec 30 2021 is training even where a county's own row begins in 2022.
    d = pd.DataFrame([
        decl(id="a", incidentId="X", incidentBeginDate="2021-12-30T00:00:00.000Z"),
        decl(id="b", incidentId="X", fipsCountyCode="005", incidentBeginDate="2022-01-02T00:00:00.000Z",
             incidentEndDate=None),
    ])
    out = storm_counties(d).set_index("fips")
    assert set(out["split"]) == {"train"}
    assert out.loc["01005", "end"] == pd.Timestamp("2022-01-09")


def test_recoded_fips_and_county_begin_end_span_its_own_rows():
    d = pd.DataFrame([
        decl(id="a", state="AK", fipsStateCode="02", fipsCountyCode="270", declarationType="EM"),
        decl(id="b", state="AK", fipsStateCode="02", fipsCountyCode="270",
             incidentBeginDate="2020-09-12T00:00:00.000Z", incidentEndDate="2020-09-20T00:00:00.000Z"),
    ])
    row = storm_counties(d).iloc[0]
    assert row["fips"] == "02158" and row["has_dr"]
    assert (row["begin"], row["end"]) == (pd.Timestamp("2020-09-12"), pd.Timestamp("2020-09-20"))


def test_both_time_formats_parse_and_anything_else_stops_the_run():
    assert parse_times(pd.Series(["2020-01-01 00:15:00"])).iloc[0] == pd.Timestamp("2020-01-01 00:15")
    assert parse_times(pd.Series(["1/1/22 0:00"])).iloc[0] == pd.Timestamp("2022-01-01")
    with pytest.raises(ValueError):
        parse_times(pd.Series(["2020-01-01 00:15:00", "01.01.2020"]))


def year(rows: list[tuple[int, int, float]], pad_to: int = 200) -> object:
    # Filler county 99999 gives every slot in [0, pad_to) one row, so no slot looks like a dip.
    rows = rows + [(99999, s, 5.0) for s in range(pad_to)]
    f, s, c = (np.array(v) for v in zip(*rows))
    return compact(f.astype(np.int32), s.astype(np.int32), c.astype(np.float32))


def test_duplicates_keep_the_max_and_a_blank_loses_to_a_value():
    y = year([(1001, 3, 10.0), (1001, 3, 40.0), (1001, 4, np.nan), (1001, 4, 7.0)])
    x = window(y, 1001, 3, 4)
    assert x.tolist() == [40.0, 7.0] and y.duplicates == 2


def test_blank_is_missing_absent_is_zero_and_outside_the_file_is_missing():
    y = year([(1001, 10, 50.0), (1001, 11, np.nan)])
    x = window(y, 1001, 9, 201)
    assert x[0] == 0.0 and x[1] == 50.0 and np.isnan(x[2]) and x[3] == 0.0
    assert np.isnan(x[-1]) and np.isnan(x[-2])  # slots 200, 201 are past the file's last slot 199


def test_absent_rows_inside_a_nationwide_dip_are_missing():
    rows = [(c, s, 1.0) for c in range(2000, 2010) for s in range(200) if not 100 <= s < 104]
    y = year(rows)
    x = window(y, 1001, 98, 105)
    assert np.isnan(x[2:6]).all() and (x[[0, 1, 6, 7]] == 0).all()


def test_a_county_storing_zeros_in_10pct_of_its_rows_has_missing_absent_rows_others_unaffected():
    heavy = [(1001, s, 0.0 if s % 5 == 0 else 3.0) for s in range(0, 100)]  # 20% zeros
    stray = [(1003, s, 0.0 if s == 0 else 3.0) for s in range(0, 100, 2)]  # 1 zero in 50 rows
    y = year(heavy + stray)
    assert y.zero_heavy == frozenset({1001}) and y.zero_rows == 21
    assert np.isnan(window(y, 1001, 150, 150)[0])  # absent row, zero-heavy county: missing
    assert window(y, 1003, 1, 1)[0] == 0.0  # absent row, one stray zero: still zero


def test_recode_applies_to_outage_codes_and_merges_rows():
    y = year([(2270, 5, 10.0), (2158, 5, 30.0), (51515, 6, 4.0)])
    assert window(y, 2158, 5, 5)[0] == 30.0 and window(y, 51019, 6, 6)[0] == 4.0
    assert 2270 not in y.counties and 51515 not in y.counties


def test_bridge_fills_interior_runs_up_to_2h_only():
    x = np.array([0, np.nan, np.nan, 3, *[np.nan] * 9, 5, np.nan])
    b = bridge(x)
    assert b[1:3].tolist() == [1.0, 2.0]
    assert np.isnan(b[4:13]).all() and np.isnan(b[-1])  # 9-slot run and the edge stay missing


def test_slots_are_global_from_2018():
    assert (pd.Timestamp("2018-01-01 01:00") - EPOCH) // pd.Timedelta(minutes=15) == 4


# ---- county-events (protocol §7-8); MCC 100,000 gives T = 1,000 and a substantial floor of 5,000.
from .events import CENSORED_H, END_HOLD, HORIZON, county_event, find_events, held, milestone  # noqa: E402

MCC = 100_000


def curve(*segments: tuple[float, int]) -> np.ndarray:
    return np.concatenate([np.full(n, v, dtype=float) for v, n in segments])


def event(x: np.ndarray, lo: int = 10, hi: int = 50, raw: np.ndarray | None = None, **kw) -> dict:
    return county_event(x, x if raw is None else raw, MCC, lo, hi, **kw)


def test_held_level_is_a_forward_min_and_missing_poisons_it():
    h = held(np.array([5.0, 9, 9, 9, 9, np.nan, 9]), 4)
    assert h[0] == 5 and h[1] == 9 and np.isnan(h[2]) and np.isnan(h[-1])


def test_onset_is_at_or_above_T_and_a_missing_slot_breaks_the_end_run():
    x = curve((0, 20), (1000, 10), (0, 30), (np.nan, 1), (0, 60))
    (onset, end), = find_events(x, 1000, 0, 25)
    assert onset == 20 and end == 30 + 31  # the 12-h run starting at 30 is broken by the NaN at 60


def test_largest_one_hour_peak_wins_not_the_largest_single_slot():
    # First event: one 90k slot (raw max) but a 1-hour level of 10k. Second: 30k held for hours.
    first = curve((10_000, 3), (90_000, 1), (10_000, 3), (0, END_HOLD + 2))
    second = curve((30_000, 40), (0, 100))
    ev = event(np.r_[np.zeros(12), first, second], hi=80)
    assert ev["p1"] == 30_000 and ev["n_events"] == 2


def test_milestones_need_a_2h_hold_inside_the_window_and_censor_at_168_25():
    x = curve((0, 12), (20_000, 8), (5_000, 7), (20_000, 4), (5_000, 8), (0, 200))
    ev = event(x)
    assert ev["peak"] == 12
    assert ev["t50"] == (8 + 7 + 4) / 4  # the 7-slot dip to 5k is too short to count
    assert ev["t90"] == (8 + 7 + 4 + 8) / 4
    slow = event(curve((0, 12), (20_000, 20), (15_000, HORIZON + 50)))
    assert slow["status"] == "kept" and slow["t50"] == CENSORED_H and slow["never_ended"]


def test_c_is_cut_by_a_held_rise_after_the_end_but_not_by_a_one_slot_blip():
    base = [(0, 12), (20_000, 8), (0, 60)]
    blip = event(curve(*base, (5_000, 1), (0, 900)))
    assert blip["c"] == 12 + HORIZON and not blip["cut_early"]
    rise = event(curve(*base, (5_000, 4), (0, 900)))
    assert rise["c"] == 12 + 8 + 60 - 1 and rise["cut_early"]


def test_data_window_ends_before_the_countys_next_storm():
    from .checkpoint2 import DAY, pair_windows
    t = pd.Timestamp
    pairs = pd.DataFrame({
        "storm_id": ["A", "B", "A"], "fips": ["01001", "01001", "01003"],
        "begin": [t("2020-08-01"), t("2020-08-15"), t("2020-08-01")],
        "end": [t("2020-08-03"), t("2020-08-16"), t("2020-08-20")],
    })
    w = pair_windows(pairs).set_index(["storm_id", "fips"])
    a1, b1 = w.loc[("A", "01001"), ["hi", "b"]]
    assert b1 == w.loc[("B", "01001"), "lo"] - 1  # 12 days later: cut before B's onset window
    assert w.loc[("A", "01003"), "hi"] == w.loc[("A", "01001"), "lo"] + 9 * DAY  # end capped at begin + 7 d
    assert w.loc[("A", "01003"), "b"] == w.loc[("A", "01003"), "hi"] + 21 * DAY


def test_left_censored_sees_through_a_missing_first_slot_and_no_one_hour_level_is_no_peak():
    x = curve((3_000, 8), (np.nan, 4), (20_000, 20), (0, 300))
    assert event(x, lo=10)["status"] == "left_censored"
    assert event(curve((0, 12), (20_000, 1), (np.nan, 60)))["status"] == "no_peak"


def test_drop_order_and_reasons():
    assert county_event(np.zeros(10), np.zeros(10), None, 0, 5)["status"] == "no_mcc"
    assert event(np.zeros(300))["status"] == "no_event"
    assert event(curve((2_000, 40), (0, 300)))["status"] == "left_censored"  # already out at slot 10
    assert event(curve((0, 12), (4_000, 20), (0, 300)))["status"] == "not_substantial"  # < 5% of MCC
    spike = curve((0, 12), (8_000, 3), (30_000, 1), (8_000, 10), (0, 300))
    assert event(spike)["status"] == "spike"  # raw 30k > 2 x the 1-hour 8k
    resurge = curve((0, 12), (20_000, 8), (5_000, 10), (15_000, 6), (0, 300))
    assert event(resurge)["status"] == "resurge"


def test_coverage_counts_missing_before_bridging_inside_the_feature_window():
    x = curve((0, 12), (20_000, 8), (0, 900))
    raw = x.copy()
    raw[100:100 + 80] = np.nan  # 80 of the 673 window slots, about 12%
    assert event(x, raw=raw)["status"] == "coverage"
    raw2 = x.copy()
    raw2[100:100 + 60] = np.nan
    assert event(x, raw=raw2)["status"] == "kept"


def test_slow_events_are_kept_and_flagged_never_dropped():
    over = event(curve((0, 12), (150_000, 20), (0, 900)))
    assert over["status"] == "kept" and over["over_mcc"]


def test_read_year_accepts_the_2023_sum_column_and_both_time_formats(tmp_path):
    from .outages import read_year, slot_of
    (tmp_path / "a.csv").write_text(
        "fips_code,county,state,sum,run_start_time\n01001,A,Alabama,5,2023-01-01 00:07:00\n01001,A,Alabama,,2023-01-01 00:15:00\n")
    (tmp_path / "b.csv").write_text(
        "fips_code,county,state,customers_out,run_start_time,total_customers\n01003,B,Alabama,9,1/1/23 0:30,100\n")
    a, b = read_year(tmp_path / "a.csv"), read_year(tmp_path / "b.csv")
    s0 = slot_of(pd.Timestamp("2023-01-01"))
    assert a.slot.tolist() == [s0, s0 + 1] and a.cust[0] == 5 and np.isnan(a.cust[1])  # 00:07 floors to 00:00
    assert b.slot.tolist() == [s0 + 2] and b.cust[0] == 9
