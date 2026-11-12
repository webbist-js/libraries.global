# Libraries Global

Read [AGENTS.md](AGENTS.md) for repository commands and conventions, and [CONTEXT.md](CONTEXT.md) for the domain model. This file is an entry point; load the references relevant to the task.

## Project references

- [Architecture](apps/docs/docs/architecture.md)
- [Frontend and authentication](apps/ui/README.md)
- [CMS and page builder](apps/strapi/README.md)
- [Pricing, Stripe catalogue and release requirements](apps/ui/PRICING.md)
- [API Access](apps/ui/TEAM-API.md)
- [Local and production CMS content operations](apps/strapi/CONTENT-OPERATIONS.md)

Maintainer workspaces may also have a private `.brain/` link holding operational skills (linked under `.claude/skills/`) and domain notes (`.brain/context/`). It is optional, machine-local and never committed.

## Rules to keep in view

- Design for three million libraries: bounded reads, keyset pagination, database counts and Meilisearch queries. Never load every library into memory.
- Roles and library affiliations govern authority. Explorer and earned recognition govern browser tools; API Access governs machine access and limits. Payment, sponsorship or recognition never grant trust, moderation or staff access.
- Routine editorial/content changes target production. Feature development and fixtures target local explicitly. Production content and code releases are separate operations.
- Local and production CMS Admin Tokens are in private environment files and have server-specific permissions. See the content operations guide; never print tokens or commit them.
- Regenerate `@repo/strapi-types` after Strapi schema changes. Rebuild shared packages after changing their source.
- Use the warm-paper design and existing `components/ds` primitives. Keep status accessible, honour reduced motion and preserve visible keyboard focus. Avoid `overflow: hidden` on page wrappers.
- Protect existing API subscriptions. New catalogue entries or prices never silently move an existing subscriber.
- Production promotion follows protected-main publishing and the private operator acceptance runbook; preparing a catalogue or publishing CMS text does not deploy code.

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/` (gitignored; in maintainer workspaces a link into the private brain's local storage). See `docs/agents/issue-tracker.md`.

### Triage labels

Uses canonical five-state vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
