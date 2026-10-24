#!/usr/bin/env python3
"""Read-only trade discovery for Dirty Birds. Acceptance is NOT predicted.

Generates 1:1, 2:1, 1:2 packages. Each party's actual legal two-FLEX
starting-lineup value, replacement/drop costs and roster status are visible.
Screening is projection-dependent, not a statement of fair market value.
"""
import json,datetime as dt,itertools
from pathlib import Path
from lineup_impact import build_lineup
D=Path(__file__).resolve().parent/"data"
def read(file):return json.loads((D/file).read_text(encoding="utf-8"))
def main():
 snap=read("latest.json");names=read("player_names.json")
 source=read("ros_projections.json");pp=source["players"]
 rosters=snap["rosters"];mine=next(r for r in rosters if r["roster_id"]==1)
 meta=read("external_metrics.json").get("players",{})
 mineids=[str(x) for x in mine["players"]]
 initial=build_lineup(mineids,names,pp)
 if not initial["complete"]:raise ValueError("Dirty Birds baseline incomplete")
 def value(pid):
  item=names.get(str(pid),{})
  forecast=pp.get(item.get("name"),{})
  v=forecast.get("ppg")
  return float(v) if isinstance(v,(int,float)) and forecast.get("coverage_fraction",0)>=0.7 else None
 def pool(roster,limit):
  ids=[str(x) for x in roster["players"]]
  ids=[pid for pid in ids if value(pid) is not None]
  ids.sort(key=lambda pid:value(pid),reverse=True)
  return ids[:limit]
 def safe(ids):
  return build_lineup(ids,names,pp)
 def package(ids):
  return [{"id":pid,"name":names[pid]["name"],"pos":names[pid]["position"],"projected_ppg":round(value(pid),2)} for pid in ids]
 def flags(ids,roster):
  reserve=set(str(x) for x in (roster.get("reserve") or []))
  out=[]
  for pid in ids:
   player=names.get(pid,{})
   external=meta.get(pid,{})
   if pid in reserve:out.append(player.get("name",pid)+": fantasy reserve")
   if external.get("snap_share_pct") is None and player.get("position") in ("RB","WR","TE","QB"):out.append(player.get("name",pid)+": snap coverage absent")
  return out
 scenarios=[]
 for other in rosters:
  if other["roster_id"]==1:continue
  theirids=[str(x) for x in other["players"]]
  other_start=safe(theirids)
  if not other_start["complete"]:continue
  outgoing=pool(mine,12);incoming=pool(other,14)
  sides=[(1,1),(2,1),(1,2)]
  for give_count,take_count in sides:
   for give in itertools.combinations(outgoing,give_count):
    for receive in itertools.combinations(incoming,take_count):
     # Packages with +1 player require a legal roster cut; choose best valid
     mine_base=[x for x in mineids if x not in give]+list(receive)
     theirs_base=[x for x in theirids if x not in receive]+list(give)
     best_mine=None;best_theirs=None
     for candidate_roster,original,count_diff,recipient in [
        (mine_base,mineids,take_count-give_count,"mine"),
        (theirs_base,theirids,give_count-take_count,"theirs")]:
      options=[(candidate_roster,None)]
      if count_diff>0:
       options=[([x for x in candidate_roster if x!=cut],cut) for cut in original if cut not in give and cut not in receive]
      ranked=[]
      for ids,cut in options:
       state=safe(ids)
       if state["complete"]:ranked.append((state["ppg"],state,cut))
      if not ranked:break
      ranked.sort(key=lambda x:x[0],reverse=True)
      if recipient=="mine":best_mine=ranked[0]
      else:best_theirs=ranked[0]
     if not best_mine or not best_theirs:continue
     db=round(best_mine[0]-initial["ppg"],2)
     dt=round(best_theirs[0]-other_start["ppg"],2)
     # Strict discovery: both parties nonnegative, Dirty Birds meaningfully better.
     if db<0.5 or dt<0:continue
     # Score is transparent opportunity ordering, NOT acceptance probability.
     score=round(db+min(dt,8)*0.8-abs(db-dt)*0.14,3)
     allgiven=sum(value(pid) for pid in give)
     allreceived=sum(value(pid) for pid in receive)
     scenarios.append({"opponent_roster_id":other["roster_id"],
       "give":package(give),"receive":package(receive),
       "dirty_birds_delta_ppg":db,"opponent_delta_ppg":dt,
       "dirty_birds_before":initial["ppg"],"dirty_birds_after":best_mine[0],
       "opponent_before":other_start["ppg"],"opponent_after":best_theirs[0],
       "dirty_birds_drop_to_fit":names.get(best_mine[2],{}).get("name") if best_mine[2] else None,
       "opponent_drop_to_fit":names.get(best_theirs[2],{}).get("name") if best_theirs[2] else None,
       "projected_ppg_sent":round(allgiven,2),"projected_ppg_received":round(allreceived,2),
       "warnings":flags(give,mine)+flags(receive,other),
       "mutual_benefit_screen_score":score,
       "acceptance_probability":None,
       "trade_value_caveat":"Lineup PPG benefit is not manager willingness or market/fair value."})
 scenarios.sort(key=lambda x:x["mutual_benefit_screen_score"],reverse=True)
 distinct=[];team_count={}
 for deal in scenarios:
  team=deal["opponent_roster_id"]
  if team_count.get(team,0)>=4:continue
  distinct.append(deal);team_count[team]=team_count.get(team,0)+1
  if len(distinct)>=50:break
 out={"generated_at_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
  "source_snapshot_utc":snap.get("fetched_at_utc"),"projections_as_of":source.get("as_of"),
  "league_trade_deadline_week":snap["league"]["settings"].get("trade_deadline"),
  "tested_candidate_types":["1-for-1","2-for-1","1-for-2"],
  "model":"Screen packages where both clubs can fill legal starting lineups and each gains projected lineup PPG.",
  "not_estimated":["manager acceptance probability","subjective star premium","injury adjusted future probabilities","FAAB/picks","negotiation history","week-by-week expected wins"],
  "warning":"Read-only research shortlist. Two-to-one packages require a separate roster drop. Never send an offer without Coach authorization.",
  "suggestions":distinct}
 (D/"TRADE_IDEAS.json").write_text(json.dumps(out,indent=2,ensure_ascii=False,sort_keys=True)+"\n")
 lines=["# Dirty Birds — Mutually Beneficial Trade Ideas","",
  f"Generated: {out['generated_at_utc']}","",
  "**These are statistical conversation starters, NOT predicted acceptances or recommended offers.**",
  "Only projected starting-lineup gains (not medical-adjusted values) are tested. Ranking deliberately requires both teams to gain.","",
  "| # | Opponent roster | We give | We receive | Our gain | Their gain | Extra cut |",
  "|---:|---:|---|---|---:|---:|---|"]
 for i,v in enumerate(distinct[:25],1):
  names_out=", ".join(p["name"] for p in v["give"])
  names_in=", ".join(p["name"] for p in v["receive"])
  cuts=("Us: "+v["dirty_birds_drop_to_fit"] if v["dirty_birds_drop_to_fit"] else "")+(" Them: "+v["opponent_drop_to_fit"] if v["opponent_drop_to_fit"] else "")
  lines.append(f'| {i} | {v["opponent_roster_id"]} | {names_out} | {names_in} | +{v["dirty_birds_delta_ppg"]:.2f} | +{v["opponent_delta_ppg"]:.2f} | {cuts or "None"} |')
 lines+=["","## Due diligence before negotiating","",
  "- Verify opponent roster need and manager tendencies; a positive projected delta is not evidence of acceptance.",
  "- Recalculate weekly bye/playoff outcomes and injury/snap trends before assessing a real offer.",
  "- Review future cost, durability, IR/roster limitations and value of the player surrendered.",
  "- Never initiate or submit an offer automatically.","",
  "Detailed rankings and risk flags: `data/TRADE_IDEAS.json`."]
 (D/"TRADE_IDEAS.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
 print(f"Trade opportunities: {len(scenarios)} positive two-sided candidate packages; report {len(distinct)}")
if __name__=="__main__":main()
