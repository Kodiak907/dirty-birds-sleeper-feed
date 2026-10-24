#!/usr/bin/env python3
"""Phase VII consequence analysis: one-at-a-time missing-player scenarios.

These are conditional fantasy lineup effects, NOT predicted injuries or an
attempt to redistribute NFL targets without defensible team-level evidence.
"""
import datetime as dt,json
from pathlib import Path
from lineup_impact import build_lineup
D=Path(__file__).resolve().parent/"data"
def load(name):return json.loads((D/name).read_text(encoding="utf-8"))
def scenarios(roster,reserve,names,forecasts,unavailable=()):
 eligible=[str(pid) for pid in roster if str(pid) not in set(map(str,reserve))]
 excluded=set(map(str,unavailable))
 base=build_lineup(eligible,names,forecasts,excluded=excluded)
 results=[]
 for player in base.get("starters",[]):
  pid=player["id"]
  alternative=build_lineup(eligible,names,forecasts,excluded=excluded|{pid})
  if alternative.get("complete") and base.get("complete"):
   before={p["id"] for p in base["starters"]}
   after={p["id"] for p in alternative["starters"]}
   delta=round(alternative["ppg"]-base["ppg"],2)
  else:after=set();before=set();delta=None
  results.append({"player_id":pid,"player":player["name"],
   "hypothetical_event":"starter becomes unavailable",
   "projected_points_difference":delta,
   "replacement_names":[p["name"] for p in alternative.get("starters",[]) if p["id"] not in before],
   "complete":bool(alternative.get("complete")),
   "is_real_injury_news":False})
 return base,results
def main():
 snap=load("latest.json");names=load("player_names.json")
 predictions=load("ros_projections.json")["players"]
 board=load("GAMEDAY_DECISION.json")
 roster=next(r for r in snap["rosters"] if r["roster_id"]==1)
 ids=[str(x) for x in roster["players"]]
 week=int(snap["nfl_state"]["week"])
 forecast={}
 for pid in ids:
  name=names.get(pid,{}).get("name")
  point=(predictions.get(name,{ }).get("weeks") or {}).get(str(week))
  if isinstance(point,(int,float)) and not isinstance(point,bool):
   forecast[name]={"ppg":point}
 base,items=scenarios(ids,roster.get("reserve") or [],names,forecast,
    unavailable=board.get("explicit_excluded_ids") or [])
 out={"generated_at_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
  "week":week,"baseline_ppg":base.get("ppg"),"scenario_count":len(items),
  "one_player_unavailable_scenarios":items,
  "limitations":["Each scenario assumes exactly one additional player unavailable; it is not a news alert.",
  "No speculative redistribution of another NFL player's carries, snaps, or targets.",
  "Projections are not verified active designations. Fantasy reserve remains excluded.",
  "Never trigger Sleeper transactions or start/sit changes."]}
 (D/"GAMEDAY_INJURY_SCENARIOS.json").write_text(json.dumps(out,indent=2,sort_keys=True)+"\n")
 lines=["# Dirty Birds — Conditional Injury Impact Scenarios","",
  f"Week {week}; generated {out['generated_at_utc']}","",
  "**All rows hypothetical. None claims a new injury.**","",
  "| Hypothetically unavailable | Model point change | Conditional replacement |",
  "|---|---:|---|"]
 for item in items:
  delta=item["projected_points_difference"]
  lines.append("| "+item["player"]+" | "+(f"{delta:+.2f}" if delta is not None else "Incomplete")+" | "+(", ".join(item["replacement_names"]) or "No complete replacement")+" |")
 lines+=["","No player is being recommended to start or sit; this is conditional model sensitivity only.",
  "Neither NFL opportunity redistribution nor official actives are implied."]
 (D/"GAMEDAY_INJURY_SCENARIOS.md").write_text("\n".join(lines)+"\n")
 print("Conditional absence sensitivity scenarios:",len(items))
if __name__=="__main__":main()
