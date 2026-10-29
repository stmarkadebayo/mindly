# AWS setup (EC2, trial credits)

This is how the live Mindly app is deployed. **Your project's Region is fixed by your contact address** (ours is `eu-north-1`, Stockholm), and resources can't be created in other Regions; confirm yours in AWS Settings before you start. Where a step below names a different Region, use your own.

This runs Mindly on one EC2 virtual server with Docker, HTTPS, and nightly backups. It uses the same `docker-compose.yml`, `deploy/Caddyfile`, and `deploy/backup.sh` as the Oracle runbook, so start there for background. This file covers only what differs on AWS.

**Important timing.** The AWS Free plan account closes 6 months after you open it, or when the credits run out, whichever comes first. Your server and its disk are part of the account. Plan the migration (section 10) before then, or upgrade to a Paid plan.

---

## 1. Create the account and budget alert

1. Create the account at aws.amazon.com. Choose the **Free plan** for credits. You can check your remaining credit with `aws freetier get-account-plan-state` (the live account showed $100 and an expiry date in April 2027).
2. Open **Billing and Cost Management → Budgets → Create budget**. Choose a monthly cost budget of **$5**, with an email alert at 80%. This catches surprises even while you have credits.
3. Note the date you opened the account. The 6-month deadline starts from that date. Put a reminder in your calendar for one month before it.

## 2. Launch the server

In the EC2 console, use your project's Region (the live app uses **Europe (Stockholm)** `eu-north-1`). Then **Launch instance**:

- **Name:** `mindly`
- **AMI:** Ubuntu Server **24.04 LTS**, **64-bit (Arm)**
- **Instance type:** **t4g.small** (2 GB RAM, Arm), as used by the live app. The web app build needs more memory than the 1 GB t4g.micro gives. If the type isn't available on your plan, use t3.small (x86) and build the same way.
- **Metadata:** require IMDSv2 (`HttpTokens=required`).
- **Key pair:** create a new RSA key pair and download the `.pem` file. Keep it safe.
- **Network settings → Create security group** with these inbound rules:

| Type | Port | Source |
|---|---|---|
| SSH | 22 | **My IP** (only your address) |
| HTTP | 80 | Anywhere (`0.0.0.0/0`) |
| HTTPS | 443 | Anywhere (`0.0.0.0/0`) |

- **Storage:** **20 GiB gp3** (not the default 8).

Launch it. Then **EC2 → Elastic IPs → Allocate → Associate** with this instance. The Elastic IP is free while it's attached to a running instance, and it keeps the address stable across restarts.

## 3. Point your domain at it

Use a free name from duckdns.org (the live app uses `mindly-ai.duckdns.org`), or your own domain. Set it to the **Elastic IP**, not the temporary public address. No domain yet? `<elastic-ip-with-dashes>.sslip.io` (for example `13-63-127-53.sslip.io`) also gets a real certificate from Caddy.

Check it resolves from the server (after step 4 connects):

```bash
getent hosts mindly-yourname.duckdns.org   # should print the Elastic IP
```

## 4. Connect and prepare the server

From your laptop:

```bash
chmod 400 path/to/your-key.pem
ssh -i path/to/your-key.pem ubuntu@YOUR_ELASTIC_IP
```

On the server:

```bash
# Updates, Docker, SQLite and rclone
sudo apt-get update && sudo apt-get -y upgrade
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
sudo apt-get install -y sqlite3 rclone

# Swap, so the web build doesn't run out of memory on 2 GB
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Log out and back in so the docker group applies
exit
```

SSH back in and run `docker run --rm hello-world`. You should see a success message.

Ubuntu on EC2 has no firewall by default, so the security group in step 2 is the only gate. Don't add `iptables` rules.

## 5. Copy the code

From your laptop, in the `mindly` folder, either rsync the working tree (command below) or, to deploy exactly what is committed (this is what we do), stream the committed files:

```bash
git archive HEAD | ssh -i path/to/your-key.pem ubuntu@YOUR_ELASTIC_IP 'tar -x -C /opt/mindly/app'
```

The rsync alternative, with your Elastic IP:

```bash
rsync -av \
  --exclude .env --exclude .venv --exclude data --exclude backups \
  --exclude frontend/node_modules --exclude frontend/.next --exclude frontend/out \
  --exclude .pytest_cache --exclude '__pycache__' \
  ./ ubuntu@YOUR_ELASTIC_IP:/opt/mindly/app/
```

