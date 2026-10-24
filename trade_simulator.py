#!/usr/bin/env python3
"""Read-only what-if trade simulator. Never posts transactions.

Usage:
 python trade_simulator.py --give "Patrick Mahomes" --receive "Jaylen Waddle"
 python trade_simulator.py --give "A.J. Brown,Michael Mayer" --receive "Chris Olave" --projections data/ros_projections.json

External projection file schema:
 {"as_of":"2026-10-24","scoring":"half_ppr","source":"SOURCE NAME AND URL",
  "players":{"Bijan Robinson":{"ppg":18.5,"status":"active","games_remaining":9}, ...}}
All modeled players require explicit ppg; no silent use of historical averages.
"""
import argparse,json,sys,re,unicodedata
from pathlib import Path
DATA=Path(__file__).resolve().parent/"data"
POSITIONS=["QB","RB","RB","WR","WR","TE","FLEX","FLEX","K","DEF"]
def read(name):return json.loads(Path(name).read_text(encoding="utf-8"))
def normalize_player_name(name):
    raw=unicodedata.normalize("NFKD",name).casefold()
    return re.sub(r"[^a-z0-9]", "",raw)
def resolve_player_ids(player_inputs,names):
    index={}
    for pid,meta in names.items():
        label=meta.get("name")
        if label:
            index.setdefault(normalize_player_name(label),set()).add(str(pid))
    result=[]
    for submitted in player_inputs:
        ids=index.get(normalize_player_name(submitted),set())
        if not ids:
            raise ValueError(f"Unrecognized player '{submitted}'. Check Sleeper player names.")
        if len(ids)>1:
            raise ValueError(f"Ambiguous player '{submitted}' matches multiple Sleeper IDs; use a more specific identifier.")
        result.append(next(iter(ids)))
    if len(set(result))!=len(result):
        raise ValueError("Duplicate player in a trade; check spelling and punctuation.")
    return result
def lineup(roster,proj,byname):
    pool=[]
    for pid in roster:
        n=byname.get(str(pid),{})
        k=n.get("name",str(pid))
        x=proj.get(k)
        if x and isinstance(x.get("ppg"),(int,float)):
            pool.append({"id":str(pid),"name":k,"pos":n.get("position"),"ppg":float(x["ppg"]),"source_status":x.get("status","unverified")})
    # Exact maximum-weight legal roster with 1 QB, 2 RB, 2 WR, 1 TE, 2 flex, 1K, 1DEF.
    chosen=[]
    for p,cnt in [("QB",1),("RB",2),("WR",2),("TE",1),("K",1),("DEF",1)]:
        opts=sorted([v for v in pool if v["pos"]==p and v not in chosen],key=lambda x:x["ppg"],reverse=True)
        chosen.extend(opts[:cnt])
    opts=sorted([v for v in pool if v["pos"] in ("RB","WR","TE") and v not in chosen],key=lambda x:x["ppg"],reverse=True)
    chosen.extend(opts[:2])
    complete=len(chosen)==10 and sum(x["pos"]=="QB" for x in chosen)==1 and sum(x["pos"]=="K" for x in chosen)==1 and sum(x["pos"]=="DEF" for x in chosen)==1
    return {"projected_ppg":round(sum(v["ppg"] for v in chosen),2),"complete":complete,"starters":chosen}
