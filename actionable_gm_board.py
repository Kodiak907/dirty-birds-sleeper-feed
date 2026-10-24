#!/usr/bin/env python3
"""Coach-first waiver and trade decision quality controls. Read-only.

Suppress weak trade packages; rank waiver research only where projection,
ownership, health and active-roster replacement evidence is usable.
"""
import json,datetime as dt
from pathlib import Path
D=Path(__file__).resolve().parent/"data"
def read(p):
 f=D/p
 return json.loads(f.read_text()) if f.exists() else {}
def create():
 snap=read("latest.json");waivers=read("LINEUP_IMPACT.json")
 watch=read("waiver_watchlist.json");market=read("MARKET_OFFER_GUIDE.json")
 names=read("player_names.json");roster=next(r for r in snap.get("rosters",[]) if r.get("roster_id")==1)
 reserved=set(map(str,roster.get("reserve") or []))
 owned=set(str(x) for r in snap.get("rosters",[]) for x in r.get("players") or [])
 picks=[]
 for pos,entries in (waivers.get("by_position") or {}).items():
  if pos not in ("RB","WR","TE","QB"):continue
  for p in entries:
   if str(p.get("candidate_id")) in owned:continue
   injury=next((x.get("injury_status") for x in (watch.get("position_rankings") or {}).get(pos,[]) if str(x.get("id"))==str(p.get("candidate_id"))),None)
   if str(injury or "").lower() in ("ir","out","doubtful","pup","suspended","sus"):continue
   options=[o for o in p.get("candidate_drop_options",[]) if not o.get("drop_is_fantasy_reserve") and str(o.get("drop_id")) not in reserved and names.get(str(o.get("drop_id")),{}).get("position")==pos]
   if not options:continue
   options.sort(key=lambda x:x.get("projected_lineup_gain_ppg",0),reverse=True)
   best=options[0];gain=round(float(best.get("projected_lineup_gain_ppg",0)),2)
   proj=read("ros_projections.json").get("players",{})
   candidate_ppg=p.get("projection_ppg")
   drop_name=names.get(str(best.get("drop_id")),{}).get("name")
   drop_ppg=proj.get(drop_name,{}).get("ppg")
   depth=round(float(candidate_ppg)-float(drop_ppg),2) if isinstance(candidate_ppg,(int,float)) and isinstance(drop_ppg,(int,float)) else None
   # A zero-gain name may be worth a closer look as depth, but is NOT an add recommendation.
   if gain<0.75 and (depth is None or depth<2):continue
   signals=[]
   if not p.get("warnings"):signals.append("No listed coverage caveats")
   else:signals.extend(p.get("warnings",[]))
   picks.append({"player":p["candidate"],"position":pos,"team":p.get("team"),
     "source_player_id":p.get("candidate_id"),
     "modeled_starter_gain_ppg":gain,"bench_depth_difference_ppg":depth,
     "hypothetical_drop":best["drop"],"drop_id":best["drop_id"],
     "research_tier":"starting-lineup candidate" if gain>=1.5 else "depth candidate",
     "evidence_flags":signals,
     "not_yet_verified":["current waiver lock","official game availability","week-by-week role","reasonable FAAB cost"],
     "coach_authorization_required":True})
 picks.sort(key=lambda x:(x["modeled_starter_gain_ppg"],x["bench_depth_difference_ppg"] or -99),reverse=True)
 tradeok=[];rejected=[]
 for x in market.get("qualified_top_five",[]):
  gain=float(x.get("dirty_birds_delta_ppg",0))
  them=float(x.get("opponent_delta_ppg",0))
  flags=[]
  if gain<1.5:flags.append("Too little projected starter benefit for roster disruption")
  if them<1:flags.append("Opponent has insufficient demonstrated benefit")
  if len(x.get("give",[]))>1 and gain<2.0:flags.append("Overpays in outgoing assets for a marginal gain")
  if x.get("dirty_birds_drop_to_fit"):flags.append("Requires further outgoing roster action")
  if any("fantasy reserve" in v for v in x.get("warnings",[])):flags.append("Reserve player valuation unresolved")
  if flags:rejected.append({"give":[p["name"] for p in x["give"]],"receive":[p["name"] for p in x["receive"]],"reasons":flags})
  else:tradeok.append(x)
 out={"generated_at_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
   "roster_snapshot_utc":snap.get("fetched_at_utc"),
   "waiver_research_shortlist":picks[:12],
   "waiver_screened_count":len(picks),
   "trade_qualified_for_negotiation_review":tradeok,
   "trade_rejected":rejected,
   "trade_status":"No defensible opening offers" if not tradeok else "Ideas require Coach review",
   "warnings":["Waiver research is NOT a pickup/drop recommendation; all moves need fresh eligibility and role confirmation.",
   "A zero-starter-gain player can still have depth value; this list uses limited projections.",
   "Market trade prices are full-PPR references; FFL is half-PPR.",
   "No acceptance likelihood, FAAB bid, or trade offer is fabricated.",
   "All outputs read only."]}
 (D/"ACTIONABLE_GM_BOARD.json").write_text(json.dumps(out,indent=2,sort_keys=True)+"\n")
 lines=["# Dirty Birds — GM Quality-Control Board","",
  f"Generated: {out['generated_at_utc']}","",
  "**Realistic research, not automatic offers or claims.**","",
  "## Waiver candidates worth investigating","",
  "| Player | Pos | Starter gain | Depth difference | Hypothetical replacement | Level |",
  "|---|---|---:|---:|---|---|"]
 for p in picks[:12]:
  dep=p["bench_depth_difference_ppg"]
  lines.append(f'| {p["player"]} | {p["position"]} | {p["modeled_starter_gain_ppg"]:+.2f} | {dep if dep is not None else "—"} | {p["hypothetical_drop"]} | {p["research_tier"]} |')
 if not picks:lines.append("| — | — | — | — | No sufficiently compelling sourced candidate | — |")
 lines+=["","## Trade proposals","",f"**{out['trade_status']}**","",
  "The prior two trades are suppressed because both teams' projected gains were marginal relative to the assets involved.","",
  "## Rejected old offers",""]
 for x in rejected:lines.append("- "+", ".join(x["give"])+" for "+", ".join(x["receive"])+": "+"; ".join(x["reasons"]))
 lines+=["","## Required checks","",
  "- Confirm availability, workload and league waiver eligibility before evaluating a candidate.",
  "- Protect fantasy-IR stashes from automated drop suggestions.",
  "- Show honest no-trade/no-pickup outcomes instead of forcing activity.",
  "- Coach alone approves all transactions."]
 (D/"ACTIONABLE_GM_BOARD.md").write_text("\n".join(lines)+"\n")
 print("GM board: waiver candidates",len(picks),"negotiation candidates",len(tradeok))
if __name__=="__main__":create()
