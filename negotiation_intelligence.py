#!/usr/bin/env python3
"""Read-only market-aware trade idea review. No claim of true market prices or acceptance odds."""
import json,datetime as dt,statistics
from pathlib import Path
from lineup_impact import build_lineup
D=Path(__file__).resolve().parent/"data"
def read(name):return json.loads((D/name).read_text(encoding="utf-8"))
def pos_rank(pid,names,pp,bypos):
 p=names.get(pid,{})
 r=pp.get(p.get("name"),{})
 v=r.get("ppg")
 peers=bypos.get(p.get("position"),[])
 if not isinstance(v,(int,float)) or not peers:return None
 return round(sum(1 for x in peers if x<=v)/len(peers),3)
def weekly(ids,week,names,pp):
 source={}
 for p in names.values():
  data=pp.get(p.get("name"),{})
  v=(data.get("weeks") or {}).get(str(week))
  if isinstance(v,(float,int)):source[p["name"]]={"ppg":v}
 return build_lineup(ids,names,source)
def main():
 ideas=read("TRADE_IDEAS.json");snapshot=read("latest.json")
 names=read("player_names.json");proj=read("ros_projections.json")["players"]
 rosters={r["roster_id"]:r for r in snapshot["rosters"]}
 mine=rosters[1];current=[str(pid) for pid in mine["players"]]
 allp={}
 bypos={}
 for r in rosters.values():
  for pid in r["players"]:
   id=str(pid);p=names.get(id,{})
   record=proj.get(p.get("name"),{})
   val=record.get("ppg")
   if not isinstance(val,(int,float)):continue
   bypos.setdefault(p.get("position"),[]).append(float(val))
   allp[id]=float(val)
 def residual_slots(roster):
  counts={}
  for pid in roster["players"]:
   pos=names.get(str(pid),{}).get("position")
   counts[pos]=counts.get(pos,0)+1
  return counts
 out=[]
 for s in ideas["suggestions"]:
  other=rosters[s["opponent_roster_id"]]
  give=[p["id"] for p in s["give"]];receive=[p["id"] for p in s["receive"]]
  theirids=[str(pid) for pid in other["players"]]
  pct_send=[pos_rank(pid,names,proj,bypos) for pid in give]
  pct_receive=[pos_rank(pid,names,proj,bypos) for pid in receive]
  if None in pct_send+pct_receive:continue
  # Percentile sums are diagnostic only: not additive trade prices.
  sent=sum(pct_send);received=sum(pct_receive)
  imbalance=round(abs(sent-received)/max(sent,received),3) if max(sent,received)>0 else 0
  # Redundant packages are especially weak pitches: player added while no
  # further improvement over a cheaper subset.
  duplicate_cost=False
  if len(give)>1:
   for drop in give:
    remain=[x for x in current if x not in give or x==drop]+receive
    after=build_lineup(remain,names,proj)
    if after.get("complete") and after["ppg"]>=s["dirty_birds_after"]-0.05:
     duplicate_cost=True
  weekly_gains={}
  for w in (15,16,17):
   before=weekly(current,w,names,proj)
   after=weekly([x for x in current if x not in give]+receive,w,names,proj)
   if before.get("complete") and after.get("complete"):
    weekly_gains[str(w)]=round(after["ppg"]-before["ppg"],2)
   else:weekly_gains[str(w)]=None
  usable=[v for v in weekly_gains.values() if v is not None]
  counts=residual_slots(other)
  receiving_positions=[names[pid]["position"] for pid in give]
  # Roster need heuristic: shallow position (QB<=1, RB<=3, WR<=3, TE<=1) and
  # measurable gain in starter lineup. Not a manager's stated preference.
  needy=[]
  for pos in set(receiving_positions):
   floor={"QB":1,"RB":3,"WR":3,"TE":1,"K":1,"DEF":1}.get(pos,0)
   if counts.get(pos,0)<=floor:needy.append(pos)
  flags=list(s["warnings"])
  if duplicate_cost:flags.append("Unnecessary extra outgoing asset under aggregate PPG model")
  if imbalance>0.3:flags.append("Large sum-of-positional-percentiles imbalance (NOT market pricing)")
  if len(usable)<3:flags.append("Incomplete fantasy playoff lineup projections")
  if any(v is not None and v< -1 for v in weekly_gains.values()):flags.append("Negative playoff-week modeled effect")
  # Pure heuristic ordering; never an implied acceptance rate.
  screen=round(
   1.5*s["dirty_birds_delta_ppg"]+
   0.9*min(s["opponent_delta_ppg"],5)+
   (sum(usable)/len(usable)*0.35 if usable else -1)-
   imbalance*2-(2 if duplicate_cost else 0)-
   (1 if len(usable)<3 else 0),3)
  why=(f"Opponent projected starters improve {s['opponent_delta_ppg']:+.2f} PPG" +
    (f"; potential shallow position(s): {', '.join(needy)}" if needy else
     "; no clear shallow-position signal"))
  out.append({**s,"position_relative_percentile_sum_sent":round(sent,3),
   "position_relative_percentile_sum_received":round(received,3),
   "surrogate_balance_gap_fraction":imbalance,
   "negotiation_rationale":why,
   "playoff_week_gains_ppg":weekly_gains,"redundant_outgoing_package":duplicate_cost,
   "evidence_warnings":flags,"negotiation_screen_score":screen,
   "acceptance_probability":None,
   "market_value_source":None})
 out.sort(key=lambda v:v["negotiation_screen_score"],reverse=True)
 # Avoid showing three variants of same acquired star as the top three.
 selected=[];seen_targets=set();per_team={}
 for item in out:
  target=tuple(sorted(p["id"] for p in item["receive"]))
  team=item["opponent_roster_id"]
  if target in seen_targets or per_team.get(team,0)>=2:continue
  selected.append(item);seen_targets.add(target);per_team[team]=per_team.get(team,0)+1
  if len(selected)>=5:break
 report={"generated_at_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
 "source_projections_as_of":ideas.get("projections_as_of"),
 "source_rosters_as_of":ideas.get("source_snapshot_utc"),
 "market_truth":"No independently verified ADP, expert trade chart or league negotiation behavior has been sourced. Position-relative projected PPG is NOT fair market value.",
 "screen_formula":"1.5*our line-up gain + 0.9*min(their gain,5) + 0.35*mean valid weeks 15-17 gain - 2*percentile imbalance - 2*redundant outgoing - 1 if playoff weeks incomplete",
 "limitations":["Acceptance odds unavailable. Never convert score to a probability.",
 "Position depth heuristic is a rough proxy for roster needs, not manager preference.",
 "Star, durability, reserve, playoff opponents and keeper values not fully represented.",
 "This report does not recommend automatic opening offers or counteroffers."],
 "top_five":selected,"all_reviewed":len(out)}
 (D/"NEGOTIATION_SHORTLIST.json").write_text(json.dumps(report,indent=2,ensure_ascii=False,sort_keys=True)+"\n")
 lines=["# Dirty Birds — Negotiation Intelligence Shortlist","",
  f"Generated: {report['generated_at_utc']}","",
  "**Screened trade ideas only; not market-priced, predicted to be accepted, or authorized offers.**","",
  "| # | Opponent roster | Give | Receive | Our gain | Their gain | Playoff weeks 15/16/17 | Warnings |",
  "|---:|---:|---|---|---:|---:|---|---|"]
 for i,s in enumerate(selected,1):
  give=", ".join(p["name"] for p in s["give"]);receive=", ".join(p["name"] for p in s["receive"])
  playoff="/".join("—" if v is None else f"{v:+.1f}" for v in s["playoff_week_gains_ppg"].values())
  warnings="; ".join(s["evidence_warnings"][:3]) or "No flagged data gap"
  lines.append(f"| {i} | {s['opponent_roster_id']} | {give} | {receive} | +{s['dirty_birds_delta_ppg']:.2f} | +{s['opponent_delta_ppg']:.2f} | {playoff} | {warnings} |")
 lines+=["","## What the other manager might gain",""]
 for i,s in enumerate(selected,1):
  lines.extend([f"**{i}. {', '.join(p['name'] for p in s['receive'])}** — {s['negotiation_rationale']}.",
    f"Diagnostic positional-percentile imbalance: {s['surrogate_balance_gap_fraction']:.0%} (not a trade price).",""])
 lines+=["## Verification before discussions","",
  "- Confirm both players' current usage, official injury and practice status and actual market value from independently sourced estimates.",
  "- Check each manager's genuine roster needs, historical offers, and willingness to trade.",
  "- Review the complete package including fantasy reserve and potential drops.",
  "- Coach approves any opening offer or counteroffer. No transactions performed."]
 (D/"NEGOTIATION_SHORTLIST.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
 print(f"Negotiation screening: {len(out)} reviewed, {len(selected)} shortlisted")
if __name__=="__main__":main()
