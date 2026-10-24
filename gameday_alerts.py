#!/usr/bin/env python3
"""Phase VII reliability and actionable alerts; read-only, no push notifications.

Never infer active from missing reports. The JSON alerts are for review and
may be surfaced by a separate connected notification system later.
"""
import datetime as dt,json
from pathlib import Path
D=Path(__file__).resolve().parent/"data"
def load(p):
 f=D/p
 return json.loads(f.read_text()) if f.exists() else {}
def parse(v):
 try:return dt.datetime.fromisoformat(v.replace("Z","+00:00"))
 except (ValueError,AttributeError):return None
def status(record,now,max_minutes):
 t=parse(record)
 if t is None:return "unknown"
 return "stale" if (now-t).total_seconds()>max_minutes*60 else "recent"
def make_alerts(decision,availability,official,espn,now):
 alerts=[]
 week=decision.get("week")
 current=availability.get("sleeper_snapshot_utc")
 if status(current,now,90)!="recent":
  alerts.append({"kind":"source_stale","severity":"high","message":"Sleeper roster/injury data is stale or missing"})
 if official.get("status")!="manual_official_evidence_available":
  alerts.append({"kind":"official_unverified","severity":"review","message":"No verified official NFL inactive submissions; do not label unlisted players active"})
 if espn.get("errors"):
  alerts.append({"kind":"third_party_errors","severity":"review","message":"Third-party game report errors; do not infer active status"})
 for r in decision.get("sleeper_discrepancies",[]):
  alerts.append({"kind":"source_conflict","severity":"high","player":r.get("player"),"message":"Reported inactive contradicts Sleeper tag; check original game report"})
 for r in decision.get("player_statuses",[]):
  if r.get("availability_verified") and r.get("model_handling")=="exclude_manual_verified_official_inactive":
   alerts.append({"kind":"official_inactive","severity":"high","player":r["name"],"message":"Submitted official-release evidence lists inactive; inspect source link"})
 for a in availability.get("alerts",[]):
  if a.get("owned_by_dirty_birds"):
   alerts.append({"kind":"roster_change","severity":"review","player":a.get("player"),"message":a.get("message")})
 return alerts
def main():
 now=dt.datetime.now(dt.timezone.utc)
 decision=load("GAMEDAY_DECISION.json");av=load("AVAILABILITY_INTELLIGENCE.json")
 official=load("OFFICIAL_INACTIVE_VERIFICATION.json");espn=load("GAME_INACTIVES_EVIDENCE.json")
 alerts=make_alerts(decision,av,official,espn,now)
 out={"generated_at_utc":now.isoformat(),"week":decision.get("week"),
  "alert_count":len(alerts),"alerts":alerts,"delivery":"GitHub report only; no phone push or message connector installed",
  "checks":{"sleeper":status(av.get("sleeper_snapshot_utc"),now,90),
   "espn":status(espn.get("as_of"),now,90),"official_evidence":official.get("status","missing")},
  "caveat":"A missing inactive entry is not evidence that the player is active. Confirm original official NFL/team reports."}
 (D/"GAMEDAY_ALERTS.json").write_text(json.dumps(out,indent=2,sort_keys=True)+"\n")
 lines=["# Dirty Birds — Phase VII Reliability and Alerts","",
  f"Updated {now.isoformat()} | Week {decision.get('week')}","",
  f"**{len(alerts)} review alerts** (GitHub report only; no device push enabled).",""]
 for a in alerts:lines.append(f"- **{a['severity'].upper()}** {a.get('player','Data source')}: {a['message']}")
 lines+=["","## Feed freshness",f"- Sleeper: {out['checks']['sleeper']}",f"- ESPN: {out['checks']['espn']}",
  f"- Official release: {out['checks']['official_evidence']}","","No roster/lineup changes made."]
 (D/"GAMEDAY_ALERTS.md").write_text("\n".join(lines)+"\n")
 print("Gameday review alerts:",len(alerts))
if __name__=="__main__":main()