def run(give,receive,projection_path):
    d=read(DATA/"latest.json")
    names=read(DATA/"player_names.json")
    ps=read(projection_path)
    if ps.get("scoring")!="half_ppr" or not ps.get("source") or not ps.get("as_of"):
        raise ValueError("Projection input requires half_ppr, source, as_of")
    pp=ps.get("players") or {}
    roster=d["rosters"]
    mine=next(r for r in roster if r["roster_id"]==1)
    allp={str(pid):r["roster_id"] for r in roster for pid in (r.get("players") or [])}
    a=[s.strip() for s in give.split(",") if s.strip()]
    b=[s.strip() for s in receive.split(",") if s.strip()]
    if not a or not b or len(set(a))!=len(a) or len(set(b))!=len(b):
        raise ValueError("Give and receive distinct player names")
    ids_a=resolve_player_ids(a,names);ids_b=resolve_player_ids(b,names)
    if set(ids_a)&set(ids_b):raise ValueError("Same player appears on both sides of the proposed trade")
    if any(allp.get(k)!=1 for k in ids_a):raise ValueError("Outgoing player is not on Dirty Birds")
    owners={allp.get(k) for k in ids_b}
    if len(owners)!=1 or 1 in owners or None in owners:raise ValueError("Received players must be on same opposing fantasy roster")
    other_id=owners.pop()
    other=next(r for r in roster if r["roster_id"]==other_id)
    roster_a=[str(x) for x in mine.get("players") or []]
    roster_b=[str(x) for x in other.get("players") or []]
    new_a=[x for x in roster_a if x not in ids_a]+ids_b
    new_b=[x for x in roster_b if x not in ids_b]+ids_a
    needed=set([names.get(x,{}).get("name",x) for x in roster_a+roster_b])
    # Require projections for all players currently owned by either team to avoid understated lineups.
    missing=sorted(needed-set(pp))
    if missing:raise ValueError("Missing PPG projections (no result calculated): "+", ".join(missing))
    now_a=lineup(roster_a,pp,names);after_a=lineup(new_a,pp,names)
    now_b=lineup(roster_b,pp,names);after_b=lineup(new_b,pp,names)
    if not all(x["complete"] for x in (now_a,after_a,now_b,after_b)):raise ValueError("Cannot fill legal fantasy lineup under supplied projections")
    # Optional externally sourced advanced metrics; no silent numerical injury discount.
    metrics_path=DATA/"external_metrics.json"
    advanced=read(metrics_path) if metrics_path.exists() else {}
    metrics_players=advanced.get("players") or {}
    priority_fields=[
      "snap_share_pct","snap_count","routes_run","route_participation_pct",
      "targets_per_game","target_share_pct","air_yards_share_pct",
      "rush_attempts_per_game","red_zone_opportunities_per_game",
      "yards_per_route_run","yards_after_contact_per_attempt",
      "games_played","games_missed","injury_designation",
      "practice_participation","team_offense_context","bye_week",
      "remaining_schedule_strength","playoff_schedule_strength"]
    metric_audit=[]
    for k,pid in zip(a+b,ids_a+ids_b):
        record=metrics_players.get(pid,metrics_players.get(k,{}))
        present=[field for field in priority_fields if record.get(field) is not None]
        metric_audit.append({"player":k,"fields_present":present,
          "fields_missing":[field for field in priority_fields if field not in present],
          "source":record.get("source") or advanced.get("source"),
          "as_of":record.get("as_of") or advanced.get("as_of")})
    schedule_path=DATA/"nfl_schedule.json"
    sched=read(schedule_path) if schedule_path.exists() else {}
    current_names=read(DATA/"player_names.json")
    schedule_checks=[]
    for player,pid in zip(a+b,ids_a+ids_b):
        team=(current_names.get(pid) or {}).get("team")
        schedule_checks.append({"player":player,"nfl_team":team,
          "weeks_15_17":{str(w):((sched.get("teams") or {}).get(team,{}).get("weeks") or {}).get(str(w))
                     for w in (15,16,17)},
          "note":"Schedule is factual; difficulty and medical-adjusted forecasts not modeled."})
    result={"disclaimer":"What-if only; input PPG not verified by simulator. Not an offer or fair-trade determination.",
      "source":ps["source"],"projection_as_of":ps["as_of"],"league_snapshot_utc":d.get("fetched_at_utc"),
      "give":a,"receive":b,"other_roster_id":other_id,
      "advanced_metric_audit":metric_audit,
      "playoff_schedule_audit":schedule_checks,
      "durability_note":"Past injury and missed-game rates describe historical availability; they cannot predict future injury with certainty.",
      "dirty_birds":{"before":now_a,"after":after_a,"delta_ppg":round(after_a["projected_ppg"]-now_a["projected_ppg"],2)},
      "counterparty":{"before":now_b,"after":after_b,"delta_ppg":round(after_b["projected_ppg"]-now_b["projected_ppg"],2)},
      "risks":["Model uses a single per-game value: it cannot model weekly byes or playoff schedules.",
               "Projections may be stale, unavailable due to injury or inaccurate.",
               "2-for-1 trades may require separate fantasy roster drops.",
               "No value assigned to FAAB, keeper rights or trade-veto risks."]}
    print(json.dumps(result,indent=2))
def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--give",required=True)
    ap.add_argument("--receive",required=True)
    ap.add_argument("--projections",default="data/ros_projections.json")
    args=ap.parse_args()
    try:run(args.give,args.receive,args.projections)
    except (ValueError,FileNotFoundError) as e:sys.exit("VALUATION INPUT ERROR: "+str(e))
if __name__=="__main__":main()
