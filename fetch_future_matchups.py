#!/usr/bin/env python3
"""Recover remaining FFL head-to-head fixtures directly from Sleeper.

Only 2 unique roster IDs with the same positive matchup_id count as a
verified future fixture. No invented round-robin fixtures or opponents.
"""
import json,urllib.request,datetime as dt
from pathlib import Path
D=Path(__file__).resolve().parent/"data"
LEAGUE="1399157532559192064"
def get(url):
 req=urllib.request.Request(url,headers={"User-Agent":"DirtyBirdsFFO/1.0"})
 with urllib.request.urlopen(req,timeout=25) as r:return json.load(r)
def extract(rows,roster_ids):
 groups={}
 for r in rows:
  mid=r.get("matchup_id");rid=r.get("roster_id")
  if not isinstance(mid,int) or mid<=0 or rid not in roster_ids:continue
  groups.setdefault(mid,set()).add(rid)
 pairs=[sorted(v) for v in groups.values() if len(v)==2]
 valid=(len(pairs)==len(roster_ids)//2 and len({i for pair in pairs for i in pair})==len(roster_ids))
 return sorted(pairs),valid
def main():
 snap=json.loads((D/"latest.json").read_text())
 week=int(snap["nfl_state"]["week"]);ids={r["roster_id"] for r in snap["rosters"]}
 result={"retrieved_at_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
   "source":"Sleeper matchup API; https://api.sleeper.app/v1/league/"+LEAGUE+"/matchups/{week}",
   "league_id":LEAGUE,"current_week":week,"future_weeks":{},"verified_full_schedule":False,"errors":[]}
 for w in range(week+1,15):
  try:
   rows=get(f"https://api.sleeper.app/v1/league/{LEAGUE}/matchups/{w}")
   if not isinstance(rows,list):raise ValueError("non-list response")
   pairs,complete=extract(rows,ids)
   result["future_weeks"][str(w)]={"pairs":pairs,"complete":complete,"records":len(rows)}
  except Exception as e:
   result["errors"].append(f"Week {w}: {str(e)[:150]}")
   result["future_weeks"][str(w)]={"pairs":[],"complete":False}
 result["verified_full_schedule"]=bool(result["future_weeks"]) and all(x["complete"] for x in result["future_weeks"].values())
 (D/"FUTURE_MATCHUPS.json").write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
 print("Sleeper future fixture weeks:",sum(x["complete"] for x in result["future_weeks"].values()),"/",len(result["future_weeks"]))
if __name__=="__main__":main()
