#!/usr/bin/env python3
"""FFO decision-quality board: replacement-value screening, evidence gates, NO automated moves."""
import json,datetime as dt,statistics
from pathlib import Path
D=Path(__file__).resolve().parent/"data"
def read(f):return json.loads((D/f).read_text(encoding="utf-8"))
def isnum(v):return isinstance(v,(int,float)) and not isinstance(v,bool)
def inspect(player,meta,usage):
 p=player["projection"]
 x=player["usage"]
 pos=player["position"]
 injury=(player.get("sleeper_injury_status") or "").lower()
 observations=x.get("recent_three_snap_pct") or []
 snap=x.get("snap_share_pct")
 coverage=p.get("coverage_fraction",0)
 flags=[]
 if injury in ("ir","pup","out","doubtful","questionable","suspended","sus"):flags.append("sleeper_injury_"+injury)
 if not isnum(snap) and pos in ("QB","RB","WR","TE"):flags.append("snap_data_missing")
 if not x.get("weeks_with_snap_data") and pos in ("QB","RB","WR","TE"):flags.append("usage_sample_missing")
 if isnum(coverage) and coverage<0.8:flags.append("projection_weeks_partial")
 if pos in ("RB","WR","TE"):
  if not isnum(x.get("targets_per_game")) and pos in ("WR","TE"):flags.append("targets_missing")
  if not isnum(x.get("rush_attempts_per_game")) and pos=="RB":flags.append("carries_missing")
 if x.get("injury_report_record") and x["injury_report_record"].get("report_status"):flags.append("injury_report_observation_review")
 change=(observations[-1]-observations[0]) if len(observations)>=3 and all(isnum(v) for v in observations[-3:]) else None
 return {"flags":flags,"snap_trend_3_appearances_pp":round(change,1) if change is not None else None,
   "recent_snap_pct":snap,"targets_per_game":x.get("targets_per_game"),
   "carries_per_game":x.get("rush_attempts_per_game"),
   "injury_report_observation":x.get("injury_report_record"),
   "projection_coverage":coverage,
   "not_an_injury_probability":True}
def main():
 data=read("waiver_watchlist.json")
 snap=read("latest.json")
 names=read("player_names.json")
 projections=read("ros_projections.json")
 owned=next(r for r in snap["rosters"] if r["roster_id"]==1)["players"]
 mine={}
 for pid in owned:
  p=names.get(str(pid),{})
  pos=p.get("position")
  value=projections.get("players",{}).get(p.get("name"),{})
  if pos and isnum(value.get("ppg")):
   mine.setdefault(pos,[]).append({"name":p["name"],"ppg":value["ppg"]})
 for pos in mine:mine[pos].sort(key=lambda r:r["ppg"],reverse=True)
 def baseline(pos):
  # Screening against the last current player at this position, NOT waiver-drop advice.
  group=mine.get(pos,[])
  return group[-1] if group else None
 result={"generated_at_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
  "snapshot_utc":snap.get("fetched_at_utc"),
  "method":"Same-position projection uplift vs lowest projected rostered player, with usage/injury verification gates. Not final add/drop decisions.",
  "risk_policy":"Do not assign made-up injury probabilities. Publish missing data and official injury observations as flags.",
  "rankings":{},"current_roster_reference":{pos:baseline(pos) for pos in ("QB","RB","WR","TE","K","DEF")}}
 lines=["# Dirty Birds — Decision Quality Waiver Board","",
        "Ownership: Sleeper snapshot. Projections: dated Sleeper ROS weekly estimates. Usage: nflverse reported snaps/targets/carries.","",
        "**Screening only. No injury probabilities or automated roster decisions.**",
        "Same-position uplift measures only potential replacement of the lowest-projected current rostered player, not actual optimal 2-FLEX lineup gain.",""]
 for pos in ("QB","RB","WR","TE","K","DEF"):
  candidates=[p for p in data["candidates"] if p["position"]==pos and p["has_sourced_projection"] and
          p["projection"].get("coverage_fraction",0)>=0.7]
  baseline_player=baseline(pos)
  enriched=[]
  for p in candidates:
   audit=inspect(p,None,None)
   estimate=float(p["projection"]["ppg"])
   uplift=round(estimate-baseline_player["ppg"],2) if baseline_player else None
   enriched.append({"name":p["name"],"sleeper_id":p["id"],"team":p["nfl_team"],
     "ppg":round(estimate,2),"same_position_uplift_ppg":uplift,
     "replacement_reference":baseline_player,
     "audit":audit,"screen_only":True})
  enriched.sort(key=lambda x:(x["same_position_uplift_ppg"] if x["same_position_uplift_ppg"] is not None else x["ppg"]),reverse=True)
  result["rankings"][pos]=enriched[:25]
  reference=(f'{baseline_player["name"]} ({baseline_player["ppg"]:.2f} PPG)' if baseline_player else "No roster reference")
  lines.extend([f"## {pos} — reference: {reference}","",
    "| # | Player | ROS PPG | Same-pos uplift | Snaps | Workload | Flags |",
    "|---:|---|---:|---:|---:|---|---|"])
  for i,p in enumerate(enriched[:12],1):
   a=p["audit"]
   snapstr=f'{a["recent_snap_pct"]:.1f}%' if isnum(a["recent_snap_pct"]) else "—"
   work=f'Tgt {a["targets_per_game"]:.1f}' if isnum(a["targets_per_game"]) and pos in ("WR","TE") else (f'Carries {a["carries_per_game"]:.1f}' if isnum(a["carries_per_game"]) and pos=="RB" else "—")
   delta=f'{p["same_position_uplift_ppg"]:+.2f}' if p["same_position_uplift_ppg"] is not None else "—"
   flags=", ".join(a["flags"]) if a["flags"] else "No modeled flags (not medically cleared)"
   lines.append(f'| {i} | {p["name"]} | {p["ppg"]:.2f} | {delta} | {snapstr} | {work} | {flags} |')
  lines.append("")
 lines.extend(["## Decision gates","",
   "1. Re-check actual Sleeper waiver availability and pending claims immediately before bidding.",
   "2. Independently verify latest NFL practice status, active designation, QB and snap-role changes.",
   "3. Compare the exact two-FLEX lineup gain, not only the worst same-position bench projection.",
   "4. Evaluate FAAB opportunity cost and the actual player to cut. No automatic FAAB bid recommended.",
   "5. Use published projection PPG as a baseline, not a calibrated probability of future production.",
   "6. Injury-report flags and past injuries never establish a numerical future injury probability.",
   "","Data: `data/decision_board.json`. No transactions performed."])
 (D/"decision_board.json").write_text(json.dumps(result,ensure_ascii=False,indent=2,sort_keys=True)+"\n",encoding="utf-8")
 (D/"DECISION_BOARD.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
 print("Decision board ready:",{k:len(v) for k,v in result["rankings"].items()})
if __name__=="__main__":main()
