# Libraries Global

Read [AGENTS.md](AGENTS.md) for repository commands and conventions, and [CONTEXT.md](CONTEXT.md) for the domain model. This file is an entry point; load the references relevant to the task.

## Project references

- [Architecture](apps/docs/docs/architecture.md)
- [Frontend and authentication](apps/ui/README.md)
- [CMS and page builder](apps/strapi/README.md)
- [Pricing, Stripe catalogue and release requirements](apps/ui/PRICING.md)
- [Team API access](apps/ui/TEAM-API.md)
- [Local and production CMS content operations](apps/strapi/CONTENT-OPERATIONS.md)

Detailed agent context is local under the gitignored `.claude/context/` directory.

## Rules to keep in view

- Design for three million libraries: bounded reads, keyset pagination, database counts and Meilisearch queries. Never load every library into memory.
- Roles and library affiliations govern authority. Paid plans govern tools and limits; payment never grants trust, moderation or staff access.
- Routine editorial/content changes target production. Feature development and fixtures target local explicitly. Production content and code releases are separate operations.
- Local and production CMS Admin Tokens are in private environment files and have server-specific permissions. See the content operations guide; never print tokens or commit them.
- Regenerate `@repo/strapi-types` after Strapi schema changes. Rebuild shared packages after changing their source.
- Use the warm-paper design and existing `components/ds` primitives. Keep status accessible, honour reduced motion and preserve visible keyboard focus. Avoid `overflow: hidden` on page wrappers.
- Protect existing subscriptions and founding prices. New catalogue entries never silently move an existing subscriber.
- Production promotion follows protected-main publishing and the private operator acceptance runbook; preparing a catalogue or publishing CMS text does not deploy code.

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses canonical five-state vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
