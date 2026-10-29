# Oracle Cloud setup (Always Free)

This gets Mindly running on one Oracle Always Free VM with HTTPS, a persistent accounts database, and daily backups. Budget about an hour, most of it waiting for the first Docker build.

What you end up with:

- One Ubuntu VM (Ampere ARM, free). Docker runs the app and Caddy.
- `https://your-name.duckdns.org` (free domain, free certificate, renews itself).
- The accounts database in `/opt/mindly/app/data/` on the VM's disk, backed up nightly.

Before you start, have ready: `LLM_API_KEY` (OpenRouter), `ASR_API_KEY` (Groq), and optionally `GOOGLE_CLIENT_ID`.

---

## 1. Create the VM

1. Sign up at cloud.oracle.com. Choose a home region close to you. Johannesburg is the closest to Nigeria. You can't change the home region later. Oracle may ask for a card to verify identity; the Always Free resources here are not charged.
2. **Compute → Instances → Create instance**.
   - Image: **Canonical Ubuntu 22.04 or 24.04** (not Oracle Linux, so the commands below work as written).
   - Shape: **VM.Standard.A1.Flex** (Ampere, ARM). Set **2 OCPU and 8 GB RAM**. Mindly needs much less, but this stays inside the free allowance (4 OCPU and 24 GB in total).
   - Networking: keep the default VCN and **assign a public IPv4 address**.
   - SSH keys: **Generate a key pair** and save the private key, or paste your own public key.
3. Once it's running, note the **public IP address**.

If you get "Out of capacity for shape VM.Standard.A1.Flex", that's common in busy regions. Try again later, try a different availability domain, or use the 1 OCPU / 6 GB size.

## 2. Open ports 80 and 443 in Oracle's firewall

Oracle has two firewalls. Open the ports in both.

**a) Cloud firewall:** on the instance page, open the **Subnet → Security List → Add Ingress Rules**:

| Source CIDR | Protocol | Destination port |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

(Port 22 for SSH is already open.)

**b) Ubuntu firewall:** done in step 4 below.

## 3. Connect and get a domain

```bash
ssh -i path/to/private-key ubuntu@YOUR_PUBLIC_IP
```

Get a free HTTPS-capable domain at **duckdns.org**: sign in, create a subdomain such as `mindly-yourname`, and set its IP to your VM's public IP. Your domain is then `mindly-yourname.duckdns.org`. You can use your own domain instead if you have one (create an A record pointing at the IP, with the proxy off).

Check it resolves from the VM:

```bash
getent hosts mindly-yourname.duckdns.org   # should print your VM's IP
```

## 4. Prepare the server

Run these on the VM.

```bash
# Updates, Docker, and SQLite for backups
sudo apt-get update && sudo apt-get -y upgrade
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
sudo apt-get install -y sqlite3 rclone

# Open 80 and 443 in the Ubuntu firewall (Oracle images block them by default)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
sudo netfilter-persistent save

# Log out and back in so the docker group applies
exit
```

Then SSH back in and check: `docker run --rm hello-world` should print a success message.

## 5. Copy the code to the server

From **your laptop**, in the `mindly` folder. This copies the source but skips your local secrets and build junk.

```bash
rsync -av \
  --exclude .env --exclude .venv --exclude data --exclude backups \
  --exclude frontend/node_modules --exclude frontend/.next --exclude frontend/out \
  --exclude .pytest_cache --exclude '__pycache__' \
  ./ ubuntu@YOUR_PUBLIC_IP:/opt/mindly/app/
```

(Rsync is not on Windows by default. If you use a Git repo on GitHub, you can `git clone` on the VM instead.)

On the VM, create the data folder. The container runs as user id 1000, which is the `ubuntu` user here, so it can write there:

```bash
sudo mkdir -p /opt/mindly/app/data
sudo chown -R ubuntu:ubuntu /opt/mindly/app/data
```

## 6. Configure

On the VM:

```bash
cd /opt/mindly/app
cp .env.example .env
nano .env
```

Set these:

```
DOMAIN=mindly-yourname.duckdns.org
LLM_API_KEY=...            # OpenRouter key
ASR_API_KEY=...            # Groq key (fast speech)
GOOGLE_CLIENT_ID=          # leave blank if you don't use Google sign-in
DAILY_AI_LIMIT=300
```

Keep the other values as they are in the example.

Keep `.env` on the server only. Never commit it to git.

## 7. Start it

```bash
cd /opt/mindly/app
docker compose up -d --build
```

The first build takes several minutes (it builds the web app and installs Python packages). Follow it with:

```bash
docker compose logs -f
```

When Caddy logs `certificate obtained successfully`, you're live. Open `https://mindly-yourname.duckdns.org`.

Check:

- The page loads with a padlock.
- Sign up with an email, then sign in.
- Record a short note in the browser (the microphone works only over HTTPS, which is why this matters).

Useful commands:

```bash
docker compose ps                  # both services should say "running" or "healthy"
docker compose logs --tail=100 mindly
docker compose restart mindly
```

## 8. Google sign-in (optional)

In Google Cloud Console, open your OAuth **Web application** client, and add these:

- **Authorized JavaScript origins:** `https://mindly-yourname.duckdns.org`

Put the client ID in `.env` as `GOOGLE_CLIENT_ID`, then run `docker compose up -d` to apply it. Also publish the OAuth consent screen, or only test users can sign in.

## 9. Backups

Test the backup script once:

```bash
chmod +x /opt/mindly/app/deploy/backup.sh
/opt/mindly/app/deploy/backup.sh
ls -lh /opt/mindly/app/backups
```

Schedule it daily:

```bash
crontab -e
```

Add this line:

```
0 3 * * * /opt/mindly/app/deploy/backup.sh >> /opt/mindly/backup.log 2>&1
```

Backups on the same VM don't protect you if the VM is lost. Set up an off-site copy with rclone, for example Backblaze B2, Google Drive, or any S3-compatible store with a free tier:

```bash
rclone config                                   # create a remote named "offsite"
```

Then give the cron job the remote name. Change the crontab line to:

```
0 3 * * * RCLONE_REMOTE=offsite:mindly-backups /opt/mindly/app/deploy/backup.sh >> /opt/mindly/backup.log 2>&1
```

Check the first upload with `rclone ls offsite:mindly-backups`.

To restore: stop the app (`docker compose stop mindly`), replace `data/accounts.db` with the unzipped backup, then start it again.

## 10. Updating the app

From your laptop, sync the new code (step 5 command), then on the VM:

```bash
cd /opt/mindly/app
docker compose up -d --build
```

Your data and `.env` are untouched by this.

---

## Things to know

- **Oracle may reclaim idle free VMs.** If CPU use stays very low for a long stretch, Oracle can stop the instance. A live app with users is normally fine. Watch for the instance being stopped and check the Oracle notifications.
- **One instance only.** The accounts database is SQLite on this VM's disk, so run one copy of the app. For more machines, see docs/ARCHITECTURE.md.
- **Costs.** The VM and disk are free. You pay only for the AI and speech calls (OpenRouter and Groq), so set spending limits on both.
- **Security.** Keep the OS updated (`sudo apt-get update && sudo apt-get upgrade` now and then). SSH allows only your key. Don't open any other ports.
- **Port 8080 is not public.** Only Caddy on 80 and 443 is exposed.
