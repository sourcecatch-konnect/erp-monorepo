# Production deployment

Images are **built in GitHub Actions** (push to the `production` branch) and
**streamed to the instance over SSH** with `docker save | ssh docker load` —
no container registry involved. The instance only ever runs
`docker compose up -d`.

## Topology

```
                    ┌─ caddy (:80/:443) ── the only exposed container
  browser ──────────┤     /api/*       → server:5000  (prefix stripped)
                    │     /socket.io/* → server:5000  (websockets)
                    │     everything   → web:3001
                    │
  frontend network ─┴─ web ── server ─┬─ backend network (internal: true)
                                      ├─ postgres  (volume, never exposed)
                                      ├─ redis     (password + AOF, never exposed)
                                      └─ migrate   (one-shot `prisma migrate deploy`)
```

- `backend` is an internal Docker network: postgres/redis have **no host
  ports and no internet access**.
- `migrate` runs `prisma migrate deploy` before the server starts; the server
  waits for it to complete successfully.
- The web bundle is built with `NEXT_PUBLIC_API_URL=/api` and
  `NEXT_PUBLIC_SOCKET_URL=/`, so the browser only ever talks to the Caddy
  origin — same-origin cookies, no CORS pain.

## One-time instance setup

```bash
# 1. Install Docker Engine + compose plugin (docs.docker.com/engine/install)

# 2. Deploy directory
sudo mkdir -p /opt/skerp && sudo chown $USER /opt/skerp

# 3. Secrets
#    copy deploy/.env.example to /opt/skerp/.env and fill it in
chmod 600 /opt/skerp/.env

# 4. Deploy SSH key (used by GitHub Actions)
ssh-keygen -t ed25519 -f skerp-deploy -N ""
cat skerp-deploy.pub >> ~/.ssh/authorized_keys
# the user must be able to run docker (usermod -aG docker $USER)
```

## GitHub repository configuration

Secrets (Settings → Secrets and variables → Actions → Secrets):

| Secret          | Value                                    |
| --------------- | ---------------------------------------- |
| `PROD_SSH_HOST` | instance IP / hostname                   |
| `PROD_SSH_USER` | deploy user (in the `docker` group)      |
| `PROD_SSH_KEY`  | contents of the `skerp-deploy` **private** key |
| `PROD_SSH_PORT` | optional, defaults to 22                 |

Variables (same page → Variables), all optional:

| Variable                            | Value                              |
| ----------------------------------- | ---------------------------------- |
| `PROD_DEPLOY_PATH`                  | defaults to `/opt/skerp`           |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`   | baked into the web bundle at build |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`    | baked into the web bundle at build |

## Deploying

Push (or merge) to the `production` branch. The workflow:

1. Builds `skerp-server`, `skerp-migrate`, `skerp-web` tagged with the git
   short sha, using GitHub Actions BuildKit layer cache (`type=gha`).
2. Streams all three images over SSH (`docker save | gzip | ssh docker load`).
3. Copies `docker-compose.prod.yml` + `Caddyfile` to the deploy dir, pins
   `IMAGE_TAG=<sha>` in `.env`, and runs `docker compose up -d`.
4. Prunes unused images older than 7 days (recent tags stay for rollback).

## Rollback

```bash
ssh <instance>
cd /opt/skerp
docker images "skerp-server"            # pick a previous tag
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<old-sha>/' .env
docker compose -f docker-compose.prod.yml up -d
```

## Logs (Dozzle)

Dozzle runs bound to `127.0.0.1:9081` on the instance — not reachable from
the internet. Open a tunnel and browse:

```bash
ssh -L 9081:127.0.0.1:9081 <instance>
# then open http://localhost:9081
```

## Useful commands (on the instance)

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f server
docker compose -f docker-compose.prod.yml exec postgres psql -U skerp skerp

# Seed the admin user / canonical roles (first boot only)
docker compose -f docker-compose.prod.yml exec server node dist/prisma/seed-admin.js
```
