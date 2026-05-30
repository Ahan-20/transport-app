-- Two flags on students for off-system tracking:
--   is_foundation  — the student is enrolled through the Sanctum Foundation
--                    (subsidised seats); useful for accounting + reporting.
--   form_submitted — the parent has submitted the printed transport form.
-- Both default to 0 (false) so existing rows behave unchanged.
ALTER TABLE students ADD COLUMN is_foundation  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN form_submitted INTEGER NOT NULL DEFAULT 0;
