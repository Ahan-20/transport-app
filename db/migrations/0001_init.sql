-- Transport Management System — initial schema
-- Fiscal year runs APR (month 0) → MAR (month 11). Store fiscal_year as the APR year
-- (e.g. 2026 = APR 2026 … MAR 2027, which corresponds to the Indian academic year 2026-27).

PRAGMA foreign_keys = ON;

CREATE TABLE schools (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE drivers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  commission_percent REAL NOT NULL DEFAULT 10,
  sub_driver TEXT,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX idx_drivers_name ON drivers(name);

CREATE TABLE vehicles (
  id INTEGER PRIMARY KEY,
  plate TEXT UNIQUE NOT NULL,
  capacity INTEGER,
  type TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE routes (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  driver_id INTEGER NOT NULL REFERENCES drivers(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_routes_driver ON routes(driver_id);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  sno INTEGER,
  name TEXT NOT NULL,
  name_hindi TEXT,
  class TEXT,
  driver_id INTEGER NOT NULL REFERENCES drivers(id),
  route_id INTEGER REFERENCES routes(id),
  pickup_address TEXT,
  monthly_fee REAL NOT NULL DEFAULT 0,
  contact TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_students_driver ON students(driver_id);
CREATE INDEX idx_students_route ON students(route_id);
CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_students_status ON students(status);

CREATE TABLE monthly_payments (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id),
  fiscal_year INTEGER NOT NULL,
  month_code TEXT NOT NULL,
  amount_paid REAL,
  paid_on TEXT,
  mode TEXT,
  ref_no TEXT,
  notes TEXT,
  entered_by INTEGER REFERENCES users(id),
  entered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, fiscal_year, month_code)
);
CREATE INDEX idx_payments_period ON monthly_payments(fiscal_year, month_code);
CREATE INDEX idx_payments_student ON monthly_payments(student_id);

CREATE TABLE driver_payment_log (
  id INTEGER PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES drivers(id),
  fiscal_year INTEGER NOT NULL,
  month_code TEXT NOT NULL,
  amount REAL NOT NULL,
  paid_on TEXT NOT NULL,
  mode TEXT,
  ref_no TEXT,
  notes TEXT,
  entered_by INTEGER REFERENCES users(id),
  entered_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_driver_pay_log_period ON driver_payment_log(driver_id, fiscal_year, month_code);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  entity TEXT NOT NULL,
  entity_id INTEGER,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);

CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO config (key, value) VALUES
  ('fiscal_months', 'APR,MAY,JUN,JUL,AUG,SEP,OCT,NOV,DEC,JAN,FEB,MAR'),
  ('current_fiscal_year', '2026'),
  ('academic_year_label', '2026-27'),
  ('currency', 'INR'),
  ('default_commission_percent', '10'),
  ('transport_head_email', 'advopavan.sanctum@gmail.com'),
  ('cc_emails', 'ahangupta2007@gmail.com,prakashswami.sanctum@gmail.com,lokesh.sanctum@gmail.com'),
  ('pending_alert_days', '15');

INSERT INTO schools (code, name) VALUES
  ('SWS', 'Sanctum World School'),
  ('SA', 'Sanctum Academy');
