#!/usr/bin/env python3
"""Read-only locked lineup decision audit. No hindsight lineup selection.

A model lineup is archived ONLY before the earliest NFL kickoff in that week.
Actual fantasy starters and their scores are retrieved AFTER week completion.
Results are retrospective comparisons, not a causal claim the GM should have
started that lineup: roster state and injury news can change after the lock.
"""
import csv,datetime as dt,io,json,urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo
from weekly_lineups import weekly_lineup

DATA=Path(__file__).resolve().parent/"data"
ARCHIVE=DATA/"decision_archive"
URL="https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv"

def load(path):return json.loads(path.read_text(encoding="utf-8"))
def save(path,obj):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(obj,indent=2,sort_keys=True)+"\n",encoding="utf-8")
def valid_time(value):
 try:return dt.datetime.fromisoformat(value.replace("Z","+00:00")).astimezone(dt.timezone.utc)
 except (ValueError,AttributeError):return None
def kickoff_times(season):
 request=urllib.request.Request(URL,headers={"User-Agent":"DirtyBirdsFFO/1.0"})
 with urllib.request.urlopen(request,timeout=40) as handle:
  rows=csv.DictReader(io.StringIO(handle.read().decode("utf-8-sig")))
  out={}
  for row in rows:
   if str(row.get("season"))!=str(season) or row.get("game_type") not in ("REG","regular"):continue
   date,time=row.get("gameday"),row.get("gametime")
   try:
    event=dt.datetime.fromisoformat(date+"T"+time).replace(tzinfo=ZoneInfo("America/New_York")).astimezone(dt.timezone.utc)
    week=int(row["week"])
   except (ValueError,TypeError,KeyError):continue
   out.setdefault(week,[]).append(event)
 return {week:min(times) for week,times in out.items()}
def isnum(value):return isinstance(value,(float,int)) and not isinstance(value,bool)
def capture(latest,names,projection,kickoffs,now):
 roster=next(r for r in latest["rosters"] if r["roster_id"]==1)
 league_week=int(latest["nfl_state"]["week"])
 forecast_time=valid_time(projection.get("as_of"))
 snapshots=[]
 for week in range(league_week,18):
  kickoff=kickoffs.get(week)
  if not kickoff or now>=kickoff or not forecast_time or forecast_time>now or forecast_time>=kickoff:continue
  path=ARCHIVE/f"week_{week:02d}_decision.json"
  if path.exists():continue
  reserve=set(str(x) for x in (roster.get("reserve") or []))
  roster_ids=[str(pid) for pid in (roster.get("players") or [])]
  eligible=[pid for pid in roster_ids if pid not in reserve]
  recommended=weekly_lineup(eligible,names,projection["players"],week)
  if not recommended.get("complete"):continue
  payload={
   "week":week,"season":int(latest["nfl_state"]["season"]),"captured_at_utc":now.isoformat(),
   "earliest_league_game_utc":kickoff.isoformat(),
   "projection_as_of":projection["as_of"],"roster_snapshot_utc":latest.get("fetched_at_utc"),
   "locked_roster_ids":roster_ids,"excluded_fantasy_reserve_ids":sorted(reserve),
   "model_version":"ffo_weekly_decision_v1","lineup":recommended,
   "comparison_policy":"Evaluate only after completed week and only if selected players appeared on Dirty Birds game-week roster.",
   "reliability_warning":"Early locked forecast only; later injury/role changes may make it unactionable."
  }
  save(path,payload);snapshots.append(week)
 return snapshots

