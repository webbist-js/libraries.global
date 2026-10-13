# DigitalOcean production

Provisioned on 12 October 2026 in London (`lon1`), in the `libraries-global-production` project. The approved baseline is **$164.50/month**, before tax and usage overages.

| Resource              | Configuration                                                | Monthly baseline |
| --------------------- | ------------------------------------------------------------ | ---------------: |
| App Droplet           | 4 vCPU, 8 GB RAM, 160 GB SSD; daily backups                  |           $62.40 |
| Search Droplet        | 2 vCPU, 4 GB RAM, 80 GB SSD; daily backups                   |           $31.20 |
| Managed PostgreSQL 17 | Standard; primary and standby, each 2 GB RAM and 30 GiB disk |           $60.90 |
| Spaces                | Media, Atlas and private backup buckets; one subscription    |            $5.00 |
| Container Registry    | Basic, 5 repositories and 5 GiB storage                      |            $5.00 |

PostgreSQL has automatic failover. The app and search servers each have one instance. Their compute can be resized independently; adding replicas or a load balancer changes the budget. Database storage autoscaling and storage/transfer overages can also raise the monthly cost.

## Installed and verified

- VPC `libraries-global-production-lon1`, `10.106.0.0/20`.
- App server `178.62.44.94`, private `10.106.0.3`; search server `139.59.191.47`, private `10.106.0.4`.
- Ubuntu 24.04, Docker Engine 29.9.0 and Compose 5.6.0 on both servers. Docker logs rotate at 10 MiB, retaining three files.
- SSH accepts the dedicated deployment key and is restricted to the operator's current IP, the operator’s approved `/32` address. Update both Cloud Firewalls if that IP changes.
- PostgreSQL trusts only the app Droplet. The `libraries_global` database belongs to `libraries_global_app`. Separate `atlas_worker` and `atlas_builder` logins have grants limited to the Atlas tables and required sequences.
- App-to-database connections use the private DNS endpoint and verified TLS. The production Strapi configuration was tested against the real database, including rejection of a wrong CA.
- Meilisearch 1.42.1 runs as UID 1000 with a 3 GiB memory limit and 1.5 GiB indexing limit. Data persists at `/opt/libraries-global/meili_data` on the search server. Both search images are pinned by digest in that server's `.env`.
- Meilisearch's HTTP listener is published on localhost only. Caddy exposes `https://10.106.0.4:8443` on the private interface; the Cloud Firewall accepts that port only from the app Droplet. The app trusts Caddy's public internal CA, while Caddy retains its signing key and renews certificates automatically.
- Media and Atlas buckets have CDN enabled and restricted directory listing. Actual CDN `206` byte-range responses passed. Atlas exposes ETag and Content-Range to the production origins, using [atlas-cors.json](atlas-cors.json).
- The backup bucket has CDN disabled, restricted listing and object versioning enabled. An unauthenticated object request returned 403.
- Each Spaces writer has Read/Write/Delete access to its own bucket only. Cross-bucket requests returned 403. The temporary full-access configuration key was revoked after testing.
- Daily Droplet backups are enabled, with the 04:00–08:00 UTC window. The private cloud database backup was recovered, verified by SHA-256 and restored into an isolated PostgreSQL 17 container; all source counts matched. A full Droplet restore rehearsal remains.

## Access and deployment

The SSH private key, database administrator credential and scoped service credentials are held in the gitignored `.scratch/digitalocean` directory on the provisioning Mac. Do not copy that directory into a build context. The administrator credential was used locally through an SSH tunnel and was never copied to either server. Only the limited app database credential is installed on the app server.

The six official DigitalOcean MCP servers are configured, OAuth-connected and now available in this chat. Initial provisioning used the browser and SSH. Registry upload subsequently used MCP to request the approved read/write credential with `ExpirySeconds=86400`; its private Mac/server copies were removed after upload. The London Basic registry contains the current UI, Strapi and worker images, with manifest digests verified through MCP. GitHub Actions production deployment still needs wiring up.

