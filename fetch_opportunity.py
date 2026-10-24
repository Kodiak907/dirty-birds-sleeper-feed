#!/usr/bin/env python3
"""nflverse weekly opportunity and injury importer; missing fields remain missing."""
import csv,io,json,urllib.request,datetime as dt,re,collections
from pathlib import Path
D=Path(__file__).resolve().parent/"data"
BASE="https://github.com/nflverse/nflverse-data/releases/download"
URLS={"player_stats":BASE+"/stats_player/stats_player_week_2026.csv",
      "injuries":BASE+"/injuries/injuries_2026.csv",
      "advanced_receiving":BASE+"/pfr_advstats/advstats_week_rec_2026.csv",
      "advanced_rushing":BASE+"/pfr_advstats/advstats_week_rush_2026.csv"}
def norm(s):return re.sub('[^a-z0-9]','',str(s or '').lower())
def fetch(url):
 req=urllib.request.Request(url,headers={"User-Agent":"DirtyBirdsFFO/1.0"})
 with urllib.request.urlopen(req,timeout=35) as h: content=h.read().decode('utf-8-sig')
 return list(csv.DictReader(io.StringIO(content)))
def val(row,*keys):
 for k in keys:
  v=row.get(k)
  try:
   if v not in (None,"","NA"):return float(v)
  except(ValueError,TypeError):pass
 return None
def main():
 meta=json.loads((D/"player_metadata.json").read_text())
 existing=json.loads((D/"external_metrics.json").read_text()) if (D/"external_metrics.json").exists() else {"players":{}}
 look=collections.defaultdict(list)
 for pid,p in meta.items():
  if p.get("position") in ("QB","RB","WR","TE"):
   look[(norm(p.get("name")),norm(p.get("team")))].append(pid)
 records={};status={}
 for group,url in URLS.items():
  try:
   rows=fetch(url)
  except Exception as e:
   status[group]={"loaded":False,"reason":str(e)[:160]}
   continue
  status[group]={"loaded":True,"rows":len(rows),"columns":list(rows[0])[:35] if rows else []}
  for row in rows:
   name=next((row[k] for k in ("player_name","player","full_name","pfr_player_name","name") if row.get(k)),None)
   team=next((row[k] for k in ("recent_team","team","team_abbr","team_name") if row.get(k)),None)
   ids=look.get((norm(name),norm(team)),[])
   if len(ids)!=1:continue
   pid=ids[0]
   week=val(row,"week","game_week")
   if week is None:continue
   ent=records.setdefault(pid,{}).setdefault(group,[])
   ent.append((int(week),row))
 now=dt.datetime.now(dt.timezone.utc).isoformat()
 data=existing.get("players",{})
 for pid,groups in records.items():
  p=data.setdefault(pid,{"name":meta[pid]["name"],"nfl_team":meta[pid].get("team")})
  # Published cumulative opportunity, last three weekly reports
  for g,values in groups.items():
   recent=[v[1] for v in sorted(values,key=lambda z:z[0])[-3:]]
   if g=="player_stats":
    fields={"targets_per_game":("targets",),"rush_attempts_per_game":("carries","rushing_attempts"),
     "receptions_per_game":("receptions",),"red_zone_opportunities_per_game":("carries_inside_10",)}
   elif g=="advanced_receiving":fields={"yards_after_catch_per_reception":("yac_per_rec",),"yards_per_route_run":("yards_per_route_run",)}
   elif g=="advanced_rushing":fields={"yards_after_contact_per_attempt":("yards_after_contact_per_attempt","yards_after_contact")}
   else:fields={}
   for out,keys in fields.items():
    nums=[val(row,*keys) for row in recent]
    nums=[x for x in nums if x is not None]
    if nums:p[out]=round(sum(nums)/len(nums),2)
   if g=="injuries":
    latest=recent[-1]
    p["injury_report_record"]={k:latest.get(k) for k in ("week","report_status","report_primary_injury","report_secondary_injury","practice_status","date_modified") if latest.get(k)}
    p["injury_report_observations"]=len(values)
   p[g+"_weeks_observed"]=len(values)
  p["as_of"]=now
  p["source"]=", ".join(URLS[g] for g in groups)
 out={"as_of":now,"source":"nflverse public 2026 feeds; CC-BY 4.0; https://github.com/nflverse/nflverse-data",
   "data_status":status,"players":data,"warnings":["Missing metrics are not zero.","Injury reports reflect published observations, not medical predictions.","Raw weekly NFL stats do not establish target share without team denominators."]}
 (D/"external_metrics.json").write_text(json.dumps(out,indent=2,ensure_ascii=False,sort_keys=True)+"\n")
 print("External feed coverage:",status)
if __name__=="__main__":main()
