#!/usr/bin/env python3
"""2026 NFL schedules and fantasy playoff context, sourced from nflverse."""
import csv,io,json,urllib.request,datetime as dt,collections
from pathlib import Path
D=Path(__file__).resolve().parent/"data"
URL="https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv"
def main():
 req=urllib.request.Request(URL,headers={"User-Agent":"DirtyBirdsFFOReadOnly/1.0"})
 with urllib.request.urlopen(req,timeout=35) as h: rows=list(csv.DictReader(io.StringIO(h.read().decode("utf-8-sig"))))
 snap=json.loads((D/"latest.json").read_text());week=int((snap.get("nfl_state") or {}).get("week",7))
 by=collections.defaultdict(dict)
 for r in rows:
  try:y=int(r["season"]);w=int(r["week"])
  except(ValueError,KeyError):continue
  if y!=2026 or w<week or w>17 or r.get("game_type") not in ("REG","regular"):continue
  away,home=r.get("away_team"),r.get("home_team")
  if not away or not home:continue
  by[away][str(w)]={"opponent":home,"home":False,"game_id":r.get("game_id")}
  by[home][str(w)]={"opponent":away,"home":True,"game_id":r.get("game_id")}
 if len(by)<30:raise RuntimeError("Incomplete schedule data; refusing to publish")
 out={"as_of":dt.datetime.now(dt.timezone.utc).isoformat(),"source":URL,
 "season":2026,"from_week":week,"fantasy_playoff_weeks":[15,16,17],
 "description":"NFL future opponents only. No unsupported defense difficulty estimates.",
 "teams":{t:{"weeks":{str(w):by[t].get(str(w),{"bye":True}) for w in range(week,18)}} for t in sorted(by)}}
 (D/"nfl_schedule.json").write_text(json.dumps(out,indent=2,sort_keys=True)+"\n")
 print(f"Future schedule: {len(by)} teams, weeks {week}-17")
if __name__=="__main__":main()
