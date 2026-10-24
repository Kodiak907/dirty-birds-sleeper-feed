#!/usr/bin/env python3
"""Import real 2026 nflverse snap counts, conservatively matched by name+NFL team.

CC-BY 4.0 credit: nflverse (https://github.com/nflverse/nflverse-data).
Only populated stats are emitted. Unknown routes/targets/injuries stay unknown.
"""
import csv,io,json,urllib.request,datetime as dt,re,collections
from pathlib import Path
DATA=Path(__file__).resolve().parent/"data"
URL="https://github.com/nflverse/nflverse-data/releases/download/snap_counts/snap_counts_2026.csv"
def normalize(s):return re.sub(r"[^a-z0-9]","",str(s or "").lower())
def number(v):
 try:return float(v) if v not in (None,"","NA") else None
 except (TypeError,ValueError):return None
def main():
 meta=json.loads((DATA/"player_metadata.json").read_text(encoding="utf-8"))
 req=urllib.request.Request(URL,headers={"User-Agent":"DirtyBirdsFFOReadOnly/1.0"})
 with urllib.request.urlopen(req,timeout=40) as handle:
  raw=handle.read()
 rows=list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
 if not rows:raise RuntimeError("No rows in nflverse snap csv")
 cols=set(rows[0])
 necessary={"player","team","week","offense_snaps","offense_pct"}
 if not necessary.issubset(cols):raise RuntimeError(f"Unexpected nflverse schema; missing {sorted(necessary-cols)}; got {sorted(cols)}")
 lookup=collections.defaultdict(list)
 for pid,p in meta.items():
  if p.get("position") in ("QB","RB","WR","TE"):
   lookup[(normalize(p.get("name")),normalize(p.get("team")))].append((pid,p))
 gathered=collections.defaultdict(list)
 ambiguous=0
 for r in rows:
  key=(normalize(r["player"]),normalize(r["team"]))
  matching=lookup.get(key,[])
  if len(matching)!=1:
   if matching:ambiguous+=1
   continue
  pid,p=matching[0]
  week=int(float(r["week"]))
  # Offensive pct is 0-1 in nflverse; convert to percent in output.
  snaps=number(r.get("offense_snaps"))
  share=number(r.get("offense_pct"))
  if snaps is None or share is None or not(0<=share<=1):continue
  gathered[pid].append((week,snaps,share))
 if len(gathered)<75:raise RuntimeError(f"Only {len(gathered)} player ID matches; refused to publish")
 results={}
 today=dt.datetime.now(dt.timezone.utc).isoformat()
 for pid,observations in gathered.items():
  observations=sorted({w:(w,n,s) for w,n,s in observations}.values())
  recent=observations[-3:]
  p=meta[pid]
  results[pid]={"name":p["name"],"nfl_team":p.get("team"),
    "snap_count":round(sum(x[1] for x in recent)/len(recent),1),
    "snap_share_pct":round(sum(x[2] for x in recent)/len(recent)*100,1),
    "season_avg_snap_share_pct":round(sum(x[2] for x in observations)/len(observations)*100,1),
    "recent_three_snap_pct":[round(x[2]*100,1) for x in recent],
    "weeks_with_snap_data":len(observations),"latest_snap_week":recent[-1][0],
    "games_with_offense_snap_record":sum(x[1]>0 for x in observations),
    "source":"nflverse 2026 PFR-derived snap counts; "+URL,"as_of":today}
 out={"as_of":today,"source":"nflverse 2026 snap counts (CC-BY 4.0), "+URL,
 "matching_method":"Exact normalized player name + NFL team; ambiguous matches skipped.",
 "unavailable_metrics":["routes_run","route_participation_pct","target_share_pct","practice_participation","injury_designation"],
 "caveats":["Snap appearances are not a complete medical or injury history.",
           "Missing rows cannot be inferred as games missed.",
           "Recent three rows are observed appearances, not necessarily last three calendar weeks."],
 "match_count":len(results),"ambiguous_rows":ambiguous,"players":results}
 (DATA/"external_metrics.json").write_text(json.dumps(out,indent=2,ensure_ascii=False,sort_keys=True)+"\n",encoding="utf-8")
 print(f"Stored {len(results)} 2026 NFL offensive snap profiles; ambiguous rows skipped {ambiguous}")
if __name__=="__main__":main()
