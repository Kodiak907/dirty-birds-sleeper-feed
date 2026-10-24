#!/usr/bin/env python3
"""Unit tests for fail-closed Phase VII evidence and kickoff gates."""
import datetime as dt,unittest
from verify_official_inactives import validate
from gameday_window_check import upcoming
from gameday_alerts import status,make_alerts
class PhaseVII(unittest.TestCase):
 def setUp(self):
  self.now=dt.datetime(2026,10,24,17,0,tzinfo=dt.timezone.utc)
  self.good={"season":2026,"week":7,"status":"inactive","sleeper_player_id":"1",
   "source_url":"https://www.nfl.com/news/example",
   "published_at_utc":"2026-10-24T16:00:00Z","verified_at_utc":"2026-10-24T16:30:00Z","verified_by":"Coach"}
 def test_valid_official_entry(self):
  self.assertEqual(validate(self.good,2026,7,{"1":{"name":"Example"}},self.now),[])
 def test_unverified_fails(self):
  d={**self.good};d.pop("verified_by")
  self.assertIn("missing_human_verification",validate(d,2026,7,{"1":{}},self.now))
 def test_wrong_week_rejected(self):
  self.assertIn("season_week_mismatch",validate(self.good,2026,8,{"1":{}},self.now))
 def test_future_evidence_rejected(self):
  d={**self.good,"published_at_utc":"2026-10-25T16:00:00Z"}
  self.assertIn("invalid_publication_timestamp",validate(d,2026,7,{"1":{}},self.now))
 def test_kickoff_window(self):
  events=[{"id":"a","date":"2026-10-24T18:00:00Z"},{"id":"b","date":"2026-10-24T17:25:00Z"}]
  result=upcoming(events,self.now)
  self.assertEqual(len(result),1)
 def test_no_missing_as_active(self):
  alerts=make_alerts({"week":7,"player_statuses":[]},{"sleeper_snapshot_utc":"2026-10-24T16:00:00Z"},{"status":"no_verified_official_submissions"},{"errors":[]},self.now)
  self.assertTrue(any(a["kind"]=="official_unverified" for a in alerts))
 def test_stale_source(self):
  self.assertEqual(status("2026-10-24T14:00:00Z",self.now,90),"stale")
if __name__=="__main__":unittest.main()
