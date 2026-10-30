# Deploying the AADI demo to your VPS

Time: about 20 minutes. You need SSH access to the VPS (Ubuntu 22.04/24.04) and two DNS names.

## 1. DNS
Create two **A records** pointing to the VPS IP, for example:
- `aadi-demo.yourdomain.org` → the cloud core (what funders open)
- `hub.aadi-demo.yourdomain.org` → a simulated centre hub (to show offline + sync live)

## 2. Install Docker on the VPS (once)
```bash
ssh root@<vps-ip>
curl -fsSL https://get.docker.com | sh
ufw allow 22,80,443/tcp && ufw --force enable    # if ufw is in use
```

## 3. Copy the platform to the VPS
From the computer that has the `aadi-platform` folder (or unzip the release archive on the VPS):
```bash
scp aadi-platform-v1.0.0.tar.gz root@<vps-ip>:/opt/
ssh root@<vps-ip> 'cd /opt && tar -xzf aadi-platform-v1.0.0.tar.gz'      # creates /opt/aadi
```

## 4. Configure and start
```bash
cd /opt/aadi/deploy
cp .env.example .env
nano .env        # set CLOUD_DOMAIN, HUB_DOMAIN, and AADI_SYNC_KEY=$(openssl rand -hex 32)
docker compose up -d --build
docker compose logs -f aadi-cloud     # first boot seeds the 10 demo hamlets (a few seconds)
```
Open `https://aadi-demo.yourdomain.org` — the login page shows the demo accounts.

To show the offline story, sign in on the hub URL as `demo.steward` → *Sync & resilience* →
**Go offline**, register a learner on the hub, then **Reconnect**: the learner appears on the cloud.

## 5. Backups
```bash
crontab -e
15 2 * * * /opt/aadi/deploy/backup.sh >> /var/log/aadi-backup.log 2>&1
```

## 6. Updating
```bash
cd /opt && tar -xzf aadi-platform-<new-version>.tar.gz    # new release over the old
cd /opt/aadi/deploy && docker compose up -d --build          # data volumes are kept
```

## 7. Resetting the demo to fresh data
```bash
cd /opt/aadi/deploy
docker compose down
docker volume rm deploy_cloud-data deploy_hub-data
docker compose up -d
```

## Health checks
- `https://aadi-demo.yourdomain.org/api/core/health` — node, event count, module states, sync cursors
- Docker restarts any crashed container automatically (`restart: unless-stopped` + HEALTHCHECK).

## Moving to production later
Use a fresh volume without the seed step (remove the `command:` line from `aadi-cloud`), remove
`AADI_DEMO`, and create the steward account:
```bash
docker compose exec aadi-cloud node -e "const {createApp}=require('./server');const c=createApp();c.brain.createUser({username:'steward',password:process.argv[1],role:'platform_admin',display_name:'Platform Steward',safeguarding_trained:1})" '<strong-password>'
```
Real centre hubs run the same image on a mini-PC at the centre with `AADI_ROLE=hub`,
`AADI_UPSTREAM=https://<cloud-domain>`, and the same `AADI_SYNC_KEY`.
