#!/usr/bin/env python3
"""Read-only FFL trade market board and opponent-change surveillance.

Run after update.py and radar.py. No Sleeper write calls; uses saved snapshot.
Reports are scouting hypotheses, not offers or verified manager intentions.
"""
import datetime as dt
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"

def read(name, default):
    p = DATA / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default

def write(name, obj):
    (DATA / name).write_text(json.dumps(obj, indent=2, ensure_ascii=False, sort_keys=True)+"\n", encoding="utf-8")

def md(name, text):
    (DATA / name).write_text(text+"\n", encoding="utf-8")

def name_of(pid, players):
    return players.get(str(pid), {}).get("name") or str(pid)

def main():
    snap = read("latest.json", {})
    if not snap.get("rosters"):
        raise ValueError("Sleeper roster snapshot missing")
    players = read("player_names.json", {})
    users = {str(u.get("user_id")):u for u in snap.get("users", [])}
    txs = {str(t["transaction_id"]):t for bucket in snap.get("transactions_by_week", {}).values() for t in (bucket or []) if t.get("transaction_id")}
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    rosters = snap["rosters"]
    prior = read("scouting_state.json", None)
    previous = (prior or {}).get("rosters", {})
    roster_names = {}
    profiles = []
    current = {}
    changes = []
    for r in sorted(rosters, key=lambda x:x["roster_id"]):
        rid = str(r["roster_id"])
        u = users.get(str(r.get("owner_id")), {})
        team = (u.get("metadata") or {}).get("team_name") or u.get("display_name") or rid
        team = team.strip()
        roster_names[rid] = team
        ids = set(r.get("players") or [])
        positions = {"QB":[],"RB":[],"WR":[],"TE":[],"K":[],"DEF":[]}
        for pid in ids:
            p = players.get(str(pid), {})
            pos = p.get("position") or ("DEF" if isinstance(pid,str) and len(pid)<=3 else "OTHER")
            positions.setdefault(pos,[]).append(name_of(pid,players))
        for v in positions.values():v.sort()
        tt = [t for t in txs.values() if int(r["roster_id"]) in (t.get("roster_ids") or [])]
        complete_trades = sum(t.get("type")=="trade" and t.get("status")=="complete" for t in tt)
        paid = [{"player":name_of(p,players),"bid":t.get("settings",{}).get("waiver_bid",0)}
                for t in tt if t.get("type")=="waiver" and t.get("status")=="complete" and (t.get("settings") or {}).get("waiver_bid",0)>0
                for p,target in (t.get("adds") or {}).items() if str(target)==rid]
        s = r.get("settings") or {}
        profile = {"id":int(rid),"team":team,"manager":u.get("display_name"),"record":f'{s.get("wins",0)}-{s.get("losses",0)}',
            "points_for":s.get("fpts",0)+s.get("fpts_decimal",0)/100,
            "faab_used":s.get("waiver_budget_used"),"positions":positions,
            "trades_completed":complete_trades,"successful_paid_waivers":paid,
            "trade_eligibility":"research only; no known active offer"}
        profiles.append(profile)
        current[rid] = {"players":sorted(ids),"reserve":sorted(r.get("reserve") or []),"team":team,"record":profile["record"]}
        if rid in previous:
            old=previous[rid]
            added=sorted(ids-set(old.get("players") or []))
            dropped=sorted(set(old.get("players") or [])-ids)
            if added or dropped:
                changes.append({"roster_id":int(rid),"team":team,
                    "adds":[name_of(p,players) for p in added],
                    "drops":[name_of(p,players) for p in dropped]})
            if (r.get("reserve") or []) != (old.get("reserve") or []):
                changes.append({"roster_id":int(rid),"team":team,"kind":"reserve_change"})
    # Trade events are based on durable radar detections, not historic archive replays.
    radar = read("radar_latest.json", {})
    newtrades = []
    for ch in radar.get("changes", []):
        t=ch.get("transaction") or {}
        if t.get("type")=="trade" and t.get("status")=="complete" and ch.get("kind") in ("new_transaction","status_change"):
            newtrades.append({"id":str(t.get("transaction_id")),
                              "roster_ids":t.get("roster_ids") or [],
                              "players_received":{name_of(p,players):roster_names.get(str(r),str(r)) for p,r in (t.get("adds") or {}).items()},
                              "faab_transfers":t.get("waiver_budget") or []})
    newtrades = list({t["id"]:t for t in newtrades}.values())
    update = {"generated_at_utc":now,"source_snapshot_utc":snap.get("fetched_at_utc"),
       "is_initial_baseline":prior is None,"roster_changes":changes,
       "new_completed_trades":newtrades}
    write("scouting_latest.json", update)
    history=read("scouting_history.json",[])
    if prior is not None and (changes or newtrades):
        history.append(update)
    write("scouting_history.json",history)
    write("scouting_state.json",{"last_checked_utc":now,"rosters":current})
    write("trade_market.json",{"generated_at_utc":now,"source_snapshot_utc":snap.get("fetched_at_utc"),
       "note":"Research-only; counts/imbalances are not valuations, offers, or intentions.","profiles":profiles})
    lines=["# Dirty Birds — Trade Market Intelligence","","Generated: "+now,
           "Sleeper snapshot: "+str(snap.get("fetched_at_utc")),"",
           "**Research only. No active offers inferred; no transaction actions performed.**","",
           "| Team | Record | QB / RB / WR / TE | Completed trades | FAAB used |",
           "|---|---|---|---:|---:|"]
    for p in profiles:
        counts=" / ".join(str(len(p["positions"][k])) for k in ["QB","RB","WR","TE"])
        lines.append(f'| {p["team"].replace("|","/")} | {p["record"]} | {counts} | {p["trades_completed"]} | {p["faab_used"]} |')
    lines.extend(["","## Reading this board","",
       "- Positional counts flag potential surplus/needs, not actual trade availability.",
       "- Completed-trade counts demonstrate activity, not future willingness or player value.",
       "- FAAB used is cumulative and may include amounts traded away.",
       "- Refer to trade_market.json for named players and successful paid waiver bids."])
    md("TRADE_MARKET.md","\n".join(lines))
    lines=["# Dirty Birds — Opponent Scouting Radar","","Generated: "+now,
           "Sleeper snapshot: "+str(snap.get("fetched_at_utc")),""]
    if prior is None:
        lines += ["**Baseline established; existing rosters indexed without retroactive alerts.**"]
    elif not changes and not newtrades:
        lines += ["No roster changes or newly completed trades detected since previous scouting run."]
    else:
        lines += [f'Roster change entries: {len(changes)}. New completed trade entries: {len(newtrades)}.',""]
        for c in changes:
            if c.get("kind")=="reserve_change":
                lines.append(f'- {c["team"]}: reserve status changed')
            else:
                lines.append(f'- {c["team"]}: added {", ".join(c["adds"]) or "none"}; dropped {", ".join(c["drops"]) or "none"}')
        for t in newtrades:
            lines.append(f'- Completed trade {t["id"]}: {t["players_received"]}; FAAB transfers {t["faab_transfers"]}')
    lines += ["","## Limits","","- Change means detected between saved hourly snapshots; not necessarily an action performed this hour.",
       "- Historical moves are not presented as new on initialization.",
       "- Reports do not include private offers, manager motivations, NFL injury news or player valuations.",
       "- Source is public Sleeper data; output is read-only."]
    md("SCOUTING_RADAR.md","\n".join(lines))
    print(f'Scouting ready: {len(profiles)} rosters; {len(changes)} roster changes; {len(newtrades)} completed trade detections; baseline={prior is None}')

if __name__ == "__main__":
    main()