def assess(latest,kickoffs,now):
 latest_week=int(latest["nfl_state"]["week"])
 evaluations=[]
 pending=[]
 for file in sorted(ARCHIVE.glob("week_*_decision.json")):
  item=load(file);week=int(item["week"])
  if now<=kickoffs.get(week,now):pending.append(week);continue
  if week>=latest_week:pending.append(week);continue
  actual=next((r for r in latest.get("matchups_by_week",{}).get(str(week),[]) if r.get("roster_id")==1),None)
  if not actual or not isinstance(actual.get("players_points"),dict):continue
  actual_scores=actual["players_points"]
  proposed=item["lineup"]["starters"]
  proposed_ids=[p["id"] for p in proposed]
  official_ids=[str(v) for v in (actual.get("starters") or [])]
  gameweek_owned={str(x) for x in actual.get("players") or []}
  if len(proposed_ids)!=10 or len(official_ids)!=10:continue
  if any(pid not in gameweek_owned for pid in proposed_ids): 
   evaluations.append({"week":week,"status":"not_comparable_roster_changed",
    "reason":"One or more frozen proposed players not on the scored week roster."})
   continue
  if any(pid not in actual_scores for pid in proposed_ids+official_ids):
   evaluations.append({"week":week,"status":"not_comparable_missing_actual_scores"});continue
  proposed_actual=sum(float(actual_scores[p]) for p in proposed_ids)
  actual_lineup=sum(float(actual_scores[p]) for p in official_ids)
  evaluations.append({"week":week,"status":"comparable_retrospective",
   "frozen_predicted_ppg":round(float(item["lineup"]["ppg"]),2),
   "frozen_lineup_actual_points":round(proposed_actual,2),
   "submitted_lineup_actual_points":round(actual_lineup,2),
   "retrospective_margin":round(proposed_actual-actual_lineup,2),
   "model_prediction_error":round(float(item["lineup"]["ppg"])-proposed_actual,2),
   "model_lineup_names":[p["name"] for p in proposed],
   "comparison_note":"Retrospective only; not proof the frozen lineup was preferable using injury news at lock."})
 return evaluations,pending

def main():
 now=dt.datetime.now(dt.timezone.utc)
 latest=load(DATA/"latest.json")
 names=load(DATA/"player_names.json")
 projection=load(DATA/"ros_projections.json")
 kickoffs=kickoff_times(int(latest["nfl_state"]["season"]))
 archived=capture(latest,names,projection,kickoffs,now)
 results,pending=assess(latest,kickoffs,now)
 numeric=[r for r in results if r["status"]=="comparable_retrospective"]
 report={"updated_at_utc":now.isoformat(),"newly_archived_weeks":archived,
  "completed_comparable_weeks":len(numeric),"pending_weeks":pending,
  "evaluations":results,
  "guardrails":["Never lock after earliest NFL game of target week.",
  "Never rewrite a first archived recommendation.",
  "Only compare with finalized Sleeper game-week starter and individual point arrays.",
  "Flag changed fantasy rosters instead of comparing unavailable players.",
  "Retrospective margin is not causal coaching uplift or unbiased model skill.",
  "Injuries, availability, weather and game-by-game roster lock still require Coach review.",
  "Never perform roster moves."]}
 save(DATA/"DECISION_BACKTEST.json",report)
 lines=["# Dirty Birds — Lineup Decision Backtesting","",
  f"Updated: {now.isoformat()}",
  f"Newly frozen future weeks: {', '.join(map(str,archived)) or 'none'}.",
  f"Comparable completed-week evaluations: {len(numeric)}.","",
  "The model snapshot is stored **before the first NFL game of the week**.",
  "Retrospective result does not prove the lineup was the right choice at decision time.","",
  "| Week | Status | Frozen lineup actual | Submitted lineup actual | Retrospective margin |",
  "|---:|---|---:|---:|---:|"]
 for r in results:
  fmt=lambda x: f"{x:.2f}" if isinstance(x,(float,int)) else "—"
  lines.append(f"| {r['week']} | {r['status']} | {fmt(r.get('frozen_lineup_actual_points'))} | {fmt(r.get('submitted_lineup_actual_points'))} | {fmt(r.get('retrospective_margin'))} |")
 lines+=["","Future weeks with archives pending outcome: "+(", ".join(map(str,pending)) or "none"),"",
  "No archived outcome is substituted with hindsight projections. No transactions performed."]
 (DATA/"DECISION_BACKTEST.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
 print("Decision backtest:",len(archived),"new weekly locks;",len(numeric),"completed comparisons")
if __name__=="__main__":main()
