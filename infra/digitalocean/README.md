# DigitalOcean production

Provisioned on 12 October 2026 in London (`lon1`), in the `libraries-global-production` project. The closed beta is deployed; the approved baseline is **$164.50/month**, before tax and usage overages.

Last checked: 13 October 2026. The [deployment runbook](deployment.md) describes protected GitHub source, image publishing, manual promotion and recovery. Production currently runs `release-20261013-google-auth`; merged framework updates are awaiting promotion.

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
- SSH accepts the dedicated deployment key and is restricted to the operator's approved `/32` address. Update both Cloud Firewalls if that address changes.
- PostgreSQL trusts only the app Droplet. The `libraries_global` database belongs to `libraries_global_app`. Separate `atlas_worker` and `atlas_builder` logins have grants limited to the Atlas tables and required sequences.
- App-to-database connections use the private DNS endpoint and verified TLS. The production Strapi configuration was tested against the real database, including rejection of a wrong CA.
- Meilisearch 1.42.1 runs as UID 1000 with a 3 GiB memory limit and 1.5 GiB indexing limit. Data persists at `/opt/libraries-global/meili_data` on the search server. Both search images are pinned by digest in that server's `.env`.
- Meilisearch's HTTP listener is published on localhost only. Caddy exposes `https://10.106.0.4:8443` on the private interface; the Cloud Firewall accepts that port only from the app Droplet. The app trusts Caddy's public internal CA, while Caddy retains its signing key and renews certificates automatically.
- Media and Atlas buckets have CDN enabled and restricted directory listing. Actual CDN `206` byte-range responses passed. Atlas exposes ETag and Content-Range to the production origins, using [atlas-cors.json](atlas-cors.json).
- The backup bucket has CDN disabled, restricted listing and object versioning enabled. An unauthenticated object request returned 403.
- Each Spaces writer has Read/Write/Delete access to its own bucket only. Cross-bucket requests returned 403. The temporary full-access configuration key was revoked after testing.
- Daily Droplet backups are enabled, with the 04:00–08:00 UTC window. The private cloud database backup was recovered, verified by SHA-256 and restored into an isolated PostgreSQL 17 container; all source counts matched. A full Droplet restore rehearsal remains.

## Access and deployment

The SSH private key, database administrator credential and scoped service credentials are held in the gitignored `.scratch/digitalocean` directory on the provisioning Mac. Do not copy that directory into a build context. The administrator credential was used locally through an SSH tunnel and was never copied to either server. Only the scoped credentials required by the running services are installed on the servers.

Initial provisioning used the DigitalOcean browser and SSH; the official DigitalOcean MCP tools were subsequently used for registry access and verification. The approved upload credential used `ExpirySeconds=86400`, and its private Mac/server copies were removed after upload. The London Basic registry contains the UI, CMS and worker release copies. GitHub validates source; image publishing is prepared and production promotion remains manual. See [deployment.md](deployment.md) for the activation and promotion procedure.

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

## Dependency maintenance

Update Strapi core, its official plugins/providers and type generation together on one published stable version. Keep CMS framework dependencies at the versions selected by Strapi; do not force a replacement dependency graph with repository-wide security overrides. Review third-party CMS plugins separately and regenerate schema types after schema changes.