`bootstrap-host.sh` installs Docker from its official Ubuntu repository. `search.compose.yml` and `search.Caddyfile` are the running search configuration. Copy them to `/opt/libraries-global` on the search server alongside a private `search.env` containing `MEILI_MASTER_KEY` and `.env` containing the pinned `MEILI_IMAGE` and `CADDY_IMAGE` digests. Create `meili_data` owned by UID/GID 1000 before starting:

```sh
docker compose -f search.compose.yml config --quiet
docker compose -f search.compose.yml up -d --wait
```

The worker image builds from the repository root and supplies both processes:

```sh
docker build --platform linux/amd64 -f apps/sync-worker/Dockerfile -t libraries-global-worker:launch-amd64 .
# Events: node dist/index.js
# Atlas:  node dist/atlas/index.js
```

The x86-64 application and worker builds passed on the app server. The images run without root privileges and exclude local credentials. Next.js, Strapi and the independent event and Atlas workers are healthy. General search contains 48,279 published library documents, 25 journal articles, 150 knowledge articles and 29 mobile stops. The migrated event source has no events. Atlas rebuild and reconciliation completed with an empty outbox and matching projection/index revision `116800`.

The selected source is the local Strapi database and uploads. The source dump and upload archive have private, verified backups in the versioned backup bucket. Restoring the dump to Managed PostgreSQL matched all 277 public tables, 96,558 library rows and 13 media records. These library rows include drafts and locales. All 64 original/variant media objects passed size and CDN byte-range checks; the restored CMS media URLs now point to Spaces. The local source is retained.

Production Strapi now includes the matching S3 upload provider and supports `AWS_ENDPOINT=https://lon1.digitaloceanspaces.com`. Set `AWS_REGION=lon1`, `AWS_BUCKET=libraries-global-production-media`, the media key, and the CDN base URL. PostgreSQL uses `DATABASE_SSL=true`, `DATABASE_SSL_CA_FILE=/run/secrets/database-ca.crt` and certificate validation. Set bounded connection pools; the managed primary allows 47 connections. Trust the private search CA through `NODE_EXTRA_CA_CERTS` for Node services.

## Running beta and billing

The existing closed-beta entrance is live at `https://libraries.global/beta`, using `WEB_MODE=beta`. Its EN/CS/FR entrance hides the feedback button and uses `info@libraries.global`; deployed checks and a fresh-visitor browser preview passed. Valid invitation access opens the real application, including the migrated home page and membership catalogue. Trusted HTTPS and the www redirect work; beta access and noindex controls remain enabled. Waitlist consent persistence, CMS image processing, Spaces upload and CDN delivery passed using owned disposable fixtures, which were removed. The frontend upload credential was verified to refuse media deletion.

