-- Reads every session transcript once into the temp tables a measures file and the stored tables are built from.
-- counting.py sets the variable `transcripts` (a glob of .jsonl files), runs this file, then the measures file.
--   texts(s, day, ts, uuid, txt)             each text block an agent wrote
--   calls(s, day, ts, uuid, tool, arg, bg)   each tool call: its command, file path or skill; bg = run in the background
--   typed(s, day, ts, uuid, body)            each message the user typed
--   stamps(s, ts, stamp)                     each stamp the trial hook gave a session, and when
--   sessions(s, day, ...)                    one row per session and day (UTC): project, model, effort, tokens, stamps
-- A measures file then makes chances(measure, s, day, ts, uuid, miss): one row per moment a rule could be broken.
CREATE TEMP TABLE raw AS
SELECT j ->> 'uuid' AS uuid, j ->> 'sessionId' AS s, j ->> 'timestamp' AS ts, j ->> 'type' AS kind,
       j ->> 'turnOrigin' AS origin, j ->> 'entrypoint' AS entrypoint, j ->> 'effort' AS effort,
       coalesce((j ->> 'isMeta')::BOOL, false) OR coalesce((j ->> 'isCompactSummary')::BOOL, false) AS note,
       j -> 'message' ->> 'model' AS model, j -> 'message' ->> 'id' AS message,
       (j -> 'message' -> 'usage' ->> 'input_tokens')::BIGINT + coalesce((j -> 'message' -> 'usage' ->> 'cache_creation_input_tokens')::BIGINT, 0)
         + coalesce((j -> 'message' -> 'usage' ->> 'cache_read_input_tokens')::BIGINT, 0) AS tokens_in,
       (j -> 'message' -> 'usage' ->> 'output_tokens')::BIGINT AS tokens_out,
       CASE WHEN (j ->> 'type') = 'assistant' THEN j -> 'message' -> 'content' END AS blocks,
       CASE WHEN (j -> 'attachment' ->> 'type') = 'queued_command' AND (j -> 'attachment' ->> 'commandMode') = 'prompt'
              THEN j -> 'attachment' ->> 'prompt'
            WHEN (j ->> 'type') = 'user' AND json_type(j -> 'message' -> 'content') = 'VARCHAR' THEN j -> 'message' ->> 'content'
            WHEN (j ->> 'type') = 'user' THEN array_to_string(json_extract_string(j, '$.message.content[*].text'), chr(10)) END AS body,
       coalesce((j -> 'attachment' ->> 'type') = 'queued_command', false) AS queued,
       -- The hook's first line: the session's trial groups, holdout, task and rules version (docs/architecture.md#hook).
       -- The content is a JSON array of strings, read here as its JSON text, so the line ends at an escaped newline.
       CASE WHEN (j -> 'attachment' ->> 'type') = 'hook_additional_context'
            THEN nullif(regexp_extract(j -> 'attachment' ->> 'content', 'Rule trials: ([^\n"\\]*)', 1), '') END AS stamp,
       regexp_extract(replace(filename, '\', '/'), '/([^/]+)/[^/]+$', 1) AS project
FROM read_ndjson_objects(getvariable('transcripts'), ignore_errors = true,
                         maximum_object_size = 268435456, filename = true) AS t(j, filename)
WHERE (j ->> 'uuid') IS NOT NULL AND NOT coalesce((j ->> 'isSidechain')::BOOL, false)
  AND (j ->> 'type') IN ('user', 'assistant', 'attachment');

-- A continued session copies its parent's entries under its own id, so each entry is counted for the session that
-- started first, and that session is the root a continuation's trial groups must match.
CREATE TEMP TABLE started AS SELECT s, min(ts) AS first_ts, max(ts) AS last_ts FROM raw GROUP BY s;
CREATE TEMP TABLE e AS
SELECT DISTINCT ON (uuid) raw.*, started.first_ts FROM raw JOIN started USING (s) ORDER BY uuid, first_ts, last_ts;  -- a continuation copies its parent's first entry too; the parent ends first
CREATE TEMP TABLE roots AS
SELECT raw.s, arg_min(e.s, e.ts) AS root FROM raw JOIN e USING (uuid) GROUP BY raw.s;

CREATE TEMP TABLE blocks AS
SELECT s, left(ts, 10) AS "day", ts, uuid, unnest(json_extract(blocks, '$[*]')) AS b FROM e WHERE kind = 'assistant';
CREATE TEMP TABLE texts AS
SELECT s, "day", ts, uuid, b ->> 'text' AS txt FROM blocks WHERE (b ->> 'type') = 'text';
CREATE TEMP TABLE calls AS
SELECT s, "day", ts, uuid, b ->> 'name' AS tool,
       coalesce(b -> 'input' ->> 'command', b -> 'input' ->> 'file_path', b -> 'input' ->> 'skill', '') AS arg,
       coalesce((b -> 'input' ->> 'run_in_background')::BOOL, false) AS bg
FROM blocks WHERE (b ->> 'type') = 'tool_use';
-- Text that starts with < is a harness note or another agent.
CREATE TEMP TABLE typed AS
SELECT * FROM (
  SELECT s, left(ts, 10) AS "day", ts, uuid,
         trim(regexp_replace(body, '(?s)<system-reminder>.*?</system-reminder>', '', 'g')) AS body
  FROM e WHERE NOT note AND body IS NOT NULL AND (queued OR origin = 'human'))
WHERE body <> '' AND body NOT LIKE '<%';

-- From raw, not e: a continuation holds a copy of its parent's stamp, which is when its groups were first given.
CREATE TEMP TABLE stamps AS SELECT DISTINCT s, ts, stamp FROM raw WHERE stamp IS NOT NULL;

CREATE TEMP TABLE sessions AS
WITH api AS (  -- one API message is several entries, each repeating its usage
  SELECT s, left(min(ts), 10) AS "day", message, max(tokens_in) AS tokens_in, max(tokens_out) AS tokens_out,
         any_value(model) AS model, any_value(effort) AS effort
  FROM e WHERE kind = 'assistant' AND model <> '<synthetic>' GROUP BY s, message),
use AS (
  SELECT s, "day", sum(tokens_in) AS tokens_in, sum(tokens_out) AS tokens_out, mode(model) AS model,
         mode(effort) AS effort, count(*) AS replies
  FROM api GROUP BY s, "day"),
said AS (SELECT s, "day", count(*) AS typed FROM typed GROUP BY s, "day"),
about AS (SELECT s, any_value(project) AS project, any_value(entrypoint) AS entrypoint FROM raw GROUP BY s),
stamped AS (SELECT s, string_agg(DISTINCT stamp, ' | ') AS stamps FROM stamps GROUP BY s)
SELECT use.s, use."day", about.project, about.entrypoint, use.model, use.effort, use.replies,
       coalesce(said.typed, 0) AS typed, use.tokens_in, use.tokens_out, roots.root, stamped.stamps
FROM use JOIN about USING (s) JOIN roots USING (s)
LEFT JOIN stamped USING (s)
LEFT JOIN said ON said.s = use.s AND said."day" = use."day";
