# Production checklist

## 1. Environment

Copy `backend/.env.example` to `backend/.env` on the server and fill in real values. Never commit `.env`.

Required:

- `JWT_SECRET` — at least 64 random characters;
- `OPENAI_API_KEY` — only if prompt generation is enabled;
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`;
- SMTP settings for confirmations;
- `DATA_DIR` and `BACKUP_DIR` with absolute server paths.

## 2. Deploy

Before the first deploy of this version, move runtime data outside the Git checkout. Replace `<APP_USER>` and `<APP_GROUP>` with the account that runs PM2:

```bash
cd /var/www/MyCV/zvirycholeksandr
sudo install -d -m 700 -o <APP_USER> -g <APP_GROUP> /var/lib/zvirycholeksandr/data
sudo install -d -m 700 -o <APP_USER> -g <APP_GROUP> /var/backups/zvirycholeksandr
cp -a backend/data/. /var/lib/zvirycholeksandr/data/
```

Set these values in `backend/.env`:

```dotenv
DATA_DIR=/var/lib/zvirycholeksandr/data
BACKUP_DIR=/var/backups/zvirycholeksandr
```

Verify the copied data before touching the checkout:

```bash
node scripts/verify-data.js /var/lib/zvirycholeksandr/data
BACKUP_DIR=/var/backups/zvirycholeksandr DATA_DIR=/var/lib/zvirycholeksandr/data ./scripts/backup.sh
```

If `git status --short` shows modified files under `backend/data`, keep a recoverable Git stash after the external copy:

```bash
git stash push -m pre-deploy-runtime-data -- backend/data
```

Then deploy the reviewed branch:

```bash
cd /var/www/MyCV
git fetch origin
git switch codex/lead-growth-foundation
git pull --ff-only
cd zvirycholeksandr/backend
pnpm install --frozen-lockfile --prod
pm2 startOrReload ecosystem.config.js --update-env
pm2 save
sudo nginx -t
SMOKE_BASE_URL=https://zvirycholeksandr.com.ua pnpm test:smoke
```

The repository's `nginx.conf` is a reference file. Do not copy it over the active server config blindly. Apply nginx changes separately only after comparing them with the active virtual host and running `nginx -t`.

Run the exact package-manager binary available on the server if `pnpm` is not globally installed.

## 3. Daily backup

The script validates source JSON, creates a private archive, extracts it to a temporary directory, validates restored JSON, creates SHA-256 and rotates old archives.

Manual test:

```bash
cd /var/www/MyCV/zvirycholeksandr
BACKUP_DIR=/var/backups/zvirycholeksandr ./scripts/backup.sh
```

Cron at 03:00 Kyiv/server time:

```cron
0 3 * * * BACKUP_DIR=/var/backups/zvirycholeksandr NODE_BIN=/usr/bin/node /var/www/MyCV/zvirycholeksandr/scripts/backup.sh >> /var/log/zvirycholeksandr-backup.log 2>&1
```

Store at least one additional encrypted copy outside the web server. A backup on the same disk does not protect against disk loss.

## 4. Restore drill

Never restore directly over production first.

```bash
mkdir -p /tmp/mycv-restore-check
tar -xzf /var/backups/zvirycholeksandr/data-YYYY-MM-DDTHH-MM-SSZ-PID.tar.gz -C /tmp/mycv-restore-check
node /var/www/MyCV/zvirycholeksandr/scripts/verify-data.js /tmp/mycv-restore-check
```

After validation: stop the app, make one more backup of current data, copy the verified JSON files into `DATA_DIR`, start the app and run the smoke test.

## 5. Monitoring

```bash
cd /var/www/MyCV/zvirycholeksandr
pm2 start scripts/monitor.js --name zvirycholeksandr-monitor
pm2 save
```

The monitor checks `/api/health` every five minutes and notifies Telegram only on state changes.

## 6. Post-deploy

- verify a real test lead and remove it from the admin panel;
- confirm Telegram and confirmation email delivery statuses;
- submit `sitemap.xml` in Google Search Console;
- run Lighthouse on homepage, every service type, portfolio and one article;
- monitor 404, 429 and 500 responses after launch.
