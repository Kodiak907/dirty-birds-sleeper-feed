#!/usr/bin/env python3
"""Fetch *future weekly* Sleeper projections; aggregate into sourced ROS per-game inputs.

Not a medical forecast. Uses league-specific point categories where present,
and excludes stats without published projections. Fails closed on empty response.
"""
import json,os,urllib.request,datetime as dt
from pathlib import Path
DATA=Path(__file__).resolve().parent/"data"
def read(name):return json.loads((DATA/name).read_text(encoding="utf-8"))
def get(url):
 req=urllib.request.Request(url,headers={"User-Agent":"DirtyBirdsFFOReadOnly/1.0","Accept":"application/json"})
 with urllib.request.urlopen(req,timeout=22) as r:
  return json.load(r)
def projection_points(stats,scoring):
 # Sleeper projections expose stats using Sleeper fantasy stat keys.
 # Variable bonuses and DST points-allowed categories require special treatment.
 rate_keys={"pass_yd","pass_td","pass_int","rush_yd","rush_td","rec","rec_yd","rec_td","fum_lost",
  "pass_2pt","rush_2pt","rec_2pt","xpm","xpmiss","fgmiss","fgm_0_19","fgm_20_29","fgm_30_39",
  "fgm_40_49","fgm_50_59","fgm_60p","sack","int","ff","fum_rec","def_td","st_td","safe",
  "pass_td_40p","pass_td_50p","rec_td_40p","rec_td_50p","rush_td_40p","rush_td_50p"}
 used=[]
 points=0.0
 for k in rate_keys:
  if isinstance(stats.get(k),(int,float)):
   points+=float(stats[k])*float(scoring.get(k,0))
   used.append(k)
 # Fallback to publisher's half PPR forecast only if detailed stats are unavailable.
 if not used:
  for k in ("pts_half_ppr","pts_half","pts_ppr"):
   if isinstance(stats.get(k),(int,float)) and k!="pts_ppr":
    return float(stats[k]),"publisher_half_ppr"
  return None,None
 return round(points,3),"league_stat_estimate"
def main():
 snap=read("latest.json")
 names=read("player_names.json")
 year=int(os.environ.get("SLEEPER_SEASON","2026"))
 nfl=snap.get("nfl_state") or {}
 first=int(nfl.get("week") or 1)
 last=17
 score=snap["league"]["scoring_settings"]
 allweeks={}
 successful=[]
 for w in range(first,last+1):
  url=f"https://api.sleeper.app/v1/projections/nfl/regular/{year}/{w}"
  try: items=get(url)
  except Exception as exc:
   print(f"WARN: future week {w} projection fetch failed: {type(exc).__name__}: {exc}")
   continue
  if not isinstance(items,(list,dict)) or not items:
   print(f"WARN: future week {w} returned empty or unsupported JSON")
   continue
  successful.append(w)
  entries=(items.items() if isinstance(items,dict) else ((str(i.get("player_id") or ""),i) for i in items if isinstance(i,dict)))
  for pid,item in entries:
   if not pid or not isinstance(item,dict):continue
   stats=item.get("stats") if isinstance(item.get("stats"),dict) else item
   if not isinstance(stats,dict):continue
   pts,method=projection_points(stats,score)
   if pts is None:continue
   allweeks.setdefault(pid,{})[w]={"points":round(pts,2),"method":method}
 # Require more than a single week in order to call this a rest-of-season model.
 if len(successful)<2:
  raise RuntimeError(f"Insufficient future week projections from Sleeper: fetched {successful}; no output published.")
 cutoff=dt.datetime.now(dt.timezone.utc).isoformat()
 out={"as_of":cutoff,"scoring":"half_ppr",
  "source":"Sleeper NFL weekly projection endpoint; https://api.sleeper.app/v1/projections/nfl/regular/{season}/{week}",
  "source_week_range":successful,"source_method":"Summed source-derived projected fantasy points across fetched future calendar weeks, including projected zeros if explicitly provided.",
  "warnings":["Player coverage varies. PPG is a mean of explicitly projected weeks; no missing week is scored zero.",
   "This is an aggregation of Sleeper weekly estimates, not an independently verified consensus or medical forecast.",
   "Sleeper projection APIs may be unreliable or incomplete; missing weeks are excluded from the denominator.",
   "League-specific scoring bonuses without explicit projected stat fields cannot be represented precisely.",
   "Values may be stale or not availability-adjusted; manual injury and usage checks are required."],
  "players":{}}
 for pid,wks in allweeks.items():
  p=names.get(pid)
  if not p or not p.get("name"):continue
  name=p["name"]
  # Preserve explicit weeks only; do not impute omitted weeks.
  projected=sum(x["points"] for x in wks.values())
  out["players"][name]={"ppg":round(projected/len(successful),3),
   "remaining_projected_points":round(projected,2),
   "games_remaining":len(wks),"coverage_weeks":len(wks),"total_weeks_fetched":len(successful),
   "coverage_fraction":round(len(wks)/len(successful),3),
   "status":"projection_only_not_injury_verified",
   "weeks":{str(w):obj["points"] for w,obj in sorted(wks.items())},
   "method":sorted(set(x["method"] for x in wks.values()))}
 if len(out["players"])<25:raise RuntimeError(f"Only {len(out['players'])} projected players; no output published")
 path=DATA/"ros_projections.json"
 path.write_text(json.dumps(out,indent=2,ensure_ascii=False,sort_keys=True)+"\n",encoding="utf-8")
 print(f"Saved sourced ROS estimates for {len(out['players'])} players, weeks {successful}")
if __name__=="__main__":main()
