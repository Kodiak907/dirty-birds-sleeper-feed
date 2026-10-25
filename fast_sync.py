#!/usr/bin/env python3
"""Small read-only Sleeper snapshot, independent of hourly research jobs."""
import datetime
import json
import os
import pathlib
import urllib.request

LEAGUE_ID = os.getenv("SLEEPER_LEAGUE_ID", "1399157532559192064")
BASE = "https://api.sleeper.app/v1/"
OUT = pathlib.Path(__file__).parent / "data" / "fast_latest.json"

def read(path):
    request = urllib.request.Request(BASE + path, headers={
        "Accept": "application/json", "User-Agent": "DirtyBirdsFastSync/1.0"
    })
    with urllib.request.urlopen(request, timeout=25) as response:
        return json.load(response)

def main():
    league = read(f"league/{LEAGUE_ID}")
    if str(league.get("league_id")) != LEAGUE_ID:
        raise RuntimeError("Sleeper returned incorrect league")
    rosters = read(f"league/{LEAGUE_ID}/rosters")
    users = read(f"league/{LEAGUE_ID}/users")
    nfl_state = read("state/nfl")
    week = int(nfl_state.get("week") or nfl_state.get("display_week") or 1)
    transactions = {
        str(w): read(f"league/{LEAGUE_ID}/transactions/{w}")
        for w in sorted(set([0, max(1,week-1),week]))
    }
    payload = {
        "schema_version": 1,
        "source": "Sleeper public read-only API",
        "fetched_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "league_id": LEAGUE_ID, "league": league, "rosters": rosters,
        "users": users, "nfl_state": nfl_state,
        "transactions_by_week": transactions,
        "transactions_scope": "weeks 0, previous, current (not full-season history)"
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Fast Sleeper feed: {len(rosters)} rosters, week {week}")

if __name__ == "__main__":
    main()
