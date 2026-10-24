#!/usr/bin/env python3
"""Phase VII read-only gameday decision board.

Hard excludes only explicit Sleeper Out/IR/PUP/Suspended and fantasy reserve.
This is *not* a verified official NFL inactive importer. All others unverified.
"""
import json,datetime as dt
from pathlib import Path
from lineup_impact import build_lineup
D=Path(__file__).resolve().parent/"data"
def read(n):return json.loads((D/n).read_text(encoding="utf-8"))
def main():
 snap=read("latest.json");names=read("player_names.json")
 metadata=read("player_metadata.json")
 projections=read("ros_projections.json")["players"]
 availability=read("AVAILABILITY_INTELLIGENCE.json")
 team=next(r for r in snap["rosters"] if r["roster_id"]==1)
 week=int(snap["nfl_state"]["week"])
 roster=[str(x) for x in team.get("players") or []]
 reserve={str(x) for x in team.get("reserve") or []}
 hard={"out","ir","pup","suspended","sus"}
 watch={"doubtful","questionable","probable"}
 projected={}
 for pid in roster:
  person=names.get(pid,{})
  p=projections.get(person.get("name"),{})
  v=(p.get("weeks") or {}).get(str(week))
  if isinstance(v,(int,float)) and not isinstance(v,bool):projected[person.get("name")]={"ppg":v}
 pre=build_lineup(roster,names,projected,excluded=reserve)
 excluded=set(reserve);risk=[];detail=[]
 for pid in roster:
  p=metadata.get(pid,{})
  status=str(p.get("injury_status") or "").lower()
  item={"id":pid,"name":names.get(pid,{}).get("name",pid),
   "sleeper_injury_status":p.get("injury_status"),
   "fantasy_reserve":pid in reserve,
   "status_source":"Sleeper metadata, not official gameday inactive list",
   "availability_verified":False}
  if status in hard:excluded.add(pid);item["model_handling"]="exclude_explicit_unavailable_tag"
  elif status in watch:risk.append(item["name"]);item["model_handling"]="unverified_availability_review"
  else:item["model_handling"]="unverified_no_hard_exclusion"
  detail.append(item)
 after=build_lineup(roster,names,projected,excluded=excluded)
 b={p["id"] for p in pre.get("starters",[])}
 a={p["id"] for p in after.get("starters",[])}
 result={"generated_at_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
  "snapshot_utc":snap.get("fetched_at_utc"),"week":week,
  "official_game_day_inactives_integrated":False,
  "official_actives_verified":False,
  "model_status":"provisional_sleeper_tags_only",
  "source_availability_generated_at_utc":availability.get("generated_at_utc"),
  "baseline_fantasy_reserve_excluded":pre,
  "hard_status_excluded":after,
  "difference_ppg":round(after["ppg"]-pre["ppg"],2) if pre.get("complete") and after.get("complete") else None,
  "added_starters":[p["name"] for p in after.get("starters",[]) if p["id"] not in b],
  "removed_starters":[p["name"] for p in pre.get("starters",[]) if p["id"] not in a],
  "explicit_excluded_ids":sorted(excluded),"players_needing_review":risk,"player_statuses":detail,
  "warnings":["This is a conditional simulation, not an official starting lineup or verified inactive list.",
  "Sleeper injury flags can be delayed; a blank tag is not confirmation that a player is active.",
  "NFL IR and fantasy reserve are distinct.",
  "Doubtful/questionable cases remain modeled but demand manual review.",
  "Missing weekly projections cause incomplete lineups, not imputed zero points.",
  "Official inactives must be checked near kickoff before any action.",
  "No roster or lineup change performed."]}
 (D/"GAMEDAY_DECISION.json").write_text(json.dumps(result,indent=2,ensure_ascii=False,sort_keys=True)+"\n")
 lines=["# Dirty Birds — Gameday Availability Decision Board","",
  f"Week {week} | Snapshot: {snap.get('fetched_at_utc')}","",
  "**PROVISIONAL: Sleeper injury tags, NOT verified official NFL actives/inactives.**",
  "This report is a read-only scenario showing the impact of explicit unavailable tags.","",
  f"Baseline projected lineup: {pre.get('ppg','incomplete')}.",
  f"Hard-tag exclusion projected lineup: {after.get('ppg','incomplete')}.",
  f"Conditional projected difference: {result['difference_ppg'] if result['difference_ppg'] is not None else 'unavailable'}.","",
  "## Hard-tag excluded from provisional lineup",""]
 for p in detail:
  if p["id"] in excluded:lines.append(f'- {p["name"]} — fantasy reserve: {p["fantasy_reserve"]}; Sleeper injury: {p["sleeper_injury_status"] or "not listed"}')
 if len(excluded)==0:lines.append("None.")
 lines+=["","## Other unresolved status flags",""]
 if risk:lines.extend("- "+n for n in risk)
 else:lines.append("None in Sleeper tags; absence of flags is NOT active confirmation.")
 lines+=["","## Proposed conditional substitutions",""]
 if result["added_starters"]:lines+=["Potentially added: "+", ".join(result["added_starters"])]
 if result["removed_starters"]:lines+=["Potentially removed: "+", ".join(result["removed_starters"])]
 if not result["added_starters"] and not result["removed_starters"]:lines.append("No modeled starter changes.")
 lines+=["","## Mandatory verification","",
  "Official team/NFL gameday inactive lists are **not** integrated. Verify official reports before kickoff.",
  "Do not treat Sleeper Questionable, no tag, or dated nflverse practice participation as game-day active.",
  "Coach alone authorizes lineup changes."]
 (D/"GAMEDAY_DECISION.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
 print("Gameday conditional board:",week,"excluded:",len(excluded),"complete:",after.get("complete"))
if __name__=="__main__":main()