[PR #16](https://github.com/webbist-js/libraries.global/pull/16) merged the official 5.55.1 to 5.57.0 update on 13 October as `0432ed0b`, after five PR checks passed. Local installation, 4,360 unit/component tests, six source-guard tests, all three production builds, the official upgrade dry run and type generation passed. This is merged source, not the running CMS version. Isolated production-data acceptance and promotion remain. Dependency advisories still require reachability review and upstream updates.

## GitHub Actions image publishing

[Production images](https://github.com/webbist-js/libraries.global/blob/dev/.github/workflows/production-images.yml) is merged and manually dispatched from the protected `dev` branch. Its guard requires the current merged SHA, successful CI and all three CodeQL analyses. It builds x86-64 UI/CMS/worker images, records full registry digest references and removes its temporary authentication configuration. Publishing does not deploy.

On 13 October there are zero workflow runs and no registry secret in `production-images`. That environment requires owner review and permits `dev` only; administrator bypass is currently allowed and should be disabled before activation. The repository switch `DO_IMAGE_PUBLISH_ENABLED` and an explicitly approved 24-hour `DO_REGISTRY_DOCKER_CONFIG` environment secret are required. Runtime and SSH credentials stay outside GitHub. Follow the [activation, promotion and rollback runbook](deployment.md).

## Running beta and billing

The existing closed-beta entrance is live at `https://libraries.global/beta`, using `WEB_MODE=beta`. Its EN/CS/FR entrance hides the feedback button and uses `info@libraries.global`; deployed checks and a fresh-visitor browser preview passed. Valid invitation access opens the real application, including the migrated home page and membership catalogue. Trusted HTTPS and the www redirect work; beta access and noindex controls remain enabled. Waitlist consent persistence, CMS image processing, Spaces upload and CDN delivery passed using owned disposable fixtures, which were removed. The frontend upload credential was verified to refuse media deletion.

The CMS stays private and MCP is disabled with `MCP_ENABLED=false`. On 13 October the owner confirmed revocation of the migrated broad MCP Admin Token and creation of a replacement limited to selected content types/actions. Keep MCP disabled until an explicit access decision. Admin Token permissions control MCP access; Content API tokens are separate. See [Strapi's MCP documentation](https://docs.strapi.io/cms/features/strapi-mcp-server).

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

Brevo SMTP uses port 2525 with required STARTTLS; authenticated transport verification passed without sending mail. The private runtime files contain the sender credentials. Actual mailbox delivery remains to test. Google sign-in and subsequent account deletion passed an owned-account test, including read-only auth/CMS cleanup checks.

Stripe sandbox billing is configured with the existing four GBP prices and three restricted Portal configurations. The endpoint is `https://libraries.global/api/billing/webhook`, pinned to `2026-03-25.dahlia` and the application's 24 allowed event types. Its secret was retrieved privately from Stripe because MCP redacted it. Signed correct-mode, wrong-mode and invalid-signature probes returned 200, 400 and 400 respectively. These probes do not create payments or prove settlement.

Authenticated systemd jobs replace Vercel scheduling: `libraries-global-billing.timer` runs every minute, and `libraries-global-retention.timer` runs daily at 03:00 UTC. The billing job reports only counts and fails if configuration is missing or processing fails. Its deployed runs currently report zero failures, pending events and pending projections. Run `journalctl -u libraries-global-maintenance@billing.service` to inspect results. Live purchases are not enabled; the beta checkout is explicitly in Test mode. Follow the [billing acceptance runbook](../../apps/ui/BILLING.md) before preparing live mode, and preserve the separation between sandbox and live database bindings.

## Release and recovery

The verified running release is `/opt/libraries-global/release-20261013-google-auth`. Its credential-free source archive and manifest record file checksums, image IDs and source head `dccb379b`, with `includes_uncommitted_source=true`. Its archive SHA-256 is `01bc12fce16989e5bfebdc078d82f2ddd7ab27b56db051156d854376c5a29034`. Reproduce it from the archive/manifest, not that Git SHA alone. The running UI is Next.js 16.1.5 and the CMS is Strapi 5.55.1. Later framework updates are merged source awaiting promotion.

`/opt/libraries-global/release.env` selects `CMS_IMAGE`, `UI_IMAGE` and `WORKER_IMAGE`. Earlier release archives and images remain for recovery. Runtime environment files stay outside images/source archives and need a separately protected copy. The deployed source and manifest also have verified private copies on the provisioning Mac and in versioned Spaces.

| Service | Recorded registry tag                      | Digest prefix         |
| ------- | ------------------------------------------ | --------------------- |
| UI      | `ui:20261013-google-auth-80a8d0775595`     | `sha256:80a8d0775595` |
| CMS     | `strapi:20261013-google-auth-69d51b338e7d` | `sha256:69d51b338e7d` |
| Workers | `worker:20261013-google-auth-4a829f98b21c` | `sha256:4a829f98b21c` |

Registry prefix: `registry.digitalocean.com/libraries-global-production/`. Prefixes identify records; use the full registry manifest digest for recovery/promotion. Keep Docker image IDs and registry manifest digests as distinct fields. Some running containers retain earlier tag aliases for unchanged images; tag text alone does not establish which source is running. Future releases should use the image publisher's checked Git revision labels and full digest manifest.

Build UI and CMS sequentially on the 8 GB app host when a manual build is needed. The prepared hosted publisher avoids consuming serving-host memory. Promotion uses Compose health checks and deployed acceptance; it is a single-instance update with possible interruption. See [the runbook](deployment.md#promotion).

`WEB_MODE=public` serves the temporary static 503/noindex fallback. It does not remove the application's beta gate. Application rollback needs the previous matching image, runtime and Compose selection; database changes require a separate recovery plan. A full application rollback and Droplet restore rehearsal remain outstanding.

When restoring Atlas to a fresh search server, persisted rebuild checkpoints may reference a staging index from the old server. Verify that exact index is absent before clearing only its completed `oldIndexToDelete` reference. Finish rebuild/reconciliation before restarting the normal Atlas worker, which uses the same health port.

## Remaining launch work

The deployment is serving the closed beta. Public launch still requires fresh-account sandbox checkout and live billing preparation, actual mailbox delivery, promotion of the accepted dependency updates, reachable-advisory review, operational alerts, a separate Atlas archive runner, scheduled CMS maintenance acceptance and recovery rehearsals. Catalogue/legal/provider checks remain separate from infrastructure readiness.

DigitalOcean 2FA and the migrated CMS MCP token cleanup/scoped replacement were owner-confirmed complete on 13 October. Google signup/deletion, migration/media, search/Atlas reconciliation and the isolated backup restore have passed. The image publisher is merged but has not run or promoted a release. Follow the local launch checklist in `docs/operations/digitalocean-launch-checklist.md` and [deployment.md](deployment.md) for delivery activation.
