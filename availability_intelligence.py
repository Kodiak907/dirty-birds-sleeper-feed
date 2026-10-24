#!/usr/bin/env python3
"""Dirty Birds Phase VII read-only injury/role-watch.

Uses dated Sleeper status and nflverse observations. Alerts on observed changes,
not injury predictions. Absence of injury records is NOT clearance.
"""
import json,datetime as dt
from pathlib import Path
D=Path(__file__).resolve().parent/"data"
def load(name,default=None):
 p=D/name
 return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default
def save(name,obj):
 (D/name).write_text(json.dumps(obj,indent=2,ensure_ascii=False,sort_keys=True)+"\n",encoding="utf-8")
def main():
 latest=load("latest.json",{})
 names=load("player_metadata.json",{})
 metrics=load("external_metrics.json",{})
 previous=load("AVAILABILITY_STATE.json",{"players":{}})
 if not latest.get("rosters") or not names:raise ValueError("Sleeper roster or player metadata missing")
 now=dt.datetime.now(dt.timezone.utc).isoformat()
 rosters=latest["rosters"]
 owned={str(pid):r["roster_id"] for r in rosters for pid in r.get("players") or []}
 mine=next(r for r in rosters if r["roster_id"]==1)
 myids={str(i) for i in mine.get("players") or []}
 watch={pid for pid in owned if pid in names}
 # Include free agents with ROS projection coverage for potential waiver role breakouts.
 projections=load("ros_projections.json",{}).get("players",{})
 for pid,p in names.items():
  proj=projections.get(p.get("name"),{})
  if pid not in owned and p.get("position") in ("RB","WR","TE","QB") and proj.get("coverage_fraction",0)>=0.7:watch.add(pid)
 current={};alerts=[]
 for pid in sorted(watch):
  p=names.get(pid,{})
  m=(metrics.get("players") or {}).get(pid,{})
  injury=p.get("injury_status") or None
  status=p.get("status") or None
  report=m.get("injury_report_record") or {}
  snaplist=m.get("recent_three_snap_pct") or []
  snap_week=m.get("latest_snap_week")
  cur={"name":p.get("name",pid),"position":p.get("position"),"team":p.get("team"),
   "fantasy_owner_roster_id":owned.get(pid),"sleeper_injury_status":injury,"sleeper_status":status,
   "injury_report":report,"snap_share_pct":m.get("snap_share_pct"),
   "latest_snap_week":snap_week,"recent_snap_percentages":snaplist,
   "targets_per_game":m.get("targets_per_game"),
   "carries_per_game":m.get("rush_attempts_per_game"),
   "report_source_as_of":m.get("as_of"),
   "sleeper_snapshot_utc":latest.get("fetched_at_utc")}
  current[pid]=cur
  prior=(previous.get("players") or {}).get(pid)
  def signal(kind,message,severity):
   alerts.append({"player_id":pid,"player":cur["name"],"team":cur["team"],
    "position":cur["position"],"owned_by_dirty_birds":pid in myids,
    "fantasy_roster_id":owned.get(pid),"kind":kind,"severity":severity,
    "message":message,"observed_at_utc":now,
    "source_as_of":m.get("as_of") if kind.startswith(("injury_report","snap")) else latest.get("fetched_at_utc")})
  if prior:
   for key,label in (("sleeper_injury_status","Sleeper injury designation"),("sleeper_status","Sleeper status")):
    if cur[key]!=prior.get(key):
     signal("sleeper_status_change",f"{label}: {prior.get(key) or 'not listed'} → {cur[key] or 'not listed'}","review")
   if report and report!=prior.get("injury_report") and report.get("week") is not None:
    signal("injury_report_update",f"Published injury/practice report changed: {report}","review")
   if snap_week is not None and prior.get("latest_snap_week")!=snap_week and len(snaplist)>=3:
    before=snaplist[-2];after=snaplist[-1]
    if isinstance(before,(int,float)) and isinstance(after,(int,float)) and abs(after-before)>=15:
     direction="rose" if after>before else "fell"
     signal("snap_share_change",f"Snap share {direction} {abs(after-before):.1f} percentage points between last two recorded appearances (week {snap_week}); confirm role/injury context.","review")
  if pid in myids and str(injury or "").lower() in ("out","ir","pup","doubtful","sus","suspended"):
   # A standing watch flag, never misrepresented as a newly changed official injury.
   cur["standing_availability_flag"]="Verify official NFL roster and game status before lineup decisions"
 report_loaded=(metrics.get("data_status") or {}).get("injuries",{}).get("loaded")
 out={"generated_at_utc":now,"sleeper_snapshot_utc":latest.get("fetched_at_utc"),
  "source_metrics_as_of":metrics.get("as_of"),"injury_feed_loaded":report_loaded,
  "initial_baseline":not bool(previous.get("players")),
  "alerts":sorted(alerts,key=lambda v:(not v["owned_by_dirty_birds"],v["player"])),
  "dirty_birds_watch":[{"id":pid,**current[pid]} for pid in sorted(myids) if pid in current],
  "caveats":["Source injury observations can be delayed and are not official game-day inactives.",
  "NFL IR is separate from fantasy reserve; fantasy reserve membership is not an injury status.",
  "A missing injury report or blank designation does NOT mean healthy.",
  "Snap change is observed role change only, not an injury-risk score.",
  "On first baseline run historical changes cannot be inferred. No alerts are fabricated.",
  "No changes to fantasy rosters, starters, trades or waiver claims."]}
 save("AVAILABILITY_INTELLIGENCE.json",out)
 save("AVAILABILITY_STATE.json",{"as_of":now,"players":current})
 lines=["# Dirty Birds — Phase VII Availability and Workload Watch","",
 f"Generated: {now}",f"Sleeper snapshot: {latest.get('fetched_at_utc')}",
 f"nflverse observations: {metrics.get('as_of')}; injury feed loaded: {report_loaded}","",
 f"**New observed changes:** {len(alerts)}. Initial baseline: {out['initial_baseline']}.","",
 "## Dirty Birds watchlist","",
 "| Player | Sleeper injury tag | Official report observation | Snap % (last 3 appearances) | Notes |",
 "|---|---|---|---:|---|"]
 for player in out["dirty_birds_watch"]:
  ir=player.get("injury_report") or {}
  note=player.get("standing_availability_flag") or "Verify current status before kickoff"
  summary=", ".join(str(ir.get(k)) for k in ("report_status","practice_status","report_primary_injury") if ir.get(k)) or "No matched report (not clearance)"
  pct=player.get("snap_share_pct")
  lines.append(f'| {player["name"]} | {player["sleeper_injury_status"] or "No tag"} | {summary} | {f"{pct:.1f}%" if isinstance(pct,(int,float)) else "—"} | {note} |')
 lines+=["","## Changes since last published snapshot",""]
 if not alerts:lines+=["No verified changes detected since last stored baseline. This is not proof that no NFL news occurred.",""]
 for a in out["alerts"][:60]:
  lines.append(f'- **{a["player"]}** ({a["kind"]}): {a["message"]}')
 lines+=["","## Guardrails","",
 "- Sleeper and nflverse observations are not a substitute for official actives/inactives.",
 "- No predicted injury probabilities are claimed.",
 "- Fantasy reserve and NFL injury lists are distinct.",
 "- A timestamped feed may lag breaking news.",
 "- No transactions or lineup changes are executed."]
 (D/"AVAILABILITY_INTELLIGENCE.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
 print("Phase VII watched:",len(current),"new changes:",len(alerts),"initial baseline:",out["initial_baseline"])
if __name__=="__main__":main()
