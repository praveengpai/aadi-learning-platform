#!/bin/sh
# Nightly consistent backup of every node database — keeps 14 days.
# cron:  15 2 * * *  /opt/aadi/deploy/backup.sh
set -e
cd "$(dirname "$0")"
DEST=${DEST:-/opt/aadi-backups}; mkdir -p "$DEST"
for svc in aadi-cloud aadi-hub; do
  docker compose exec -T "$svc" node --disable-warning=ExperimentalWarning scripts/backup.js /app/data/backups
  docker compose cp "$svc":/app/data/backups/. "$DEST/"
  docker compose exec -T "$svc" sh -c 'rm -f /app/data/backups/*.db'
done
find "$DEST" -name '*.db' -mtime +14 -delete
echo "backup ok → $DEST"
