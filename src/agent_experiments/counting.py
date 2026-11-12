"""Counting: reads the transcripts and the user's measures into the experiments file (docs/architecture.md#counting)."""

from importlib.resources import files
from pathlib import Path

import duckdb

# The tables counting never rebuilds, run against whichever database is in use.
SCHEMA = """
CREATE TABLE IF NOT EXISTS looks (
  trial VARCHAR, started VARCHAR, measure VARCHAR, look INTEGER, "day" VARCHAR, tasks_off INTEGER, tasks_on INTEGER,
  rate_off DOUBLE, rate_on DOUBLE, "drop" DOUBLE, low DOUBLE, high DOUBLE, p DOUBLE, verdict VARCHAR,
  PRIMARY KEY (trial, started, measure, look));
CREATE TABLE IF NOT EXISTS replays (
  folder VARCHAR PRIMARY KEY, measure VARCHAR, "day" VARCHAR, in_force VARCHAR, moments INTEGER, paired INTEGER,
  sessions INTEGER, rate_old DOUBLE, rate_new DOUBLE, "drop" DOUBLE, low DOUBLE, high DOUBLE, p DOUBLE,
  real_rate DOUBLE, replay_rate DOUBLE, verdict VARCHAR);
CREATE TABLE IF NOT EXISTS sizes (
  n INTEGER, "commit" VARCHAR, "day" VARCHAR, pattern VARCHAR, file VARCHAR, words INTEGER, added INTEGER,
  deleted INTEGER);
"""


def count(transcripts: str, measures: Path, db: Path) -> None:
    """Rebuilds the sessions, stamps and chances tables in `db` from a glob of transcripts and a measures file."""
    con = duckdb.connect()
    con.execute("SET VARIABLE transcripts = ?", [transcripts.replace("\\", "/")])
    con.execute(files(__package__).joinpath("sessions.sql").read_text(encoding="utf-8"))
    con.execute(measures.read_text(encoding="utf-8"))
    con.execute("CREATE TEMP TABLE IF NOT EXISTS measure_names (measure VARCHAR, name VARCHAR)")
    con.execute('CREATE TEMP TABLE IF NOT EXISTS changes (measure VARCHAR, "day" VARCHAR, what VARCHAR)')
    db.parent.mkdir(parents=True, exist_ok=True)
    # The temp tables share the stored tables' names, so the file is attached under its own name.
    con.execute(f"ATTACH '{str(db).replace("'", "''")}' AS store")
    con.execute("USE store")
    con.execute(SCHEMA)
    con.execute("USE memory")
    con.execute("BEGIN")
    con.execute("""
        CREATE OR REPLACE TABLE store.sessions AS
        SELECT s AS session, * EXCLUDE (s) FROM temp.sessions ORDER BY "day", session;
        CREATE OR REPLACE TABLE store.stamps AS SELECT s AS session, ts, stamp FROM temp.stamps ORDER BY session, ts;
        CREATE OR REPLACE TABLE store.chances AS
        SELECT measure, s AS session, "day", ts, uuid, miss FROM temp.chances ORDER BY measure, "day", session, ts;
        CREATE OR REPLACE TABLE store.measure_names AS SELECT measure, name FROM temp.measure_names;
        CREATE OR REPLACE TABLE store.changes AS SELECT measure, "day"::VARCHAR AS "day", what FROM temp.changes;
    """)
    con.execute("COMMIT")
    con.close()
