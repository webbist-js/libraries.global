# Strapi + Next.js Monorepo

Monorepo starter with Strapi v5 CMS and Next.js 16 frontend. Uses pnpm workspaces with Turborepo.

## Workspaces

| Path                     | Description                                                                 |
| ------------------------ | --------------------------------------------------------------------------- |
| `apps/ui`                | Next.js 16 (App Router, React 19, TailwindCSS v4, Shadcn/ui)                |
| `apps/strapi`            | Strapi v5 CMS (Docker PostgreSQL locally; managed PostgreSQL in production) |
| `packages/strapi-types`  | Auto-generated TypeScript types from Strapi schemas                         |
| `packages/design-system` | Shared TailwindCSS tokens and CkEditor styles                               |
| `packages/shared-data`   | Shared constants and types                                                  |
| `qa/tests/playwright`    | E2E and accessibility tests                                                 |

## Essential Commands

```bash
pnpm dev              # Start both apps (Docker required for DB)
pnpm build            # Build all
pnpm lint             # ESLint all packages
pnpm typecheck        # Typecheck (run from apps/ui)
```

See [docs/commands.md](docs/commands.md) for full command reference.

## Type Generation (Critical)

After ANY Strapi schema change:

```bash
cd apps/strapi && pnpm generate:types
```

This updates `@repo/strapi-types`. Forgetting causes silent type mismatches between apps.

## Documentation

- [Commands Reference](docs/commands.md) — All pnpm commands
- [Architecture](docs/architecture.md) — System design and patterns
- [Page Builder](docs/page-builder.md) — Component registry and rendering
- [Strapi API Client](docs/strapi-api-client.md) — Fetching content from Strapi
- [Pages Hierarchy](docs/pages-hierarchy.md) — URL structure and redirects
- [Authentication](docs/authentication.md) — Better Auth + Strapi JWT integration
- [Strapi Schemas](docs/strapi-schemas.md) — Schema attributes, localization, lifecycle hooks
- [Strapi Types](docs/strapi-types-usage.md) — Type utilities and usage patterns

## Production deployment

Routine editorial/content changes target production; feature development and fixtures use local explicitly. Local and production CMS credentials have server-specific permissions. See [CMS content operations](apps/strapi/CONTENT-OPERATIONS.md) for the private connections and current MCP/API transport, and [Pricing](apps/ui/PRICING.md) for catalogue and publication requirements.

The closed beta runs on DigitalOcean in London. Host-specific infrastructure and operator runbooks are private. In maintainer workspaces, read `docs/operations/infrastructure/digitalocean/README.md` and `deployment.md` before changing production setup. `dev` is the protected source branch. GitHub image publishing is prepared; production promotion is manual and separate from merging. Runtime secrets and SSH keys stay outside images and Git. Update official Strapi packages together rather than forcing CMS transitive security overrides. Local operational acceptance and the deployment retrospective are under gitignored `docs/operations/`.

## Commits

Uses conventional commits enforced by Husky + commitlint.

```bash
pnpm commit    # Interactive Commitizen flow
```

Or write manually: `type(scope): subject`
