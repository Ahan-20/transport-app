-- The correlated subqueries in getPendingStudents, getDriverMonthBreakdown, and
-- listStudents all filter by (student_id, fiscal_year, month_code) together.
-- The existing idx_payments_student (student_id only) and idx_payments_period
-- (fiscal_year, month_code only) each only partially cover these queries.
-- A composite covering index eliminates the residual row-level scans.
CREATE INDEX IF NOT EXISTS idx_payments_student_period
    ON monthly_payments(student_id, fiscal_year, month_code);
