# Domain routing

The primary hostname is `libraries.global`. `www.libraries.global` redirects to it with the request path and query string preserved.

| DNS type | Namecheap host | Value              | TTL       |
| -------- | -------------- | ------------------ | --------- |
| A        | `@`            | `178.62.44.94`     | 5 minutes |
| CNAME    | `www`          | `libraries.global` | 5 minutes |

Namecheap remains the DNS provider, using `dns1.registrar-servers.com` and `dns2.registrar-servers.com`. Existing Private Email MX/SPF/DKIM, Brevo and Mailtrap records are retained. A copy of the original records is held in the provisioning Mac's gitignored `.scratch/digitalocean/namecheap-dns-before.json`.

## Launch preparation gateway

`web.compose.yml` runs a pinned Caddy image with persistent certificate storage. The running `WEB_MODE=beta` configuration proxies to Next.js on loopback. Strapi has no public DNS/admin route. TCP 80 and 443 serve the site; the loopback health/preview listener stays private.

The modes are operational gateway choices:

| Mode      | Behaviour                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `beta`    | HTTPS reverse proxy to Next.js; the application controls invitations and indexing                           |
| `public`  | Temporary static fallback, HTTP 503, `Retry-After: 3600`, `Cache-Control: no-store` and `noindex, nofollow` |
| `preview` | Private loopback preview on port 8080                                                                       |

Do not select `public` to open the application. Full public launch requires a reviewed change to its beta and indexing controls. To apply a chosen mode, update the private `/opt/libraries-global/web.env` and run on the app server:

```sh
cd /opt/libraries-global
docker compose --env-file web.env -f web.compose.yml config --quiet
docker compose --env-file web.env -f web.compose.yml up -d --wait
```

Caddy renews Let's Encrypt certificates for the apex and www hostnames. HTTP redirects to HTTPS and www redirects to the apex. Preserve the certificate volumes during updates and restores. [The deployment runbook](deployment.md) covers application promotion and the static fallback.

## Current status

The apex and www records are saved in Namecheap and resolve to the app server. TCP 80 and 443 are open. Both hostnames have trusted Let's Encrypt certificates; www preserves the path and query when redirecting to the apex. The 12 original mail/provider records were retained and verified after the change.

The existing Next.js closed-beta entrance is live, using `WEB_MODE=beta` and `web/beta.Caddyfile`. HTTPS `/beta` returns 200, root access redirects to it, valid invitation access opens the real application, and the beta legal page returns 200. Its indexing and access controls come from the application; the static page's 503 handler does not apply to the beta proxy.

The CMS has no public DNS route; its login is available through a loopback SSH tunnel. Media uses the existing HTTPS Spaces CDN, verified against migrated objects and new CMS uploads. Custom media/Atlas hostnames are optional later changes.
