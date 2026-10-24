#!/usr/bin/env python3
"""Documented public TheTradeCalc redraft source, attributed and coverage gated."""
import urllib.request,json,re,datetime as dt
from pathlib import Path
D=Path(__file__).resolve().parent/"data"
URL="https://thetradecalc.com/api/v1/values?mode=redraft"
def norm(x):return re.sub("[^a-z0-9]","",str(x or "").lower())
def main():
 request=urllib.request.Request(URL,headers={"User-Agent":"DirtyBirdsFFO/1.0","Accept":"application/json"})
 with urllib.request.urlopen(request,timeout=30) as response:raw=json.load(response)
 entries=raw if isinstance(raw,list) else next((raw[k] for k in ("players","values","data","results") if isinstance(raw.get(k),list)),None) if isinstance(raw,dict) else None
 if entries is None:raise RuntimeError("Trade value JSON schema unknown; no publication")
 names=json.loads((D/"player_names.json").read_text())
 byname={}
 for pid,p in names.items():
  if p.get("name"):byname.setdefault(norm(p["name"]),[]).append(str(pid))
 matches={}
 for row in entries:
  if not isinstance(row,dict):continue
  player=row.get("player") if isinstance(row.get("player"),dict) else row
  name=next((player.get(k) for k in ("name","playerName","full_name","fullName") if isinstance(player.get(k),str)),None)
  value=next((row.get(k) for k in ("value","tradeValue","trade_value","redraftValue","score") if isinstance(row.get(k),(int,float))),None)
  if value is None:value=next((player.get(k) for k in ("value","tradeValue","trade_value") if isinstance(player.get(k),(int,float))),None)
  candidates=byname.get(norm(name),[])
  if len(candidates)==1 and value is not None:
   pid=candidates[0]
   matches[pid]={"name":names[pid]["name"],"position":names[pid].get("position"),"value":float(value)}
 if len(matches)<60:raise RuntimeError(f"Only {len(matches)} uniquely matched values; no file published")
 out={"as_of":dt.datetime.now(dt.timezone.utc).isoformat(),
  "source":URL,"attribution":"Values by TheTradeCalc — https://thetradecalc.com",
  "scale":"TheTradeCalc REDRAFT native units",
  "scoring_note":"12-team 1-QB full PPR source; Dirty Birds uses half-PPR, so this is a comparison signal only.",
  "matching":"Exact normalized unique Sleeper name; ambiguous/missing players excluded",
  "count":len(matches),"players":matches}
 (D/"market_values.json").write_text(json.dumps(out,indent=2,sort_keys=True)+"\n")
 print("Sourced attributed redraft values:",len(matches))
if __name__=="__main__":main()
