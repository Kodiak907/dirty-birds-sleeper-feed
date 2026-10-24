#!/usr/bin/env python3
"""Read-only Phase V: evidence-based trade valuation research.

Uses league settings and realized Sleeper weekly player points.
Historical points are NOT rest-of-season projections; the engine never
claims a projected trade winner without an externally verified forecast.
"""
import json, math, statistics
from pathlib import Path
from datetime import datetime, timezone

DATA=Path(__file__).resolve().parent/"data"
def load(n, fallback=None):
    p=DATA/n
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else fallback
def save(n,o):
    (DATA/n).write_text(json.dumps(o,ensure_ascii=False,indent=2,sort_keys=True)+"\n",encoding="utf-8")
def mark(n,txt):
    (DATA/n).write_text(txt+"\n",encoding="utf-8")
def round2(n):return round(n,2)
def main():
    d=load("latest.json",{})
    names=load("player_names.json",{})
    if not d.get("rosters") or not d.get("matchups_by_week"):raise ValueError("Incomplete league snapshot")
    settings=d.get("league",{}).get("settings",{})
    scores=d.get("league",{}).get("scoring_settings",{})
    slots=d.get("league",{}).get("roster_positions",[])
    if scores.get("rec")!=0.5 or slots.count("FLEX")!=2:raise ValueError("League differs from supported 0.5 PPR two-FLEX configuration")
    week=int((d.get("nfl_state") or {}).get("week",1))
    completed=list(range(1,week))
    if not completed:raise ValueError("No completed weeks to model")
    history={}
    for w in completed:
        for m in d["matchups_by_week"].get(str(w),[]) or []:
            for pid,pts in (m.get("players_points") or {}).items():
                try:v=float(pts)
                except (TypeError,ValueError):continue
                history.setdefault(str(pid),{})[w]=v
    users={str(u.get("user_id")):u for u in d["users"]}
    tx={str(t["transaction_id"]):t for bucket in d["transactions_by_week"].values() for t in (bucket or []) if t.get("transaction_id")}
    profiles=[]
    for r in sorted(d["rosters"],key=lambda z:z["roster_id"]):
        user=users.get(str(r.get("owner_id")),{})
        team=((user.get("metadata") or {}).get("team_name") or user.get("display_name") or "").strip()
        players=[]
        for pid in r.get("players") or []:
            p=names.get(str(pid),{})
            position=p.get("position") or ("DEF" if len(str(pid))<=3 else "UNKNOWN")
            values=history.get(str(pid),{})
            vals=[values.get(w,0.0) for w in completed]
            npositive=sum(abs(v)>0.01 for v in vals)
            # Absence cannot be distinguished from a genuinely zero-point week.
            players.append({"id":str(pid),"name":p.get("name") or str(pid),"position":position,
              "n_weeks":len(completed),"nonzero_weeks":npositive,
              "actual_points_total":round2(sum(vals)),"actual_points_weekly_avg":round2(statistics.mean(vals)),
              "weekly_points":[round2(v) for v in vals],
              "on_fantasy_reserve":str(pid) in (r.get("reserve") or [])})
        bypos={pos:sorted([p for p in players if p["position"]==pos],key=lambda p:p["actual_points_weekly_avg"],reverse=True)
               for pos in ["QB","RB","WR","TE","K","DEF"]}
        # Optimize observed average lineup under 1QB/2RB/2WR/1TE/2FLEX/K/DEF.
        base=[]
        for pos,count in [("QB",1),("RB",2),("WR",2),("TE",1),("K",1),("DEF",1)]:
            base.extend(bypos[pos][:count])
        taken={p["id"] for p in base}
        flex=sorted([p for p in players if p["position"] in ("RB","WR","TE") and p["id"] not in taken],
                    key=lambda p:p["actual_points_weekly_avg"],reverse=True)[:2]
        ideal=base+flex
        total=sum(p["actual_points_weekly_avg"] for p in ideal)
        tr=sum(t.get("status")=="complete" and t.get("type")=="trade" for t in tx.values() if r["roster_id"] in (t.get("roster_ids") or []))
        profile={"roster_id":r["roster_id"],"team":team,"record":f'{r["settings"]["wins"]}-{r["settings"]["losses"]}',
          "players":players,"positions":bypos,"completed_trade_count":tr,
          "observed_optimal_average":round2(total),
          "observed_optimal_lineup":[{"name":p["name"],"position":p["position"],"avg":p["actual_points_weekly_avg"]} for p in ideal],
          "note":"Observed average lineup is a retrospective heuristic, NOT a projection or feasible past lineup."}
        profiles.append(profile)
    result={"generated_at_utc":datetime.now(timezone.utc).isoformat(),"snapshot_utc":d.get("fetched_at_utc"),
       "source":"Sleeper historical per-player matchup points, 2026 Weeks 1-"+str(week-1),
       "league":{"teams":settings.get("num_teams"),"receptions":scores["rec"],
                 "lineup":slots,"trade_deadline_week_setting":settings.get("trade_deadline"),
                 "playoff_week_start":settings.get("playoff_week_start")},
       "critical_limitations":["Points history is retrospective, not future projection.",
           "Player matchup values may show zero from inactive/bye weeks, not just poor performance.",
           "Historical optimal lineup cannot infer weekly injury status or ownership eligibility.",
           "No automated injuries, routes, snap shares or rest-of-season projections are provided.",
           "Do not approve trades or estimate championship odds from these numbers alone."],
       "profiles":profiles}
    save("valuation_latest.json",result)
    me=next(p for p in profiles if p["roster_id"]==1)
    lines=["# Dirty Birds — Phase V Trade Valuation Research","","Generated: "+result["generated_at_utc"],
      "Sleeper snapshot: "+str(d.get("fetched_at_utc")),"",
      "**MODEL STATUS: historical production screening only. No automatic fair-trade verdicts or championship probabilities.**","",
      "League: 12 teams; half-PPR; 1 QB / 2 RB / 2 WR / 1 TE / 2 FLEX / K / DEF.",
      "Trade deadline week setting: "+str(settings.get("trade_deadline")),"",
      "## Dirty Birds historical production signals",
      "The points below average actual fantasy scoring over completed Weeks 1–"+str(week-1)+
      ", with zeroes included. They are NOT future projections.","",
      "| Player | Pos | Total pts | Pts per calendar week | Nonzero weeks |",
      "|---|---|---:|---:|---:|"]
    for p in sorted(me["players"],key=lambda p:-p["actual_points_weekly_avg"]):
        lines.append(f'| {p["name"]} | {p["position"]} | {p["actual_points_total"]:.2f} | {p["actual_points_weekly_avg"]:.2f} | {p["nonzero_weeks"]}/{p["n_weeks"]} |')
    lines.extend(["","## Opponent historical lineup signal",
       "Illustrative lineup using best season-to-date averages, not an achievable or recommended lineup.","",
       "| Team | Record | Historical optimal average | Completed trades |",
       "|---|---|---:|---:|"])
    for p in sorted(profiles,key=lambda p:-p["observed_optimal_average"]):
        lines.append(f'| {p["team"].replace("|","/")} | {p["record"]} | {p["observed_optimal_average"]:.2f} | {p["completed_trade_count"]} |')
    lines.extend(["","## Trade evaluation gate","","Before recommending any particular player exchange, verify:",
       "1. Latest NFL active/IR status, medical updates, snaps, routes and actual workload.",
       "2. Current independent rest-of-season half-PPR projections/ranks with dates and sources.",
       "3. Byes, remaining regular season and fantasy playoff opponents.",
       "4. Dirty Birds two-FLEX lineup change, opportunity cost and replacement player.",
       "5. Other manager's roster needs and trade history; willingness is UNKNOWN unless confirmed.","",
       "No trades, offers, roster moves or FAAB bids are executed by this script."])
    mark("VALUATION.md","\n".join(lines))
    print(f'Valuation research ready: {len(profiles)} teams, {len(completed)} completed weeks')
if __name__=="__main__":main()
