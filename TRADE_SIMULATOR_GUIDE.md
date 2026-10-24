# Phase V — Trade What-If Simulator

This is a **read-only research tool**. It never submits Sleeper transactions, proposals or offers.

The hourly workflow already runs `valuation.py`, publishing `data/VALUATION.md` and `data/valuation_latest.json`. These show **historical** Weeks 1–6 scoring, NOT forward-looking valuations.

## Trade simulator (manual, on demand)

```bash
python trade_simulator.py --give "Patrick Mahomes" --receive "Jaylen Waddle" --projections data/ros_projections.json
```

The simulator accepts only players in `data/player_names.json` and enforces that the players given are on Dirty Birds and those received come from one opposing roster. It calculates lineup PPG for both teams before and after an exchange under 1 QB / 2 RB / 2 WR / 1 TE / 2 FLEX / K / D/ST.

**Do not generate projections by labeling historical averages as forecasts.** Create the input from a named, dated external half-PPR projection source, with an independent injury and role review. No projections are fabricated or automatically fetched.

Example structure (illustrative format; values below are placeholders and MUST be replaced with verified sourced data before execution):

```json
{
  "as_of": "SOURCE_DATE",
  "scoring": "half_ppr",
  "source": "PROJECTION_PROVIDER_AND_URL",
  "players": {
    "Player Name": {"ppg": 0, "status": "unverified", "games_remaining": 0}
  }
}
```

Complete coverage is required for *every player* on both involved rosters, and the tool rejects missing inputs rather than inventing them. The `status` field is metadata only; it does not automatically adjust `ppg`. Only run a comparison when inputs reflect the verified availability and realistic use for every player. Validate bye weeks and injury risk manually; the current PPG model does not simulate those.

The output includes projected before/after starting lineup totals for both teams and resulting differences. It is not a fair-trade determination: counterparty willingness, lineup changes, future games and variance require separate analysis. Unequal player counts may require a roster cut, not modeled here.

## Current inputs
- `data/latest.json`: current rosters and league settings.
- `data/player_names.json`: current named players.
- `data/VALUATION.md`: historical production research.
- `data/TRADE_MARKET.md`: roster supply and completed-trade count.

**No offer is active and the simulator sends nothing to Sleeper.**
