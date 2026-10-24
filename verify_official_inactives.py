#!/usr/bin/env python3
"""Fail-closed verified official gameday evidence ingestion.

Official NFL or NFL-team reports are a HUMAN-VERIFIED input, not an
automatically discoverable official feed. Source URLs and exact player IDs
are explicitly supplied in data/official_inactive_submissions.json and
cross-checked against dates/team. Unverified submissions NEVER become active.
"""
import datetime as dt,json
from pathlib import Path
D=Path(__file__).resolve().parent/"data"
def load(name):return json.loads((D/name).read_text(encoding="utf-8"))
def parse(iso):
 try:
  value=dt.datetime.fromisoformat(iso.replace("Z","+00:00"))
  return value.astimezone(dt.timezone.utc) if value.tzinfo else None
 except (ValueError,AttributeError):return None
def validate(entry,season,week,names,now):
 reasons=[]
 if entry.get("season")!=season or entry.get("week")!=week:reasons.append("season_week_mismatch")
 if entry.get("status")!="inactive":reasons.append("unsupported_status_only_explicit_inactive")
 pid=str(entry.get("sleeper_player_id",""))
 if pid not in names:reasons.append("unknown_sleeper_player_id")
 link=str(entry.get("source_url",""))
 if not (link.startswith("https://www.nfl.com/") or link.startswith("https://nfl.com/") or link.startswith("https://www.") and ".com/" in link and entry.get("source_kind")=="nfl_team_official_release"):
  reasons.append("unsupported_provenance")
 published=parse(entry.get("published_at_utc"))
 if not published or published>now:reasons.append("invalid_publication_timestamp")
 if not entry.get("verified_by") or not entry.get("verified_at_utc"):reasons.append("missing_human_verification")
 verified=parse(entry.get("verified_at_utc"))
 if not verified or verified>now:reasons.append("invalid_verification_timestamp")
 if published and verified and verified<published:reasons.append("verification_predates_publication")
 return reasons
def main():
 latest=load("latest.json");names=load("player_names.json")
 season=int(latest["nfl_state"]["season"]);week=int(latest["nfl_state"]["week"])
 now=dt.datetime.now(dt.timezone.utc)
 file=D/"official_inactive_submissions.json"
 entries=load("official_inactive_submissions.json").get("submissions",[]) if file.exists() else []
 accepted={};rejected=[]
 for entry in entries:
  why=validate(entry,season,week,names,now)
  if why:rejected.append({"entry":entry,"reasons":why});continue
  pid=str(entry["sleeper_player_id"])
  accepted[pid]={"name":names[pid]["name"],"status":"inactive","provenance":"manual_verified_official_release",
   "source_url":entry["source_url"],"published_at_utc":entry["published_at_utc"],
   "verified_at_utc":entry["verified_at_utc"],"verified_by":entry["verified_by"]}
 out={"generated_at_utc":now.isoformat(),"season":season,"week":week,
  "official_release_entries_accepted":len(accepted),"official_release_entries_rejected":len(rejected),
  "confirmed_official_inactives":accepted,"rejected":rejected,
  "automatic_official_feed_available":False,
  "status":"manual_official_evidence_available" if accepted else "no_verified_official_submissions",
  "warnings":["Submission metadata is not cryptographic proof that linked article was accurately read.",
  "Human verification is required. This tool does not browse official URLs or validate article content.",
  "Absence of an inactive submission never means active.",
  "A verified inactive applies to the identified season and week only."]}
 (D/"OFFICIAL_INACTIVE_VERIFICATION.json").write_text(json.dumps(out,indent=2,sort_keys=True)+"\n")
 print("Official evidence:",len(accepted),"accepted,",len(rejected),"rejected")
if __name__=="__main__":main()
