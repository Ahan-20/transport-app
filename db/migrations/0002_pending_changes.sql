CREATE TABLE pending_changes (
  id INTEGER PRIMARY KEY,
  requested_by INTEGER NOT NULL REFERENCES users(id),
  entity TEXT NOT NULL,
  entity_id INTEGER,
  action TEXT NOT NULL DEFAULT 'UPDATE',
  before_json TEXT,
  after_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by INTEGER REFERENCES users(id),
  decided_at TEXT,
  decision_notes TEXT,
  requested_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_pending_status ON pending_changes(status);
CREATE INDEX idx_pending_entity ON pending_changes(entity, entity_id);
