#!/usr/bin/env python3
"""Phase VIII: reproducible, conditional six-team fantasy playoff Monte Carlo.

This is NOT a forecast of actual season-end playoff odds. Remaining FFL head-
to-head schedule is absent from saved Sleeper snapshot. Simulates if the top
six by current W-L / points standings entered the playoffs now, top 2 with byes,
using projected *eligible lineup* Weeks 15–17 and transparent uncertainty.
"""
import datetime as dt,json,random,math
from pathlib import Path
from lineup_impact import build_lineup
D=Path(__file__).resolve().parent/"data"
def load(path):return json.loads((D/path).read_text(encoding="utf-8"))
def owner_name(roster,users):
 u=next((x for x in users if x.get("user_id")==roster.get("owner_id")),None)
 return ((u or {}).get("metadata") or {}).get("team_name") or (u or {}).get("display_name") or f"Roster {roster['roster_id']}"
def weekly(roster,week,names,projection):
 reserve={str(x) for x in roster.get("reserve") or []}
 ids=[str(x) for x in roster.get("players") or [] if str(x) not in reserve]
 f={}
 for pid in ids:
  name=names.get(pid,{}).get("name")
  record=projection.get(name,{})
  p=(record.get("weeks") or {}).get(str(week))
  if isinstance(p,(int,float)) and not isinstance(p,bool):f[name]={"ppg":float(p)}
 return build_lineup(ids,names,f)
def score(mu,rng,volatility=0.22):
 return max(0,rng.gauss(mu,max(8,volatility*mu)))
def bracket(seed,points,rng):
 # Seed pairs 3v6 and 4v5; seeded reseeding in semifinals.
 w={}
 for a,b in ((seed[2],seed[5]),(seed[3],seed[4])):
  sa,sb=score(points[a][15],rng),score(points[b][15],rng)
  w[a if sa>=sb else b]=True
 advancing=[x for x in seed[2:] if x in w]
 semi=[(seed[0],max(advancing,key=lambda x:seed.index(x))),(seed[1],min(advancing,key=lambda x:seed.index(x)))]
 finalists=[]
 for a,b in semi:
  sa,sb=score(points[a][16],rng),score(points[b][16],rng)
  finalists.append(a if sa>=sb else b)
 a,b=finalists
 sa,sb=score(points[a][17],rng),score(points[b][17],rng)
 return (a if sa>=sb else b),finalists,advancing
def run(snapshot,names,forecast,iterations=10000,seed=2607):
 rosters=snapshot["rosters"]
 ranked=sorted(rosters,key=lambda r:(-r["settings"].get("wins",0),
  r["settings"].get("losses",0),
  -(r["settings"].get("fpts",0)+r["settings"].get("fpts_decimal",0)/100)))
 entrants=ranked[:6];ids=[r["roster_id"] for r in entrants]
 points={};warnings=[]
 for r in entrants:
  rid=r["roster_id"];points[rid]={}
  for week in (15,16,17):
   estimate=weekly(r,week,names,forecast)
   if not estimate.get("complete"):
    warnings.append(f"Roster {rid}, week {week}: no complete projection")
   else:points[rid][week]=float(estimate["ppg"])
 if warnings:
  return {"status":"blocked_incomplete_forecasts","warnings":warnings,"seeded_rosters":ids}
 rng=random.Random(seed);won={x:0 for x in ids};final={x:0 for x in ids};semi={x:0 for x in ids}
 for _ in range(iterations):
  champ,finalists,round1=bracket(ids,points,rng)
  won[champ]+=1
  for x in finalists:final[x]+=1
  for x in ids[:2]+round1:semi[x]+=1
 return {"status":"completed_conditional_current_seed_bracket","simulations":iterations,
  "random_seed":seed,"weekly_score_sd":"max(8 points, 22% of modeled score)",
  "ranking_assumption":"Current wins, losses, then scored points. Official Sleeper tiebreaks not reconstructed.",
  "bracket_assumption":"Six entrants, seeds 1 and 2 receive Week 15 byes; higher seed faces lower surviving seed Week 16.",
  "not_modeled":["remaining regular-season FFL schedule","real end-of-season qualification probability",
    "correlated game outcomes","NFL injury probabilities","starters locked at kickoff","true tie-break procedures"],
  "seeded_rosters":ids,
  "teams":[{"seed":i+1,"roster_id":rid,
    "name":owner_name(entrants[i],snapshot.get("users",[])),
    "record":f"{entrants[i]['settings'].get('wins',0)}-{entrants[i]['settings'].get('losses',0)}",
    "playoff_lineup_forecasts":points[rid],
    "conditional_semifinal_probability":round(semi[rid]/iterations,4),
    "conditional_final_probability":round(final[rid]/iterations,4),
    "conditional_championship_probability":round(won[rid]/iterations,4)} for i,rid in enumerate(ids)]}
def main():
 snap=load("latest.json");names=load("player_names.json")
 ros=load("ros_projections.json")
 now=dt.datetime.now(dt.timezone.utc).isoformat()
 out=run(snap,names,ros["players"])
 out["generated_at_utc"]=now
 out["league_week"]=snap["nfl_state"]["week"]
 out["roster_snapshot_as_of"]=snap.get("fetched_at_utc")
 out["forecast_source_as_of"]=ros.get("as_of")
 out["key_disclaimer"]="These championship probabilities are CONDITIONAL on today's six seeds reaching the playoffs, not estimates of actual season-end playoff or title probabilities."
 (D/"CHAMPIONSHIP_SIMULATION.json").write_text(json.dumps(out,indent=2,ensure_ascii=False,sort_keys=True)+"\n")
 lines=["# Dirty Birds — Phase VIII Conditional Championship Simulator","",
 f"Generated: {now} | Live league week: {out['league_week']}","",
 "**Not actual playoff qualification odds.** This assumes the league's current top six teams become the playoff seeds.",
 "It also assumes a 6-team Week 15–17 bracket, two byes, and weekly score volatility of 22% (minimum 8 points).",""]
 if out["status"]=="completed_conditional_current_seed_bracket":
  lines+=["| Seed | Team | Current record | Week 15 forecast | Week 16 | Week 17 | Conditional title chance |",
   "|---:|---|---|---:|---:|---:|---:|"]
  for t in out["teams"]:
   ws=t["playoff_lineup_forecasts"]
   lines.append(f'| {t["seed"]} | {t["name"]} (roster {t["roster_id"]}) | {t["record"]} | {ws[15]:.1f} | {ws[16]:.1f} | {ws[17]:.1f} | {t["conditional_championship_probability"]:.1%} |')
 else:lines+=["**Blocked:** playoff-week projection data incomplete.",""]+out.get("warnings",[])
 lines+=["","## Method and limitations","",
 "- Current standings do not determine final seeds; missing regular-season future fixtures prevent credible qualification probabilities.",
 "- Model uses independent normal-distribution fantasy scores; volatility is an assumption, not an empirically fitted certainty.",
 "- All forecasts are based on currently rostered non-fantasy-reserve players; not injury verified.",
 "- No live lineup changes or league operations are executed.",
 "- Future version should use complete matchups, calibration statistics, league tiebreaks and seed probabilities."]
 (D/"CHAMPIONSHIP_SIMULATION.md").write_text("\n".join(lines)+"\n")
 print("Phase VIII simulation:",out["status"],"entrants:",len(out.get("teams",[])))
if __name__=="__main__":main()