Then on the server, create the data folder. The container runs as user id 1000, which is the `ubuntu` user on Ubuntu, so it can write there:

```bash
sudo mkdir -p /opt/mindly/app/data
sudo chown -R ubuntu:ubuntu /opt/mindly/app/data
```

## 6. Configure

```bash
cd /opt/mindly/app
cp .env.example .env
nano .env
```

Set:

```
DOMAIN=mindly-yourname.duckdns.org
LLM_API_KEY=...            # OpenRouter key
ASR_API_KEY=...            # Groq key
GOOGLE_CLIENT_ID=          # blank unless you use Google sign-in
DAILY_AI_LIMIT=300
```

Keep `.env` on the server only.

## 7. Start it

```bash
cd /opt/mindly/app
docker compose up -d --build
docker compose logs -f
```

The first build takes several minutes. When Caddy logs `certificate obtained successfully`, open `https://mindly-yourname.duckdns.org`. Check that the padlock shows, you can sign up and sign in, and recording works.

## 8. Google sign-in (optional)

Same as the Oracle runbook: add `https://mindly-yourname.duckdns.org` under **Authorized JavaScript origins** on your OAuth client, set `GOOGLE_CLIENT_ID` in `.env`, then run `docker compose up -d`.

## 9. Backups

Use an **off-site** backup target that is **not on AWS**. If the AWS account closes, anything stored in it, including S3 buckets, can go with it. A free Backblaze B2 bucket (or any other provider) works well here.

```bash
rclone config        # create a remote named "offsite" for your provider
```

Test the script:

```bash
chmod +x /opt/mindly/app/deploy/backup.sh
RCLONE_REMOTE=offsite:mindly-backups /opt/mindly/app/deploy/backup.sh
rclone ls offsite:mindly-backups
```

Schedule it daily with `crontab -e`:

```
0 3 * * * RCLONE_REMOTE=offsite:mindly-backups /opt/mindly/app/deploy/backup.sh >> /opt/mindly/backup.log 2>&1
```

## 10. Before the 6-month close: move or upgrade

Decide one month ahead.

**Option A: upgrade to a Paid plan.** In **Billing → Plans**, switch to the Paid plan. Paid plan accounts pay for usage beyond credits. Check the bill against your budget alert. The server keeps running with no migration.

**Option B: migrate to another host.** Use this if you'd rather not pay AWS. Choose the destination from the other hosts discussed (Oracle Pay As You Go, Hetzner).

1. **Take a fresh backup** on the AWS server: `/opt/mindly/app/deploy/backup.sh`. Confirm the copy is in your off-site bucket.
2. **Provision the new server** and run steps 4 to 7 of this runbook there (or of `docs/ORACLE-SETUP.md` on Oracle). Don't start the app with data yet; `docker compose up -d --build` creates an empty account database, so stop it right after.
3. **Restore the database:**
   ```bash
   docker compose stop mindly
   gunzip -c accounts-YYYY-MM-DD_HHMM.db.gz > /opt/mindly/app/data/accounts.db
   docker compose start mindly
   ```
4. **Point the domain** at the new server's IP. Wait for DNS to update. Caddy then requests a new certificate.
5. **Test**: sign in with an existing account, check an old entry if you have one, record a note.
6. **Set up backups on the new host** (section 9), then stop the AWS server.
7. **Terminate the AWS instance** only after the new host has worked for a few days. Also release the Elastic IP. An unattached one is charged.

Don't assume the server is still there at the deadline. Move before the date.

## Useful commands

```bash
docker compose ps                         # both services running or healthy
docker compose logs --tail=100 mindly
docker compose restart mindly
df -h                                      # check disk space
```

## Updating the app

From your laptop, rerun the `git archive` (or `rsync`) command in step 5. Then on the server:

```bash
cd /opt/mindly/app
docker compose up -d --build
```

Your data and `.env` are unaffected.

## Notes

- **Only one instance.** The accounts database is SQLite on this server's disk, so run one copy of the app.
- **Costs.** The server, disk and Elastic IP (while attached) are covered by credits. Watch the budget alert, and remember to terminate the server if you stop using it.
- **Security.** Keep SSH limited to your IP (if your IP changes, update the security-group rule). Keep the OS updated. Only ports 80 and 443 are public; port 8080 stays inside Docker.
