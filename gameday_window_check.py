#!/usr/bin/env python3
"""Schedule-aware NFL gameday read-only check, about one hour before kickoff.

Uses ESPN event start times as schedule signals ONLY, not game-status evidence.
Windows: 45–75 minutes to kickoff. GitHub cron can be delayed, so no exact
minute guarantee. All distinct kickoff times are handled, including primetime.
"""
import datetime as dt,json,subprocess,sys,urllib.request
from pathlib import Path
D=Path(__file__).resolve().parent/"data"
BASE="https://site.api.espn.com/apis/site/v2/sports/football/nfl"
def upcoming(events,now):
 groups={}
 for e in events:
  try:kick=dt.datetime.fromisoformat(e["date"].replace("Z","+00:00"))
  except (KeyError,ValueError,TypeError):continue
  mins=(kick-now).total_seconds()/60
  if 45<=mins<=75:
   groups.setdefault(kick.isoformat(),[]).append({"id":e.get("id"),"name":e.get("name")})
 return groups
def main():
 now=dt.datetime.now(dt.timezone.utc)
 latest=json.loads((D/"latest.json").read_text(encoding="utf-8"))
 season=latest["nfl_state"]["season"];week=latest["nfl_state"]["week"]
 req=urllib.request.Request(f"{BASE}/scoreboard?dates={season}&week={week}&seasontype=2&limit=40",
     headers={"User-Agent":"DirtyBirdsFFO/1.0"})
 with urllib.request.urlopen(req,timeout=25) as response:data=json.load(response)
 windows=upcoming(data.get("events",[]),now)
 if not windows:
  print("No NFL kickoffs within 45–75 minute pregame window; skip.")
  return
 for code in ("update.py","fetch_game_inactives.py","verify_official_inactives.py","gameday_decision.py"):
  subprocess.run([sys.executable,code],check=True)
 report={"checked_at_utc":now.isoformat(),"target_minutes_before_kickoff":60,
   "acceptance_window_minutes":[45,75],"kickoff_groups":windows,
   "official_status":"Official NFL inactives NOT independently guaranteed by this pipeline.",
   "third_party_source":"ESPN game summaries, may omit official inactive lists",
   "no_lineup_moves":True}
 (D/"GAMEDAY_WINDOW_CHECK.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf-8")
 print("Checked upcoming NFL kickoff windows:",len(windows))
if __name__=="__main__":main()
