#!/usr/bin/env python3
"""Generate verified-ownership waiver watchlist and transparent data coverage.

No ranking pretends to know future value: when sourced projections/usage are absent,
candidates are categorized for review, not assigned invented 'best pickup' scores.
"""
import json,datetime as dt
from pathlib import Path
DATA=Path(__file__).resolve().parent/"data"
def read(n,default): 
 p=DATA/n
 return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default
def put(n,obj):
 (DATA/n).write_text(json.dumps(obj,ensure_ascii=False,indent=2,sort_keys=True)+"\n",encoding="utf-8")
def main():
 snap=read("latest.json",{})
 meta=read("player_metadata.json",{})
 metrics=read("external_metrics.json",{})
 projections=read("ros_projections.json",{})
 if not snap.get("rosters") or not meta:raise ValueError("Sleeper snapshot or player_metadata.json unavailable. Run update.py first.")
 owned={str(pid) for r in snap["rosters"] for pid in r.get("players") or []}
 # The matchup ledger only measures players appearing on fantasy rosters that week.
 weekly={}
 w=int((snap.get("nfl_state") or {}).get("week",1))
 for wi in range(1,w):
  for m in snap.get("matchups_by_week",{}).get(str(wi),[]) or []:
   for pid,value in (m.get("players_points") or {}).items():
    weekly.setdefault(str(pid),{})[wi]=float(value)
 source_date=(projections.get("as_of") or None)
 external=metrics.get("players") or {}
 proj=projections.get("players") or {}
 candidates=[]
 for pid,p in meta.items():
  if pid in owned or p.get("position") not in ("QB","RB","WR","TE","K","DEF"):continue
  if not p.get("active") and p.get("position")!="DEF":continue
  name=p.get("name") or pid
  x=external.get(pid,external.get(name,{}))
  y=proj.get(name,{})
  points=list(weekly.get(pid,{}).values())
  candidates.append({"id":pid,"name":name,"position":p["position"],"nfl_team":p.get("team"),
    "sleeper_status":p.get("status"),"sleeper_injury_status":p.get("injury_status"),
    "depth_chart_order":p.get("depth_chart_order"),
    "fantasy_week_observations":len(points),"fantasy_points_observed":round(sum(points),2),
    "usage":x,"projection":y if projections.get("scoring")=="half_ppr" else {},
    "has_sourced_projection":isinstance(y.get("ppg"),(float,int)) and bool(projections.get("source")),
    "has_sourced_usage":bool(x.get("source")) and bool(x.get("as_of")),
    "quality":"reviewable" if (isinstance(y.get("ppg"),(float,int)) and bool(projections.get("source")) and bool(x.get("source")) and bool(x.get("as_of"))) else "insufficient_independent_data"})
 # An available player may appear nowhere in completed fantasy matchup records.
 # Do not sort by historic fantasy points as if this were a free-agent ranking.
 candidates.sort(key=lambda p:(p["position"],p["name"]))
 utc=dt.datetime.now(dt.timezone.utc).isoformat()
 out={"generated_at_utc":utc,"sleeper_snapshot_utc":snap.get("fetched_at_utc"),
  "projection_source":projections.get("source"),"projection_as_of":source_date,
  "usage_source":metrics.get("source"),"usage_as_of":metrics.get("as_of"),
  "ownership_definition":"Not on any of 12 Sleeper roster players arrays at the saved snapshot.",
  "warning":"Eligibility, pending claims, games already played and league waivers must be checked in Sleeper before pickup.",
  "ranked":False,"candidates":candidates}
 put("waiver_watchlist.json",out)
 c={k:sum(p["position"]==k for p in candidates) for k in ("QB","RB","WR","TE","K","DEF")}
 complete=sum(p["quality"]=="reviewable" for p in candidates)
 lines=["# Dirty Birds — Waiver Intelligence Watchlist","",
  f"Generated: {utc}",f"Sleeper snapshot: {snap.get('fetched_at_utc')}","",
  "**Ownership verified against Sleeper. Future-value ranking withheld until sources are complete.**","",
  "| Position | Available candidates |","|---|---:|"]
 lines += [f"| {k} | {v} |" for k,v in c.items()]
 lines+=["",f"Candidates with independently sourced projections AND usage data: **{complete}**",
  "","## Coverage and rules","",
  "- Sleeper injury/status and depth-chart fields are descriptive and may lag official NFL reports.",
  "- Historical fantasy points are incomplete for players not rostered in prior weeks; missing is not zero.",
  "- Durability requires games active/missed, injury reports and workload trends; no automatic prediction of future injury.",
  "- Candidate list does not assert free-agent bidding eligibility or that pending claims will clear.",
  "- Players are not sorted by value without verified projection and snap/target/route data.",
  "- No claims, cuts, FAAB bids or trades are submitted.",
  "","Detailed candidate metadata: `data/waiver_watchlist.json`."]
 (DATA/"WAIVER_WATCHLIST.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
 print(f"Waiver watchlist: {len(candidates)} available, {complete} with verified projection+usage")
if __name__=="__main__":main()
