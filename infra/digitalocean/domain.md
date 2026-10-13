# Domain routing

The primary hostname is `libraries.global`. `www.libraries.global` redirects to it with the request path and query string preserved.

| DNS type | Namecheap host | Value              | TTL       |
| -------- | -------------- | ------------------ | --------- |
| A        | `@`            | `178.62.44.94`     | 5 minutes |
| CNAME    | `www`          | `libraries.global` | 5 minutes |

Namecheap remains the DNS provider, using `dns1.registrar-servers.com` and `dns2.registrar-servers.com`. Existing Private Email MX/SPF/DKIM, Brevo and Mailtrap records are retained. A copy of the original records is held in the provisioning Mac's gitignored `.scratch/digitalocean/namecheap-dns-before.json`.

## Launch preparation gateway

`web.compose.yml` runs a pinned Caddy image with persistent certificate storage. The running `WEB_MODE=beta` configuration proxies to Next.js on the app server's loopback interface. Strapi remains private.

The initial private preview listens on `127.0.0.1:8080` on the app server:

```sh
WEB_MODE=preview docker compose -f web.compose.yml up -d --wait
```

Once the DNS records and public firewall rules are approved and saved, enable the public configuration:

```sh
WEB_MODE=public docker compose -f web.compose.yml up -d --wait
```

The public configuration obtains and renews Let's Encrypt certificates for both hostnames. TCP 80 and 443 are required on the app server. HTTP redirects to HTTPS; HTTPS on `www` redirects to the primary hostname. The loopback preview/health listener remains private. Other application and database ports retain their existing firewall restrictions.

The temporary page returns HTTP 503, `Retry-After: 3600`, `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow`. Its robots file disallows crawling. These controls and the public Caddy configuration passed validation on the app server before publication.

The beta configuration uses the Next.js reverse proxy, with the application's invitation and noindex controls. At full public launch, remove the beta gate and apply the intended indexing policy. The static 503 handler is retained as an operational fallback.

## Current status

The apex and www records are saved in Namecheap and resolve to the app server. TCP 80 and 443 are open. Both hostnames have trusted Let's Encrypt certificates; www preserves the path and query when redirecting to the apex. The 12 original mail/provider records were retained and verified after the change.

The existing Next.js closed-beta entrance is live, using `WEB_MODE=beta` and `web/beta.Caddyfile`. HTTPS `/beta` returns 200, root access redirects to it, valid invitation access opens the real application, and the beta legal page returns 200. Its indexing and access controls come from the application; the static page's 503 handler does not apply to the beta proxy.

The CMS has no public DNS route; its login is available through a loopback SSH tunnel. Media uses the existing HTTPS Spaces CDN, verified against migrated objects and new CMS uploads. Custom media/Atlas hostnames are optional later changes.
