#!/usr/bin/env python3
"""Estimate observed league fantasy scoring variability from completed rounds only.

Descriptive historical sample, not validated forward forecast residuals.
"""
import json,statistics,datetime as dt
from pathlib import Path
D=Path(__file__).resolve().parent/"data"
def calculate(snapshot):
 current=int(snapshot["nfl_state"]["week"])
 last=int(snapshot["league"]["settings"].get("last_scored_leg",current-1))
 maxweek=min(current-1,last)
 records=[]
 for week in range(1,maxweek+1):
  matches=snapshot.get("matchups_by_week",{}).get(str(week),[])
  for row in matches:
   pts=row.get("points")
   if isinstance(pts,(int,float)) and row.get("roster_id") is not None:
    records.append({"week":week,"roster_id":row["roster_id"],"points":float(pts)})
 allpoints=[r["points"] for r in records]
 if len(allpoints)<24:return {"status":"insufficient_completed_scores","observations":len(records)}
 by_team={}
 for row in records:by_team.setdefault(row["roster_id"],[]).append(row["points"])
 residuals=[]
 for row in records:
  scores=by_team[row["roster_id"]]
  if len(scores)>1:
   leaveout=(sum(scores)-row["points"])/(len(scores)-1)
   residuals.append(row["points"]-leaveout)
 return {"status":"descriptive_historical_sample","completed_weeks":maxweek,
  "observations":len(records),"mean_total_points":round(statistics.mean(allpoints),2),
  "observed_total_score_sd":round(statistics.stdev(allpoints),2),
  "leave_one_out_team_residual_sd":round(statistics.stdev(residuals),2) if len(residuals)>1 else None,
  "model_sd_points":round(statistics.stdev(residuals),2) if len(residuals)>1 else None,
  "method":"Leave-one-out residual from each team's other completed weekly scores; unadjusted for changing lineups and schedules.",
  "warning":"Observed score variability is not forecast error calibration. Only genuine archived pregame forecasts can measure predictive accuracy."}
def main():
 snapshot=json.loads((D/"latest.json").read_text())
 out=calculate(snapshot)
 out["as_of"]=dt.datetime.now(dt.timezone.utc).isoformat()
 (D/"SCORING_VARIABILITY.json").write_text(json.dumps(out,indent=2,sort_keys=True)+"\n")
 print("Scoring variability:",out["status"],out["observations"])
if __name__=="__main__":main()
