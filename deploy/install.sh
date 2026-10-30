#!/usr/bin/env bash
# AADI one-command installer for an Ubuntu VPS.
#   curl -fsSL https://raw.githubusercontent.com/praveengpai/aadi-learning-platform/platform-v1/deploy/install.sh | bash -s <cloud-domain> <hub-domain>
# Safe to re-run: updates the code and restarts, keeping data volumes and the sync key.
# Leaves anything else on the server alone. If a web server already owns ports 80/443:
#   - system Caddy  -> AADI's sites are added to it via an import file, validated, then reloaded gracefully
#   - anything else -> AADI runs on 127.0.0.1:8181/8182 and the script prints the proxy lines to add
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
  printf 'CLOUD_DOMAIN=%s\nHUB_DOMAIN=%s\nAADI_SYNC_KEY=%s\nAADI_HUB_HAMLETS=\nAADI_CLOUD_PORT=8181\nAADI_HUB_PORT=8182\n' "$CLOUD_DOMAIN" "$HUB_DOMAIN" "$(openssl rand -hex 32)" > .env
  chmod 600 .env
else
  sed -i "s|^CLOUD_DOMAIN=.*|CLOUD_DOMAIN=$CLOUD_DOMAIN|; s|^HUB_DOMAIN=.*|HUB_DOMAIN=$HUB_DOMAIN|" .env
  grep -q '^AADI_CLOUD_PORT=' .env || echo 'AADI_CLOUD_PORT=8181' >> .env
  grep -q '^AADI_HUB_PORT=' .env || echo 'AADI_HUB_PORT=8182' >> .env
fi
set -a; . ./.env; set +a

# Who owns port 80? (ignore our own old caddy container, if any)
docker rm -f deploy-caddy-1 >/dev/null 2>&1 || true
PORT80_OWNER=$(ss -ltnpH 'sport = :80' 2>/dev/null | sed -n 's/.*users:(("\([^"]*\)".*/\1/p' | head -1)

echo "==> Building and starting (first build takes a few minutes)"
if [ -z "$PORT80_OWNER" ]; then
  MODE=own-caddy
  if command -v ufw >/dev/null 2>&1 && ufw status | grep -q active; then ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; fi
  docker compose --profile caddy up -d --build --remove-orphans
else
  MODE=existing:$PORT80_OWNER
  docker compose up -d --build --remove-orphans
fi

for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$AADI_CLOUD_PORT/api/core/health" >/dev/null 2>&1; then break; fi; sleep 3
done

if [ "$MODE" = "existing:caddy" ] && [ -f /etc/caddy/Caddyfile ]; then
  echo "==> Adding AADI to the server's existing Caddy (other sites untouched)"
  cat > /etc/caddy/aadi.caddy <<CADDY
# Managed by AADI deploy/install.sh
$CLOUD_DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:$AADI_CLOUD_PORT
}
$HUB_DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:$AADI_HUB_PORT
}
CADDY
  cp -n /etc/caddy/Caddyfile /etc/caddy/Caddyfile.before-aadi 2>/dev/null || true
  grep -q 'import /etc/caddy/aadi.caddy' /etc/caddy/Caddyfile || printf '\nimport /etc/caddy/aadi.caddy\n' >> /etc/caddy/Caddyfile
  if caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
    systemctl reload caddy && echo "    Caddy reloaded."
  else
    echo "!!  Caddy config did not validate — undoing the AADI addition; your other sites are unaffected."
    sed -i '\|import /etc/caddy/aadi.caddy|d' /etc/caddy/Caddyfile
    caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1 | tail -5
    exit 1
  fi
elif [ "$MODE" != "own-caddy" ]; then
  echo "!!  Port 80 is used by '$PORT80_OWNER'. AADI is running on 127.0.0.1:$AADI_CLOUD_PORT (cloud) and :$AADI_HUB_PORT (hub)."
  echo "    Add reverse-proxy entries for $CLOUD_DOMAIN and $HUB_DOMAIN in that web server."
fi

echo "==> Nightly backups at 02:15"
{ crontab -l 2>/dev/null | grep -v aadi/deploy/backup.sh || true; echo "15 2 * * * $DIR/deploy/backup.sh >> /var/log/aadi-backup.log 2>&1"; } | crontab -

docker compose ps
echo
echo "AADI is up:  https://$CLOUD_DOMAIN   (hub: https://$HUB_DOMAIN)"
echo "HTTPS certificates are issued automatically once DNS points here (can take a few minutes)."
