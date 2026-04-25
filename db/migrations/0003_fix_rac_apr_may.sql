-- Fix missing APR and MAY 2026 payments for two RAC route students
-- whose payments were in the xlsx but not imported:
--   MOHIT MEENA (id lookup by name in route 18) fee=1600
--   YOGESH MEENA (id lookup by name in route 18) fee=1600

INSERT OR IGNORE INTO monthly_payments (student_id, fiscal_year, month_code, amount_paid, paid_on, entered_at)
SELECT s.id, 2026, 'APR', 1600, '2025-04-01', datetime('now')
FROM students s
WHERE s.route_id = 18 AND s.name LIKE '%MOHIT MEENA%';

INSERT OR IGNORE INTO monthly_payments (student_id, fiscal_year, month_code, amount_paid, paid_on, entered_at)
SELECT s.id, 2026, 'MAY', 1600, '2025-05-01', datetime('now')
FROM students s
WHERE s.route_id = 18 AND s.name LIKE '%MOHIT MEENA%';

INSERT OR IGNORE INTO monthly_payments (student_id, fiscal_year, month_code, amount_paid, paid_on, entered_at)
SELECT s.id, 2026, 'APR', 1600, '2025-04-01', datetime('now')
FROM students s
WHERE s.route_id = 18 AND s.name = 'YOGESH MEENA';

INSERT OR IGNORE INTO monthly_payments (student_id, fiscal_year, month_code, amount_paid, paid_on, entered_at)
SELECT s.id, 2026, 'MAY', 1600, '2025-05-01', datetime('now')
FROM students s
WHERE s.route_id = 18 AND s.name = 'YOGESH MEENA';
