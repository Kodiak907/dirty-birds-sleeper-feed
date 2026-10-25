#!/usr/bin/env python3
"""Read-only two-sided trade research; no offer execution or acceptance estimates."""
import datetime as dt,itertools,json
from pathlib import Path
from lineup_impact import build_lineup
D=Path(__file__).resolve().parent/"data"
def get(n):return json.loads((D/n).read_text(encoding="utf8"))
def main():
 now=dt.datetime.now(dt.timezone.utc)
 snap=get("latest.json");names=get("player_names.json")
 src=get("ros_projections.json");pp=src.get("players",{})
 values=get("market_values.json")
 market=values.get("players",{})
 owners={str(u.get("user_id")):u for u in snap.get("users",[])}
 rosters=snap.get("rosters",[])
 mine=next(r for r in rosters if r.get("roster_id")==1)
 def roster(r):return [str(pid) for pid in r.get("players",[])]
 def v(pid):
  m=names.get(pid,{});p=pp.get(m.get("name"),{});k=market.get(pid,{})
  try:
   if p.get("coverage_fraction",0)<.7:return None
   score=float(p["ppg"]);cost=float(k["value"])
   return(score,cost) if score>0 and cost>0 else None
  except (TypeError,ValueError,KeyError):return None
 def pool(r):
  groups={p:[] for p in ("QB","RB","WR","TE")}
  for pid in roster(r):
   pos=names.get(pid,{}).get("position")
   if pos in groups and v(pid):groups[pos].append(pid)
  for group in groups.values():group.sort(key=lambda pid:-v(pid)[0])
  return groups["RB"][:4]+groups["WR"][:4]+groups["TE"][:2]+groups["QB"][:2]
 def lineup(ids):return build_lineup(ids,names,pp)
 def best(ids,old,extra):
  options=[(ids,None)] if extra<=0 else [([x for x in ids if x!=p],p) for p in old if p in ids and names.get(p,{}).get("position") in ("RB","WR","QB","TE")]
  ok=[]
  for arr,cut in options:
   t=lineup(arr)
   if t.get("complete"):ok.append((float(t["ppg"]),cut))
  return max(ok,key=lambda x:x[0]) if ok else None
 baseline=roster(mine);old=lineup(baseline)
 if not old.get("complete"):raise ValueError("Dirty Birds baseline incomplete")
 minepool=pool(mine);found=[];tested=priced=0
 for other in rosters:
  if other["roster_id"]==1:continue
  their_ids=roster(other);was=lineup(their_ids)
  if not was.get("complete"):continue
  recipient=owners.get(str(other.get("owner_id")),{})
  who=(recipient.get("metadata") or {}).get("team_name") or recipient.get("display_name") or str(other["roster_id"])
  this=[];theirpool=pool(other)
  for give_n,take_n in ((1,1),(1,2),(2,1),(2,2)):
   for give in itertools.combinations(minepool,give_n):
    paid=sum(v(x)[1] for x in give)
    for take in itertools.combinations(theirpool,take_n):
     tested+=1
     received=sum(v(x)[1] for x in take);ratio=paid/received if received else 99
     if ratio<.85 or ratio>1.10:continue
     priced+=1
     ours=best([p for p in baseline if p not in give]+list(take),baseline,take_n-give_n)
     theirs=best([p for p in their_ids if p not in take]+list(give),their_ids,give_n-take_n)
     if not ours or not theirs:continue
     gain=round(ours[0]-old["ppg"],2);benefit=round(theirs[0]-was["ppg"],2)
     if gain<1.5 or benefit<.5:continue
     star=any(names[p]["name"] in ("Bijan Robinson","Kyren Williams","A.J. Brown") for p in give)
     if star and gain<3:continue
     def package(seq):return [{"id":p,"name":names[p]["name"],"pos":names[p]["position"]} for p in seq]
     this.append({"opponent_roster_id":other["roster_id"],"opponent_name":who,
       "give":package(give),"receive":package(take),
       "our_gain":gain,"their_gain":benefit,"market_paid_received_ratio":round(ratio,3),
       "ours_cut_to_fit":names.get(ours[1],{}).get("name") if ours[1] else None,
       "theirs_cut_to_fit":names.get(theirs[1],{}).get("name") if theirs[1] else None,
       "why_both_benefit":"Both modeled legal lineups gain projected points and independent market values are reasonably balanced. Confirm health, playoff schedules and manager needs.",
       "score":round(gain+.6*benefit-3*abs(1-ratio),3),
       "not_an_approved_offer":True})
  this.sort(key=lambda a:a["score"],reverse=True);found.extend(this[:5])
 found.sort(key=lambda a:a["score"],reverse=True)
 selected=[];seen=set();team_counts={}
 for row in found:
  key=(row["opponent_roster_id"],tuple(sorted(x["name"] for x in row["receive"])))
  if key in seen or team_counts.get(row["opponent_roster_id"],0)>=2:continue
  seen.add(key);selected.append(row)
  rid=row["opponent_roster_id"];team_counts[rid]=team_counts.get(rid,0)+1
  if len(selected)>=12:break
 def old_time(x):
  try:
   t=dt.datetime.fromisoformat(str(x).replace("Z","+00:00"))
   if t.tzinfo is None:t=t.replace(tzinfo=dt.timezone.utc)
   return (now-t).total_seconds()/3600>72
  except (TypeError,ValueError):return True
 stale=old_time(src.get("as_of")) or old_time(values.get("as_of"))
 out={"version":"4.3","generated_at_utc":now.isoformat(),
   "candidates_evaluated":tested,"market_matched":priced,"source":"Current Sleeper lineups, Sleeper half-PPR projections, TheTradeCalc market",
   "market_source":values.get("attribution"),"market_as_of":values.get("as_of"),
   "projection_as_of":src.get("as_of"),"market_baseline":"12-team full-PPR; FFL is half-PPR",
   "rejected_due_to_stale_sources":stale,"qualified":[] if stale else selected,
   "thresholds":{"our_gain_min":1.5,"their_gain_min":.5,"core_give_gain_min":3,"paid_received_ratio":[.85,1.10]},
   "limitations":["Research ideas, not offers or acceptance predictions","Full-PPR market values are imprecise for FFL",
     "Per-game projections do not account for playoff schedules, health or manager intentions.",
     "No real transactions submitted. Coach must approve all offers."]}
 (D/"TRADE_QUALITY_43.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
 print("Trade quality",len(out["qualified"]),"ideas out of",tested,"examined; stale",stale)
if __name__=="__main__":main()
