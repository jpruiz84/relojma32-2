# Private-link deployment

The simulator can run on your server under `/opt/reloj-ma`, managed by
`reloj-ma.service`. The service starts a pinned Caddy Docker image; Docker restarts
the container after a crash and systemd starts the service at boot. Only ports
80 and 443 are published. Application files are mounted read-only.

Keep the server address and private link outside Git. Set `DEPLOY_HOST` in your
local shell to your SSH destination (user and hostname), then retrieve the link
over SSH:

```sh
ssh "${DEPLOY_HOST:?Set DEPLOY_HOST locally}" cat /opt/reloj-ma/private-url.txt
```

## Access and HTTPS

`/opt/reloj-ma/.env` contains `SERVER_IP` and `ACCESS_PATH`. The latter contains a
256-bit secret generated using Python `secrets.token_hex(32)`. Both this file and
`private-url.txt` have mode 0600, inside a mode 0700 directory. All HTML, scripts,
fonts, source documents and model files require the complete secret path. Unknown
paths return 404; directory browsing is disabled. Anyone possessing the link can
use and share it. There are no individual accounts or per-person revocation.

Responses disable indexing, referrer transmission and caching. Access logging is
off; normal service logs retain startup, certificate and operational messages.
Do not enable HTTP access logs, publish browser traces, or paste the URL into
public monitoring services. Browser history and bookmarks can still retain it.
Simulation state is stored in each user's browser, not on the server.

Caddy obtains and automatically renews a publicly trusted Let's Encrypt IP
certificate with the `shortlived` ACME profile. Keep ports 80/443 reachable for
certificate validation, and preserve the `reloj-ma_caddy_data` and
`reloj-ma_caddy_config` Docker volumes across updates. `default_sni` allows IP
clients that omit TLS SNI. See the official [Caddy TLS configuration](https://caddyserver.com/docs/caddyfile/directives/tls)
and [Let's Encrypt IP certificate announcement](https://letsencrypt.org/2026/03/11/shorter-certs-certbot).

## Operate

```sh
ssh "${DEPLOY_HOST:?Set DEPLOY_HOST locally}" systemctl status reloj-ma.service
ssh "${DEPLOY_HOST:?Set DEPLOY_HOST locally}" systemctl restart reloj-ma.service
ssh "${DEPLOY_HOST:?Set DEPLOY_HOST locally}" 'cd /opt/reloj-ma && docker compose logs --tail=50 web'
```

`systemctl stop reloj-ma` stops the application. To prevent startup at boot as
well, use `systemctl disable --now reloj-ma`.

## Update or roll back

Run from the repository root. Each build gets its own release directory; the
relative `site/current` symlink switches atomically inside Caddy's existing mount.
Previous releases remain available for rollback.

```sh
npm ci --prefix simulator
npm run build --prefix simulator
release_id="$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)"
ssh "${DEPLOY_HOST:?Set DEPLOY_HOST locally}" "mkdir -p /opt/reloj-ma/site/releases/$release_id"
rsync -az simulator/dist/ "${DEPLOY_HOST:?Set DEPLOY_HOST locally}:/opt/reloj-ma/site/releases/$release_id/"
ssh "${DEPLOY_HOST:?Set DEPLOY_HOST locally}" "cd /opt/reloj-ma/site && ln -s releases/$release_id current.next && mv -Tf current.next current"
```

For rollback, point `site/current` at a retained directory under `site/releases`
using the same `current.next` and `mv -Tf` sequence. No container restart is needed
for an application update.

For server configuration changes, copy `Caddyfile`, `compose.yaml` and
`reloj-ma.service` from this directory to `/opt/reloj-ma`. Validate with
`docker compose run --rm --no-deps web caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`
from that directory. Install the unit into `/etc/systemd/system/reloj-ma.service`,
run `systemctl daemon-reload`, then `systemctl restart reloj-ma`.

Run all browser scenarios against the live production build without printing the
private URL in the command:

```sh
SIMULATOR_URL="$(ssh "${DEPLOY_HOST:?Set DEPLOY_HOST locally}" cat /opt/reloj-ma/private-url.txt)" npm run test:e2e --prefix simulator
```

## Revoke a shared link

Run the following on the server as root. It replaces the secret and recreates the
container with the new environment. Previously downloaded content cannot be
revoked, but the old link stops serving content.

```sh
cd /opt/reloj-ma
python3 - <<'PY'
from pathlib import Path
import os, secrets
os.umask(0o077)
settings = dict(line.split('=', 1) for line in Path('.env').read_text().splitlines() if '=' in line)
ip = settings['SERVER_IP']
access = '/reloj-ma-32-2/' + secrets.token_hex(32)
Path('.env').write_text(f'SERVER_IP={ip}\nACCESS_PATH={access}\n')
Path('private-url.txt').write_text(f'https://{ip}{access}/\n')
PY
docker compose up -d --force-recreate
cat private-url.txt
```
