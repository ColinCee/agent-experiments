"""Counting: reads the transcripts and the user's measures into the experiments file (docs/architecture.md#counting)."""

from importlib.resources import files
from pathlib import Path

import duckdb

SCHEMA = """
CREATE TABLE IF NOT EXISTS store.looks (
  trial VARCHAR, measure VARCHAR, look INTEGER, "day" VARCHAR, tasks_off INTEGER, tasks_on INTEGER,
  rate_off DOUBLE, rate_on DOUBLE, "drop" DOUBLE, low DOUBLE, high DOUBLE, p DOUBLE, verdict VARCHAR,
  PRIMARY KEY (trial, measure, look));
"""


def count(transcripts: str, measures: Path, db: Path) -> None:
    """Rebuilds the sessions, stamps and chances tables in `db` from a glob of transcripts and a measures file."""
    con = duckdb.connect()
    con.execute("SET VARIABLE transcripts = ?", [transcripts.replace("\\", "/")])
    con.execute(files(__package__).joinpath("sessions.sql").read_text(encoding="utf-8"))
    con.execute(measures.read_text(encoding="utf-8"))
    db.parent.mkdir(parents=True, exist_ok=True)
    # The temp tables share the stored tables' names, so the file is attached under its own name.
    con.execute(f"ATTACH '{str(db).replace("'", "''")}' AS store")
    con.execute(SCHEMA)
    con.execute("BEGIN")
    con.execute("""
        CREATE OR REPLACE TABLE store.sessions AS
        SELECT s AS session, * EXCLUDE (s) FROM temp.sessions ORDER BY "day", session;
        CREATE OR REPLACE TABLE store.stamps AS SELECT s AS session, ts, stamp FROM temp.stamps ORDER BY session, ts;
        CREATE OR REPLACE TABLE store.chances AS
        SELECT measure, s AS session, "day", ts, uuid, miss FROM temp.chances ORDER BY measure, "day", session, ts;
    """)
    con.execute("COMMIT")
    con.close()
