-- PFO accuracy is an entirely separate D1 database.
-- Do not apply to COMMISSIONER_DB; do not share existing league metadata.
CREATE TABLE IF NOT EXISTS pfo_accuracy_forecasts (
 season INTEGER NOT NULL CHECK(season=2026),
 game_id TEXT NOT NULL, player_id TEXT NOT NULL,
 week INTEGER NOT NULL CHECK(week BETWEEN 1 AND 18),
 position TEXT NOT NULL CHECK(position IN ('QB','RB','WR','TE','K','DEF')),
 team TEXT NOT NULL, opponent TEXT NOT NULL,
 projected_points REAL NOT NULL, rules_version TEXT NOT NULL,
 model_version TEXT NOT NULL, captured_at TEXT NOT NULL,
 kickoff_at TEXT NOT NULL, source_asof TEXT NOT NULL,
 provisional INTEGER NOT NULL CHECK(provisional=1),
 source_provider TEXT NOT NULL CHECK(source_provider='MSF'),
 payload_json TEXT NOT NULL,
 PRIMARY KEY(season,game_id,player_id)
);
CREATE TABLE IF NOT EXISTS pfo_accuracy_final_certificates (
 season INTEGER NOT NULL CHECK(season=2026),
 game_id TEXT NOT NULL, player_id TEXT NOT NULL,
 week INTEGER NOT NULL CHECK(week BETWEEN 1 AND 18),
 position TEXT NOT NULL, actual_points REAL NOT NULL,
 rules_version TEXT NOT NULL, certified_at TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 PRIMARY KEY(season,game_id,player_id)
);
CREATE TABLE IF NOT EXISTS pfo_accuracy_verified_games (
 season INTEGER NOT NULL CHECK(season=2026),
 game_id TEXT NOT NULL,
 week INTEGER NOT NULL CHECK(week BETWEEN 1 AND 18),
 kickoff_at TEXT NOT NULL,
 provider TEXT NOT NULL CHECK(provider='MSF'),
 verified INTEGER NOT NULL CHECK(verified=1),
 status TEXT NOT NULL CHECK(status IN ('FINAL','COMPLETED','FINAL_OT','FINAL_OVERTIME')),
 payload_json TEXT NOT NULL,
 PRIMARY KEY(season,game_id)
);
CREATE INDEX IF NOT EXISTS idx_forecast_week ON pfo_accuracy_forecasts(week);
CREATE INDEX IF NOT EXISTS idx_final_week ON pfo_accuracy_final_certificates(week);
CREATE INDEX IF NOT EXISTS idx_game_week ON pfo_accuracy_verified_games(week);
CREATE TRIGGER IF NOT EXISTS immutable_accuracy_forecasts_update BEFORE UPDATE ON pfo_accuracy_forecasts BEGIN SELECT RAISE(ABORT,'immutable_forecast'); END;
CREATE TRIGGER IF NOT EXISTS immutable_accuracy_forecasts_delete BEFORE DELETE ON pfo_accuracy_forecasts BEGIN SELECT RAISE(ABORT,'immutable_forecast'); END;
CREATE TRIGGER IF NOT EXISTS immutable_accuracy_final_update BEFORE UPDATE ON pfo_accuracy_final_certificates BEGIN SELECT RAISE(ABORT,'immutable_final_cert'); END;
CREATE TRIGGER IF NOT EXISTS immutable_accuracy_final_delete BEFORE DELETE ON pfo_accuracy_final_certificates BEGIN SELECT RAISE(ABORT,'immutable_final_cert'); END;
CREATE TRIGGER IF NOT EXISTS immutable_accuracy_games_update BEFORE UPDATE ON pfo_accuracy_verified_games BEGIN SELECT RAISE(ABORT,'immutable_game'); END;
CREATE TRIGGER IF NOT EXISTS immutable_accuracy_games_delete BEFORE DELETE ON pfo_accuracy_verified_games BEGIN SELECT RAISE(ABORT,'immutable_game'); END;
