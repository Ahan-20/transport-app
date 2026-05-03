-- Multi-installment student payments. Each row in monthly_payments is now
-- ONE installment toward a (student, fiscal_year, month_code) cell —
-- previously the UNIQUE constraint forced exactly one row per cell, so
-- typing a new amount overwrote the prior payment with no history.
--
-- SQLite can't drop a constraint in place, so we recreate the table:
--   1. spin up monthly_payments_new without the UNIQUE
--   2. copy all existing rows over
--   3. drop the old, rename the new
--   4. recreate the indexes (the composite one we added in 0004 too)
--
-- Existing 790 rows survive untouched: each becomes "the only installment
-- so far" for its cell, and every aggregate (SUM/COUNT) keeps producing
-- the same value it did before.

PRAGMA foreign_keys = OFF;

CREATE TABLE monthly_payments_new (
  id INTEGER PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES students(id),
  fiscal_year INTEGER NOT NULL,
  month_code  TEXT NOT NULL,
  amount_paid REAL,
  paid_on     TEXT,
  mode        TEXT,
  ref_no      TEXT,
  notes       TEXT,
  entered_by  INTEGER REFERENCES users(id),
  entered_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO monthly_payments_new
  (id, student_id, fiscal_year, month_code, amount_paid, paid_on, mode,
   ref_no, notes, entered_by, entered_at)
SELECT
   id, student_id, fiscal_year, month_code, amount_paid, paid_on, mode,
   ref_no, notes, entered_by, entered_at
  FROM monthly_payments;

DROP TABLE monthly_payments;
ALTER TABLE monthly_payments_new RENAME TO monthly_payments;

CREATE INDEX idx_payments_period         ON monthly_payments(fiscal_year, month_code);
CREATE INDEX idx_payments_student        ON monthly_payments(student_id);
CREATE INDEX idx_payments_student_period ON monthly_payments(student_id, fiscal_year, month_code);

PRAGMA foreign_keys = ON;
