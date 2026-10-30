#!/usr/bin/env bash
# AADI one-command installer for a fresh Ubuntu VPS.
#   curl -fsSL https://raw.githubusercontent.com/praveengpai/aadi-learning-platform/platform-v1/deploy/install.sh | bash -s <cloud-domain> <hub-domain>
# Safe to re-run: updates the code and restarts, keeping data volumes and the sync key.
set -euo pipefail
CLOUD_DOMAIN="${1:?usage: install.sh <cloud-domain> <hub-domain>}"
HUB_DOMAIN="${2:?usage: install.sh <cloud-domain> <hub-domain>}"
BRANCH="${AADI_BRANCH:-platform-v1}"
DIR=/opt/aadi

echo "==> Installing prerequisites"
if ! command -v docker >/dev/null 2>&1; then curl -fsSL https://get.docker.com | sh; fi
command -v git >/dev/null 2>&1 || (apt-get update -qq && apt-get install -y -qq git)
systemctl enable --now docker >/dev/null 2>&1 || true

echo "==> Fetching AADI ($BRANCH)"
if [ -d "$DIR/.git" ]; then git -C "$DIR" fetch -q --depth 1 origin "$BRANCH" && git -C "$DIR" reset -q --hard FETCH_HEAD
else git clone -q --depth 1 -b "$BRANCH" https://github.com/praveengpai/aadi-learning-platform "$DIR"; fi

cd "$DIR/deploy"
if [ ! -f .env ]; then
  printf 'CLOUD_DOMAIN=%s\nHUB_DOMAIN=%s\nAADI_SYNC_KEY=%s\nAADI_HUB_HAMLETS=\n' "$CLOUD_DOMAIN" "$HUB_DOMAIN" "$(openssl rand -hex 32)" > .env
  chmod 600 .env
else
  sed -i "s|^CLOUD_DOMAIN=.*|CLOUD_DOMAIN=$CLOUD_DOMAIN|; s|^HUB_DOMAIN=.*|HUB_DOMAIN=$HUB_DOMAIN|" .env
fi

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q active; then ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; fi

echo "==> Building and starting (first build takes a few minutes)"
docker compose up -d --build

echo "==> Nightly backups at 02:15"
( crontab -l 2>/dev/null | grep -v aadi/deploy/backup.sh; echo "15 2 * * * $DIR/deploy/backup.sh >> /var/log/aadi-backup.log 2>&1" ) | crontab -

for i in $(seq 1 60); do
  if docker compose exec -T aadi-cloud wget -qO- http://127.0.0.1:8080/api/core/health >/dev/null 2>&1; then break; fi; sleep 3
done
docker compose ps
echo
echo "AADI is up:  https://$CLOUD_DOMAIN   (hub: https://$HUB_DOMAIN)"
echo "HTTPS certificates are issued automatically once DNS points here (can take a few minutes)."
