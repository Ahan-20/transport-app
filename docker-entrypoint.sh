#!/bin/sh
# Runs as root. Railway mounts the persistent volume at $DATABASE_PATH's
# parent dir owned by root, so the unprivileged `nextjs` user can't write to
# it (= "attempt to write a readonly database" from SQLite). Fix ownership
# of the data dir, then drop privileges to nextjs and exec the real command.
set -e

DATA_DIR="$(dirname "${DATABASE_PATH:-/app/data/transport.db}")"
mkdir -p "$DATA_DIR"
chown -R nextjs:nodejs "$DATA_DIR"

# `exec su-exec` replaces the shell, so tini's PID-1 + signal handling still
# reaches the node process for clean SIGTERM → WAL checkpoint on shutdown.
exec su-exec nextjs:nodejs "$@"
