#!/usr/bin/env python3
"""FFL full regular-season qualification + playoff Monte Carlo (source-backed fixtures)."""
import json,datetime as dt,random,collections
from pathlib import Path
from championship_simulator import weekly,score,bracket,owner_name
D=Path(__file__).resolve().parent/"data"
def load(p):return json.loads((D/p).read_text())
def simulate(snapshot,names,projections,schedule,iterations=10000,seed=2808):
 current=int(snapshot["nfl_state"]["week"])
 rosters={r["roster_id"]:r for r in snapshot["rosters"]};ids=sorted(rosters)
 fixtures=schedule.get("future_weeks",{})
 needed=list(range(current+1,15))
 if not needed or not all(fixtures.get(str(w),{}).get("complete") for w in needed):
  return {"status":"blocked_missing_verified_fixtures","missing_weeks":[w for w in needed if not fixtures.get(str(w),{}).get("complete")]}
 means={};missing=[]
 for rid,r in rosters.items():
  means[rid]={}
  for week in range(current+1,18):
   state=weekly(r,week,names,projections)
   if state.get("complete"):means[rid][week]=float(state["ppg"])
   else:missing.append({"roster_id":rid,"week":week})
 if missing:return {"status":"blocked_incomplete_team_projections","missing":missing}
 rng=random.Random(seed)
 counts={i:collections.Counter() for i in ids}
 allseeds={i:collections.Counter() for i in ids}
 for _ in range(iterations):
  w={i:int(rosters[i]["settings"].get("wins",0)) for i in ids}
  losses={i:int(rosters[i]["settings"].get("losses",0)) for i in ids}
  pts={i:float(rosters[i]["settings"].get("fpts",0))+float(rosters[i]["settings"].get("fpts_decimal",0))/100 for i in ids}
  for wk in needed:
   for a,b in fixtures[str(wk)]["pairs"]:
    sa,sb=score(means[a][wk],rng),score(means[b][wk],rng)
    pts[a]+=sa;pts[b]+=sb
    if sa>=sb:w[a]+=1;losses[b]+=1
    else:w[b]+=1;losses[a]+=1
  rankings=sorted(ids,key=lambda i:(-w[i],losses[i],-pts[i]))
  field=rankings[:6]
  for index,i in enumerate(field):
   counts[i]["playoffs"]+=1
   allseeds[i][index+1]+=1
   if index<2:counts[i]["bye"]+=1
  winner,finalists,_=bracket(field,means,rng)
  counts[winner]["champion"]+=1
  for i in finalists:counts[i]["final"]+=1
 report=[]
 for i in ids:
  report.append({"roster_id":i,"name":owner_name(rosters[i],snapshot.get("users",[])),
    "record":f"{rosters[i]['settings'].get('wins',0)}-{rosters[i]['settings'].get('losses',0)}",
    "playoff_probability":round(counts[i]["playoffs"]/iterations,4),
    "bye_probability":round(counts[i]["bye"]/iterations,4),
    "final_probability":round(counts[i]["final"]/iterations,4),
    "championship_probability":round(counts[i]["champion"]/iterations,4),
    "seed_probabilities":{str(j):round(allseeds[i][j]/iterations,4) for j in range(1,7)}})
 report.sort(key=lambda v:v["championship_probability"],reverse=True)
 return {"status":"complete_schedule_conditional_model","simulations":iterations,"random_seed":seed,
  "season_week":current,"future_fixtures_weeks":needed,
  "scoring_uncertainty":"Independent Normal(mean=weekly optimal lineup projection, sd=max(8, 0.22*mean)); not calibrated",
  "tie_break_assumption":"Wins then projected accumulated points; official FFL tiebreak not independently verified",
  "remaining_week_assumption":"Weeks through 14 are remaining regular season; no tie games modeled",
  "future_roster_assumption":"Current roster held fixed; no future pickups, trades, or injuries simulated",
  "limitations":["Win/bye/title chances are model outputs dependent on speculative volatility, fixed rosters and unverified tiebreaks.",
    "Current Week 7 may be in progress: current record is used as saved, not future outcome.",
    "Model does not simulate correlated NFL player scoring or game lock time."],
  "teams":report}
def main():
 snap=load("latest.json");projections=load("ros_projections.json");schedule=load("FUTURE_MATCHUPS.json")
 result=simulate(snap,load("player_names.json"),projections["players"],schedule)
 result["generated_at_utc"]=dt.datetime.now(dt.timezone.utc).isoformat()
 result["roster_snapshot_as_of"]=snap.get("fetched_at_utc")
 result["projection_as_of"]=projections.get("as_of")
 (D/"FULL_SEASON_PLAYOFF_SIMULATION.json").write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
 lines=["# Dirty Birds — Phase VIII Full-Season Playoff Simulation","",
 f"Generated: {result['generated_at_utc']}","",
 "Uses Sleeper-verified remaining fixtures and current roster lineup projections. All probability estimates depend on uncalibrated score variance, fixed rosters and assumed tiebreaks.","",
 f"Status: **{result['status']}**",""]
 if result["status"]=="complete_schedule_conditional_model":
  lines+=["| Team | Current record | Playoffs | Bye | Final | Title |",
    "|---|---|---:|---:|---:|---:|"]
  for t in result["teams"]:
   lines.append(f"| {t['name']} ({t['roster_id']}) | {t['record']} | {t['playoff_probability']:.1%} | {t['bye_probability']:.1%} | {t['final_probability']:.1%} | {t['championship_probability']:.1%} |")
 else:lines+=["Cannot produce credible full-season results with the present coverage.",json.dumps({k:v for k,v in result.items() if k.startswith("missing")})]
 lines+=["","## Assumptions",""]+["- "+v for v in result.get("limitations",[])]
 lines+=["","No transaction or lineup action is ever taken."]
 (D/"FULL_SEASON_PLAYOFF_SIMULATION.md").write_text("\n".join(lines)+"\n")
 print("Full-season playoff simulation:",result["status"])
if __name__=="__main__":main()
