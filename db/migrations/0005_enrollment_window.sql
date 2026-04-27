-- Per-student enrollment window for the current fiscal year.
-- NULL means "from APR" (start) or "through MAR" (end) — the full-year
-- default. Existing students stay NULL on both columns and behave
-- identically to before this migration.
ALTER TABLE students ADD COLUMN start_month TEXT;
ALTER TABLE students ADD COLUMN end_month   TEXT;

-- Tiny lookup table so SQL can compare a month code against a fiscal-year
-- index. Mirrors src/lib/fiscal.ts MONTHS exactly (no JUN — summer break).
CREATE TABLE fiscal_months (
  code TEXT PRIMARY KEY,
  idx  INTEGER NOT NULL UNIQUE
);
INSERT INTO fiscal_months (code, idx) VALUES
  ('APR', 0), ('MAY', 1), ('JUL', 2), ('AUG', 3), ('SEP', 4),
  ('OCT', 5), ('NOV', 6), ('DEC', 7), ('JAN', 8), ('FEB', 9), ('MAR', 10);
