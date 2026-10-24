#!/usr/bin/env python3
"""ESPN game-event status observations. Third-party reported, NOT certified NFL official.

ESPN game-specific roster statuses are consumed only when they explicitly
identify inactives. A missing listing is NEVER proof of being active.
"""
import json,urllib.request,datetime as dt,re
from pathlib import Path
D=Path(__file__).resolve().parent/"data"
BASE="https://site.api.espn.com/apis/site/v2/sports/football/nfl"
def fetch(url):
 req=urllib.request.Request(url,headers={"User-Agent":"DirtyBirdsResearch/1.0","Accept":"application/json"})
 with urllib.request.urlopen(req,timeout=25) as r:return json.load(r)
def norm(x):return re.sub("[^a-z0-9]","",str(x or "").lower())
def main():
 snap=json.loads((D/"latest.json").read_text())
 names=json.loads((D/"player_names.json").read_text())
 season=snap["nfl_state"]["season"];week=snap["nfl_state"]["week"]
 now=dt.datetime.now(dt.timezone.utc).isoformat()
 out={"as_of":now,"season":season,"week":week,"source":"ESPN game-event summaries",
 "authority":"third_party_reported_not_official_team_submission",
 "verified_official_inactives":False,"status":"no_confirmed_events",
 "events_checked":0,"explicit_inactives":{},"unresolved":[],"errors":[]}
 lookup={}
 for pid,p in names.items():
  if p.get("name"):lookup.setdefault(norm(p["name"]),[]).append(pid)
 try:
  scoreboard=fetch(f"{BASE}/scoreboard?dates={season}&week={week}&seasontype=2&limit=40")
  events=scoreboard.get("events") or []
  if not events:out["errors"].append("No ESPN events returned for this NFL week; no inference allowed")
  for event in events:
   eid=event.get("id")
   if not eid:continue
   try:detail=fetch(f"{BASE}/summary?event={eid}")
   except Exception as error:
    out["errors"].append(f"Event {eid}: {str(error)[:120]}");continue
   out["events_checked"]+=1
   # ESPN summary may provide an explicitly named inactives section; do not
   # derive inactive from box score DNP, missing stats, generic injury status.
   groups=detail.get("inactives")
   if not isinstance(groups,list):continue
   for group in groups:
    team=group.get("team",{}) if isinstance(group,dict) else {}
    candidates=group.get("athletes") or group.get("players") or [] if isinstance(group,dict) else []
    for athlete in candidates:
     a=athlete.get("athlete",athlete) if isinstance(athlete,dict) else {}
     name=a.get("fullName") or a.get("displayName")
     matches=lookup.get(norm(name),[])
     if len(matches)!=1:
      if name:out["unresolved"].append({"name":name,"event_id":eid})
      continue
     pid=matches[0]
     # Game-event inactive list explicitly establishes absence, but source is
     # ESPN reporting and not the NFL official transaction/inactive feed.
     out["explicit_inactives"][pid]={"name":name,"event_id":eid,"team":team.get("abbreviation"),
      "source_url":f"https://www.espn.com/nfl/game/_/gameId/{eid}",
      "source_type":"ESPN reported game inactives","observed_at_utc":now}
  if out["explicit_inactives"]:out["status"]="third_party_explicit_inactives_found"
  elif out["events_checked"]:out["status"]="no_explicit_inactive_listing_present"
 except Exception as e:out["errors"].append("ESPN scoreboard retrieval failed: "+str(e)[:200])
 (D/"GAME_INACTIVES_EVIDENCE.json").write_text(json.dumps(out,indent=2,sort_keys=True)+"\n")
 print("ESPN event checks",out["events_checked"],"explicit",len(out["explicit_inactives"]),"errors",len(out["errors"]))
if __name__=="__main__":main()
