"""PFO 6.43 offline SQLite test of D1 append-only correction schema.
No Cloudflare network, credentials, Commissioner database or D1 mutations.
"""
import json
import pathlib
import re
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parent
RULES_VERSION = "2026-11-05-ffl-screen-recording-verified-v4"


def correction_insert_sql():
    source = (ROOT / "ffo-msf-final-corrections-643.mjs").read_text()
    match = re.search(r"const INSERT=\[([\s\S]*?)\]\.join\(' '\);", source)
    if not match:
        raise AssertionError("Actual PFO 6.43 source SQL expression was changed")
    fragments = re.findall(r"'([^']*)'", match.group(1))
    assert len(fragments) >= 10
    return " ".join(fragments)


def db():
    connection = sqlite3.connect(":memory:")
    connection.execute("PRAGMA foreign_keys=ON")
    connection.executescript((ROOT / "accuracy-migrations/0001_accuracy_ledger.sql").read_text())
    connection.executescript((ROOT / "accuracy-migrations/0002_final_correction_revisions.sql").read_text())
    original = {"certified": True, "provider": "MSF", "rulesVersion": RULES_VERSION,
                "gameId": "g101", "playerId": "18607", "points": 18}
    connection.execute(
        "INSERT INTO pfo_accuracy_final_certificates"
        " (season,game_id,player_id,week,position,actual_points,rules_version,certified_at,payload_json)"
        " VALUES (?,?,?,?,?,?,?,?,?)",
        (2026, "g101", "18607", 10, "QB", 18, RULES_VERSION,
         "2026-11-08T22:00:00.000Z", json.dumps(original)))
    return connection


def params(index, before, after, provider_id):
    record = {
        "schema": "PFO_643_MSF_FINAL_CORRECTION_REVISION_V1",
        "gameId": "g101", "playerId": "18607", "revisionIndex": index,
        "priorPoints": before, "correctedPoints": after, "rulesVersion": RULES_VERSION,
        "certificate": {"certified": True, "provider": "MSF",
                        "gameId": "g101", "playerId": "18607", "points": after}
    }
    return (
        2026, "g101", "18607", index, before, after, RULES_VERSION,
        "2026-11-08T22:05:00.000Z", "2026-11-08T22:10:00.000Z",
        provider_id, json.dumps(record),
        2026, "g101", "18607", RULES_VERSION,
        2026, "g101", "18607", index - 1,
        2026, "g101", "18607",
        2026, "g101", "18607", before,
    )


class TestAccuracyCorrectionsSQLite(unittest.TestCase):
    def setUp(self):
        self.conn = db()
        self.insert = correction_insert_sql()

    def tearDown(self):
        self.conn.close()

    def test_immutable_schema_has_original_three_and_two_new_triggers(self):
        entries = self.conn.execute(
            "SELECT type,name FROM sqlite_master WHERE "
            "name LIKE 'pfo_accuracy_%' OR name LIKE 'immutable_accuracy_%'"
        ).fetchall()
        tables = [n for typ, n in entries if typ == "table"]
        triggers = [n for typ, n in entries if typ == "trigger"]
        self.assertEqual(len(tables), 4)
        self.assertEqual(len(triggers), 8)
        self.assertNotIn("COMMISSIONER_DB", self.insert)
        self.assertNotIn("UPDATE ", self.insert)
        self.assertNotIn("DELETE ", self.insert)

    def test_first_revision_is_atomic_and_original_final_is_untouched(self):
        self.assertEqual(len(params(1, 18, 18.5, "corr1")), 26)
        first = self.conn.execute(self.insert, params(1, 18, 18.5, "corr1"))
        self.assertEqual(first.rowcount, 1)
        again = self.conn.execute(self.insert, params(1, 18, 18.5, "corr1"))
        self.assertEqual(again.rowcount, 0)
        original = self.conn.execute(
            "SELECT actual_points FROM pfo_accuracy_final_certificates "
            "WHERE game_id='g101' AND player_id='18607'"
        ).fetchone()[0]
        self.assertEqual(original, 18)
        self.assertEqual(self.conn.execute(
            "SELECT count(*) FROM pfo_accuracy_final_revisions"
        ).fetchone()[0], 1)

    def test_skipped_revision_and_wrong_prior_points_cannot_be_written(self):
        self.assertEqual(self.conn.execute(
            self.insert, params(3, 19, 20, "corr3")).rowcount, 0)
        self.assertEqual(self.conn.execute(
            self.insert, params(1, 19, 20, "corr1")).rowcount, 0)
        self.assertEqual(self.conn.execute(
            self.insert, params(1, 18, 18.5, "corr1")).rowcount, 1)
        self.assertEqual(self.conn.execute(
            self.insert, params(2, 18, 19.5, "corr2")).rowcount, 0)
        self.assertEqual(self.conn.execute(
            self.insert, params(2, 18.5, 19.5, "corr2")).rowcount, 1)
        latest = self.conn.execute(
            "SELECT revision_index,corrected_points FROM pfo_accuracy_final_revisions "
            "ORDER BY revision_index DESC LIMIT 1").fetchone()
        self.assertEqual(latest, (2, 19.5))

    def test_updates_deletes_and_duplicate_provider_event_are_blocked(self):
        self.conn.execute(self.insert, params(1, 18, 18.5, "corr1"))
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "UPDATE pfo_accuracy_final_revisions SET corrected_points=30")
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute("DELETE FROM pfo_accuracy_final_revisions")
        self.assertEqual(self.conn.execute(
            self.insert, params(2, 18.5, 19.5, "corr1")).rowcount, 0)


if __name__ == "__main__":
    unittest.main()
