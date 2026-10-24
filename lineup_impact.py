#!/usr/bin/env python3
"""Exact legal two-FLEX lineup optimizer, projected weekly pickup/drop comparisons.

Read-only. A single aggregate PPG cannot assess injury activation, byes or future volatility.
"""
import json,datetime as dt
from pathlib import Path
from itertools import combinations
D=Path(__file__).resolve().parent/"data"
SLOTS={"QB":1,"RB":2,"WR":2,"TE":1,"K":1,"DEF":1}
def read(n):return json.loads((D/n).read_text(encoding="utf8"))
def build_lineup(ids,names,projected,excluded=None):
 excluded=set(excluded or ())
 players=[]
 missing=[]
 for pid in ids:
  if pid in excluded:continue
  meta=names.get(str(pid),{})
  pos=meta.get("position")
  if pos not in SLOTS:continue
  proj=projected.get(meta.get("name"),{})
  ppg=proj.get("ppg")
  if not isinstance(ppg,(int,float)) or isinstance(ppg,bool):
   missing.append(meta.get("name",str(pid)));continue
  players.append({"id":str(pid),"name":meta["name"],"position":pos,"ppg":float(ppg)})
 bypos={pos:sorted([p for p in players if p["position"]==pos],key=lambda p:-p["ppg"]) for pos in SLOTS}
 core=[]
 for pos,n in SLOTS.items():
  if len(bypos[pos])<n:
   return {"complete":False,"reason":"Required position unavailable: "+pos,"missing_projection":missing}
  core.extend(bypos[pos][:n])
 used={p["id"] for p in core}
 flex=sorted((p for p in players if p["position"] in ("RB","WR","TE") and p["id"] not in used),key=lambda p:-p["ppg"])[:2]
 if len(flex)<2:return {"complete":False,"reason":"Two FLEX options unavailable","missing_projection":missing}
 starters=core+flex
 return {"complete":True,"ppg":round(sum(p["ppg"] for p in starters),3),
 "starters":starters,"missing_projection":missing}
def evaluate(roster,candidate,drop,names,projections):
 before=build_lineup(roster,names,projections)
 after=build_lineup([pid for pid in roster if pid!=drop]+[candidate],names,projections)
 if not before["complete"] or not after["complete"]:return None
 b={p["id"] for p in before["starters"]}
 a={p["id"] for p in after["starters"]}
 return {"projected_lineup_gain_ppg":round(after["ppg"]-before["ppg"],3),
 "before_ppg":before["ppg"],"after_ppg":after["ppg"],
 "added_starters":[p["name"] for p in after["starters"] if p["id"] not in b],
 "displaced_starters":[p["name"] for p in before["starters"] if p["id"] not in a]}
