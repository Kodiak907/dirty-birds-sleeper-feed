-- PFO 6.43 DRAFT ONLY. DO NOT MIGRATE LIVE D1 before unified release gates.
-- Correction revision ledger for independent MSF-certified, amended final
-- player scores. The original pfo_accuracy_final_certificates record is
-- IMMUTABLE and stays intact as revision zero. This is separate ACCURACY D1;
-- NEVER run against COMMISSIONER_DB or the public Pages configuration.
CREATE TABLE IF NOT EXISTS pfo_accuracy_final_revisions (
  season INTEGER NOT NULL CHECK(season=2026),
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  revision_index INTEGER NOT NULL CHECK(revision_index>=1),
  prior_points REAL NOT NULL,
  corrected_points REAL NOT NULL,
  rules_version TEXT NOT NULL,
  msf_corrected_at TEXT NOT NULL,
  certified_at TEXT NOT NULL,
  provider_correction_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY(season,game_id,player_id,revision_index),
  FOREIGN KEY(season,game_id,player_id)
    REFERENCES pfo_accuracy_final_certificates(season,game_id,player_id)
);
CREATE INDEX IF NOT EXISTS idx_final_revision_latest
  ON pfo_accuracy_final_revisions(season,game_id,player_id,revision_index DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_final_revision_provider_id
  ON pfo_accuracy_final_revisions(season,game_id,player_id,provider_correction_id);
CREATE TRIGGER IF NOT EXISTS immutable_accuracy_revisions_update
  BEFORE UPDATE ON pfo_accuracy_final_revisions
  BEGIN SELECT RAISE(ABORT,'immutable_accuracy_revision'); END;
CREATE TRIGGER IF NOT EXISTS immutable_accuracy_revisions_delete
  BEFORE DELETE ON pfo_accuracy_final_revisions
  BEGIN SELECT RAISE(ABORT,'immutable_accuracy_revision'); END;
