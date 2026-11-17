-- 12-month fee grid: a student's fee for one fiscal month when it differs
-- from students.monthly_fee (route change mid-year, a ₹0 leave month, …).
-- Months without a row fall back to monthly_fee, so existing data is unchanged.
CREATE TABLE IF NOT EXISTS student_month_fees (
  student_id  INTEGER NOT NULL REFERENCES students(id),
  fiscal_year INTEGER NOT NULL,
  month_code  TEXT    NOT NULL REFERENCES fiscal_months(code),
  fee         REAL    NOT NULL CHECK (fee >= 0),
  PRIMARY KEY (student_id, fiscal_year, month_code)
);
