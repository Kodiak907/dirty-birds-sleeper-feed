#!/usr/bin/env python3
"""Read-only Dirty Birds trade-block-first discovery: Wilson, Brown, Mahomes."""
import datetime as dt,itertools,json
from pathlib import Path
from lineup_impact import build_lineup
D=Path(__file__).resolve().parent/"data"
FOCUS={"8146":"Garrett Wilson","5859":"A.J. Brown","4046":"Patrick Mahomes"}
def read(n):
 return json.loads((D/n).read_text(encoding="utf8"))
def main():
 snapshot=read("latest.json"); names=read("player_names.json")
 forecasts=read("ros_projections.json");pr=forecasts["players"]
 values=read("market_values.json");quoted=values.get("players",{})
 users={str(u.get("user_id")):u for u in snapshot.get("users",[])}
 mine=next(x for x in snapshot["rosters"] if x["roster_id"]==1)
 ours=list(map(str,mine.get("players") or []))
 def eligible(pid):
  name=names.get(str(pid),{}).get("name");p=pr.get(name,{})
  try:
   v=float(quoted[str(pid)]["value"]);ppg=float(p["ppg"])
   if p.get("coverage_fraction",0)<.7 or v<=0 or ppg<=0:return None
   return(v,ppg)
  except (KeyError,TypeError,ValueError):return None
 def build(ids):
  m=build_lineup(ids,names,pr)
  return float(m["ppg"]) if m.get("complete") else None
 def best(ids,original,needed):
  if needed<=0:return (build(ids),None)
  arr=[]
  for pid in original:
   if pid not in ids:continue
   if names.get(pid,{}).get("position") not in ("QB","RB","WR","TE"):continue
   pts=build([x for x in ids if x!=pid])
   if pts is not None:arr.append((pts,pid))
  return max(arr,key=lambda x:x[0]) if arr else (None,None)
 def pack(ids):
  return [{"id":pid,"name":names.get(pid,{}).get("name",pid),
    "position":names.get(pid,{}).get("position","?")} for pid in ids]
 before=build(ours)
 if before is None:raise RuntimeError("Dirty Birds lineup incomplete")
 now=dt.datetime.now(dt.timezone.utc).isoformat()
 reports=[];total=0;screened=0
 for primary,name in FOCUS.items():
  if primary not in ours:reports.append({"asset":name,"owned_now":False,"leads":[]});continue
  accessory=[pid for pid in ours if pid not in FOCUS and pid!=primary and eligible(pid)
    and names.get(pid,{}).get("position") in ("QB","RB","WR","TE")]
  accessory.sort(key=lambda p:eligible(p)[0])
  givens=[(primary,)]+[(primary,p) for p in accessory[:8]]
  found=[]
  for roster in snapshot["rosters"]:
   if roster["roster_id"]==1:continue
   otherids=list(map(str,roster.get("players") or []));theirbefore=build(otherids)
   if theirbefore is None:continue
   manager=users.get(str(roster.get("owner_id")),{})
   team=(manager.get("metadata") or {}).get("team_name") or manager.get("display_name") or str(roster["roster_id"])
   incoming=[pid for pid in otherids if eligible(pid) and names.get(pid,{}).get("position") in ("QB","RB","WR","TE")]
   incoming.sort(key=lambda p:eligible(p)[1],reverse=True);incoming=incoming[:14]
   for give in givens:
    paid=sum(eligible(pid)[0] for pid in give)
    for takecount in (1,2):
     for take in itertools.combinations(incoming,takecount):
      total+=1
      got=sum(eligible(pid)[0] for pid in take)
      ratio=paid/got if got>0 else 99
      if not (.72<=ratio<=1.2):continue
      screened+=1
      after,ourcut=best([x for x in ours if x not in give]+list(take),ours,takecount-len(give))
      theirs,theircut=best([x for x in otherids if x not in take]+list(give),otherids,len(give)-takecount)
      if after is None or theirs is None:continue
      us=round(after-before,2);them=round(theirs-theirbefore,2)
      if us<0.3 or them<0.0:continue
      strict=us>=1.5 and them>=.5 and .85<=ratio<=1.1 and (primary!="5859" or us>=3)
      found.append({"give":pack(give),"receive":pack(take),
       "opponent_roster_id":roster["roster_id"],"opponent":team,
       "our_lineup_delta_ppg":us,"their_lineup_delta_ppg":them,
       "value_paid_received_ratio":round(ratio,3),
       "our_extra_cut":names.get(ourcut,{}).get("name") if ourcut else None,
       "opponent_extra_cut":names.get(theircut,{}).get("name") if theircut else None,
       "screen":"STRICT_RESEARCH_PASS" if strict else "FURTHER_NEGOTIATION_RESEARCH",
       "limits":["Full-PPR external values are not FFL half-PPR prices","Injuries, playoff matchups and manager intent remain unverified"]})
  found.sort(key=lambda x:(x["screen"]=="STRICT_RESEARCH_PASS",x["our_lineup_delta_ppg"],x["their_lineup_delta_ppg"]),reverse=True)
  leads=[];keys=set();teams={}
  for x in found:
   key=(x["opponent_roster_id"],tuple(sorted(y["name"] for y in x["receive"])))
   if key in keys or teams.get(x["opponent_roster_id"],0)>=2:continue
   keys.add(key);leads.append(x)
   teams[x["opponent_roster_id"]]=teams.get(x["opponent_roster_id"],0)+1
   if len(leads)>=8:break
  reports.append({"asset":name,"owned_now":True,"leads":leads,"candidate_count":len(found)})
 result={"generated_at_utc":now,"source_snapshot_utc":snapshot.get("fetched_at_utc"),
 "source_market_as_of":values.get("as_of"),"source_projection_as_of":forecasts.get("as_of"),
 "focus_assets":[{"id":i,"name":n} for i,n in FOCUS.items()],
 "tested":total,"market_screened":screened,"reports":reports,
 "warning":"Read-only, no trade submitted. Research leads are not acceptance predictions, offers, or certified fair trades. Player must remain rostered to propose."}
 (D/"TRADE_BLOCK_SCOUTING.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
 print("Trade block research:",total,"cases,",screened,"price-matched,",sum(len(r["leads"]) for r in reports),"shown")
if __name__=="__main__":main()