The CMS stays private. MCP is disabled with `MCP_ENABLED=false`. The full database restore included an unexpired MCP-labelled Admin Token record; its bearer value is absent from all deployed runtime files, verified privately against the stored hash. The owner will revoke this copied token in the production CMS and replace it with an Admin Token limited to the chosen content types/actions. Leave MCP disabled until that replacement is ready. Admin Token permissions control MCP access; Content API tokens are separate. See [Strapi's MCP documentation](https://docs.strapi.io/cms/features/strapi-mcp-server).

Open the existing CMS login through SSH rather than publishing an administration hostname:

```sh
ssh -N -L 127.0.0.1:18013:127.0.0.1:1337 \
  -i .scratch/digitalocean/id_ed25519 -o IdentitiesOnly=yes \
  -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile=.scratch/digitalocean/known_hosts \
  root@178.62.44.94
# In the browser: http://127.0.0.1:18013/admin
```

Brevo SMTP uses port 2525 with required STARTTLS; authenticated transport verification passed without sending mail. DigitalOcean blocks the standard SMTP ports. The private runtime files contain the existing sender credentials. Mailbox delivery and Google OAuth sign-in still need acceptance.

Stripe sandbox billing is configured with the existing four GBP prices and three restricted Portal configurations. The endpoint is `https://libraries.global/api/billing/webhook`, pinned to `2026-03-25.dahlia` and the application's 24 allowed event types. Its secret was retrieved privately from Stripe because MCP redacted it. Signed correct-mode, wrong-mode and invalid-signature probes returned 200, 400 and 400 respectively. These probes do not create payments or prove settlement.

Authenticated systemd jobs replace Vercel scheduling: `libraries-global-billing.timer` runs every minute, and `libraries-global-retention.timer` runs daily at 03:00 UTC. The billing job reports only counts and fails if configuration is missing or processing fails. Its deployed runs currently report zero failures, pending events and pending projections. Run `journalctl -u libraries-global-maintenance@billing.service` to inspect results. Live purchases are not enabled; the beta checkout is explicitly in Test mode. Follow the [billing acceptance runbook](../../apps/ui/BILLING.md) before preparing live mode, and preserve the separation between sandbox and live database bindings.

## Release and recovery

The current release is `/opt/libraries-global/release-20261013-google-auth`, holding the exact credential-free deployed source archive, file checksums and image IDs. Earlier releases and their images remain available for rollback. These releases include uncommitted source, recorded explicitly in their manifests. Immutable local tags are selected by `/opt/libraries-global/release.env`:

```sh
cd /opt/libraries-global
docker compose --env-file release.env -f app.compose.yml --profile workers up -d --wait
```

Private copies of the source and manifest are also held on the provisioning Mac and in the versioned backup bucket; recovery and checksum verification passed. The current images also have verified immutable registry tags:

| Service | Registry tag                               | Manifest digest prefix |
| ------- | ------------------------------------------ | ---------------------- |
| UI      | `ui:20261013-google-auth-80a8d0775595`     | `sha256:80a8d0775595`  |
| CMS     | `strapi:20261013-google-auth-69d51b338e7d` | `sha256:69d51b338e7d`  |
| Workers | `worker:20261013-google-auth-4a829f98b21c` | `sha256:4a829f98b21c`  |

Registry prefix: `registry.digitalocean.com/libraries-global-production/`. Use the full digest from the private release manifest or registry API for recovery; the prefixes above are for identification. Runtime environment files stay outside the images and source archive. Preserve them separately when replacing a server. Build UI and CMS images sequentially on the 8 GB app server: their combined native build memory can approach the host limit.

For an app outage during deployment, `WEB_MODE=public` restores the temporary static page; it returns 503 and prevents indexing. Restoring a previous application release requires its matching immutable images and runtime configuration. A full application rollback rehearsal is still outstanding; do not treat a saved manifest as a completed rehearsal.

When restoring Atlas to a fresh Meilisearch server, persisted rebuild checkpoints may reference a staging index from the old server. Verify that exact index is absent before clearing only its completed `oldIndexToDelete` reference. Rebuild and reconcile must finish before starting the normal Atlas worker, which uses the same health port.

## Remaining launch work

Owned sandbox checkout acceptance, live billing preparation, GitHub Actions deployment, production dependency patches, the separate Atlas archive runner, operational alerts, account MFA verification, a Droplet restore and application rollback rehearsal remain. The replacement Google secret is installed privately. A browser-origin regression was reproduced, tested and fixed; the owner completed Google sign-in with a new account, then deleted it. Read-only database checks confirm the auth user and CMS sign-in user are absent, provider/session orphan counts are zero, and the recent CMS profile is anonymized. GitHub branch rules and repository security scanning are enabled; the auth/workflow PR passed CI and CodeQL and was squash-merged by the owner as `66077f2b`. Actions now require full commit-SHA references. Track these in the local [launch checklist](../../docs/operations/digitalocean-launch-checklist.md).
