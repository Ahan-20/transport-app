-- Reset admin password to a known value. Migration runs once (recorded in
-- _migrations) so it's idempotent — won't re-reset if the admin later changes
-- their password through some future password-change UI.
UPDATE users
   SET password_hash = '$2b$10$gLWhSl5pX.EtFSSzmm3xled/3K7dOhRyhTJRWAa3WgTxUsj.An8FK'
 WHERE username = 'admin';