def main():
 latest=read("latest.json")
 names=read("player_names.json")
 projection=read("ros_projections.json")
 waiver=read("waiver_watchlist.json")
 metrics=read("external_metrics.json")
 my=next(r for r in latest["rosters"] if r["roster_id"]==1)
 roster=[str(x) for x in my["players"]]
 reserved={str(x) for x in my.get("reserve") or []}
 owned={str(pid) for r in latest["rosters"] for pid in r.get("players") or []}
 pp=projection["players"]
 before=build_lineup(roster,names,pp)
 if not before["complete"]:raise ValueError("Dirty Birds lineup not complete: "+str(before))
 results={}
 for pos in ("QB","RB","WR","TE","K","DEF"):
  entries=[]
  pool=[p for p in waiver["candidates"] if p["position"]==pos and p["id"] not in owned
     and p.get("has_sourced_projection") and p.get("projection",{}).get("coverage_fraction",0)>=0.7]
  for cand in pool:
   pid=cand["id"]
   # Compare explicit drops only; never assume IR-stash or active roster eligibility.
   options=[]
   for drop in roster:
    sim=evaluate(roster,pid,drop,names,pp)
    if sim is None:continue
    options.append({"drop":names.get(drop,{}).get("name",drop),"drop_id":drop,
      "drop_is_fantasy_reserve":drop in reserved,**sim})
   if not options:continue
   options.sort(key=lambda o:o["projected_lineup_gain_ppg"],reverse=True)
   best=options[0]
   injury=str(cand.get("sleeper_injury_status") or "").lower()
   warnings=[]
   if injury in ("ir","pup","out","doubtful","questionable","sus","suspended"):warnings.append("Availability status: "+injury)
   if not cand.get("has_sourced_usage"):warnings.append("No sourced usage")
   if cand["projection"].get("coverage_fraction",0)<0.9:warnings.append("Partial projection coverage")
   if cand.get("usage",{}).get("weeks_with_snap_data",0)<2 and pos in ("QB","RB","WR","TE"):warnings.append("Limited snap sample")
   if best["drop_is_fantasy_reserve"]:warnings.append("Proposed cut is on fantasy reserve; roster rules require review")
   entries.append({"candidate":cand["name"],"candidate_id":pid,"team":cand.get("nfl_team"),
    "position":pos,"projection_ppg":cand["projection"]["ppg"],
    "best_candidate_drop":best,"candidate_drop_options":options[:8],
    "warnings":warnings,
    "not_adjusted_for":"injuries, route share, matchup difficulty, roster lock, waiver status, FAAB or playoff-week volatility"})
  entries.sort(key=lambda e:(e["best_candidate_drop"]["projected_lineup_gain_ppg"],e["projection_ppg"]),reverse=True)
  results[pos]=entries[:20]
 now=dt.datetime.now(dt.timezone.utc).isoformat()
 output={"generated_at_utc":now,"sleeper_snapshot_utc":latest.get("fetched_at_utc"),
 "source_projection_date":projection.get("as_of"),
 "model":"Exact 1QB/2RB/2WR/1TE/2FLEX/K/DEF lineup; swap one acquired candidate for one currently owned player.",
 "limitations":["Averages over explicitly projected weeks, not week-specific starting projections.",
 "Drop comparison is hypothetical; do not cut injured stashes or IR players on this model alone.",
 "A tiny gain is not an endorsement. No automatic pickup decisions or FAAB bids.",
 "Cumulative two-FLEX impact is recalculated but future schedules and injuries are not weighted."],
 "baseline_lineup":before,"by_position":results}
 (D/"LINEUP_IMPACT.json").write_text(json.dumps(output,indent=2,ensure_ascii=False,sort_keys=True)+"\n")
 lines=["# Dirty Birds — Two-FLEX Waiver Lineup Impact","",f"Generated: {now}",
 "**Read-only hypothetical screening; NOT add/drop instructions or verified weekly forecasts.**","",
 f'Baseline illustrative optimal PPG: **{before["ppg"]:.2f}**. Weeks with partial projections and injury status require manual verification.',""]
 for pos,entries in results.items():
  lines.extend([f"## {pos}","",
   "| # | Free agent | PPG | Best hypothetical cut | Lineup gain | Flags |",
   "|---:|---|---:|---|---:|---|"])
  for i,e in enumerate(entries[:12],1):
   b=e["best_candidate_drop"];warning="; ".join(e["warnings"]) or "No flagged data gap; review still required"
   lines.append(f'| {i} | {e["candidate"]} | {e["projection_ppg"]:.2f} | {b["drop"]} | {b["projected_lineup_gain_ppg"]:+.2f} | {warning} |')
  lines.append("")
 lines+=["## Before making any claim","",
 "- Review the proposed cut, fantasy IR, current practice/injury status and whether the player is currently claimable.",
 "- Compare weekly, bye and playoff scenarios, not just aggregate per-game forecasts.",
 "- A zero projected lineup gain may still provide depth or injury insurance; this board cannot value that reliably.",
 "- No player will be cut or claimed by this process."]
 (D/"LINEUP_IMPACT.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
 print("Two-FLEX lineup impact generated", {k:len(v) for k,v in results.items()})
if __name__=="__main__":main()
