---
sidebar_label: Storybook
---

# Storybook and the pattern library

`apps/storybook` is a separate Turborepo app named `@repo/storybook`. Storybook 10 uses the Next.js/Vite framework, React 19 and Tailwind v4. It imports production components directly from `apps/ui/src`; it does not publish a second component package or copy application code.

## Run and check it

Run commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev:storybook
```

Storybook listens on `http://127.0.0.1:6006`. The fixed port fails if occupied rather than silently selecting another port. `pnpm dev` also discovers this app. If the application services are already running, start only Storybook. No additional Next.js server, Strapi instance or database is needed.

```sh
pnpm build:storybook
pnpm --filter @repo/storybook lint
pnpm exec turbo run typecheck --filter=@repo/storybook --concurrency=1
pnpm --filter @repo/storybook exec playwright install chromium
pnpm test:storybook
pnpm --filter @repo/storybook test:dark
pnpm storybook:inventory
pnpm storybook:inventory:check
pnpm --filter @repo/storybook coverage:check
```

Build output is `apps/storybook/dist/`. The static build has a bounded 4 GiB Node heap for the full catalogue, including map/globe dependencies and component documentation. Development, typecheck and tests keep their 2 GiB caps. Browser tests are finite and use one Chromium worker. Run checks sequentially. The two required source libraries, shared-data and access, build before the Storybook Turbo tasks. Package-local commands bypass that dependency build.

Storybook's build/typecheck/test cache inputs include the UI source, messages, public assets and manifest. Production CSS is imported directly, including the design-system package's CSS exports. The Next.js application is a source dependency; building its server is deliberately absent from the Storybook task graph.

`.github/workflows/storybook.yml` verifies the inventory, types, lint, render/interaction/accessibility tests and static output. The existing unit-test CI command excludes Storybook because it has a separate browser job. `pnpm test` still discovers every workspace test task, including Storybook, so install Chromium before using it.

## Catalogue structure

| Group       | Owner                    | Purpose                                                          |
| ----------- | ------------------------ | ---------------------------------------------------------------- |
| Foundations | UI tokens and CSS        | Type roles, surfaces and library-type tints                      |
| Primitives  | `components/ui`          | Radix/Shadcn controls and compound contexts                      |
| Patterns    | `components/ds`          | Site heroes, fields, surfaces, navigation, feedback and overlays |
| Features    | Owning feature directory | Presentation with a domain meaning, such as feed-test feedback   |

Import the component file directly through `@/`. Avoid the design-system barrel in stories: it pulls unrelated modules and hides dependencies. Use `satisfies Meta<typeof Component>` and `StoryObj<typeof meta>` so fixture props follow the application contract.

Expose content and genuine variants as args. Favor `children`, an action slot or a named appearance prop when the structure is shared. Keep server fetches, authorization and mutation orchestration in the feature that owns them. Do not add a generic renderer with dozens of switches to absorb unrelated components.

For each applicable component, cover default and long content, missing/empty data, loading/error, disabled/read-only, narrow layouts, and meaningful visual variants. Compound primitives require their real parent contexts. Controlled fields use `useArgs` to keep the canvas and Controls synchronized. Callback args use `fn()` from `storybook/test`. Use `play` to assert visible behavior and accessible state rather than implementation details.

The locale toolbar uses the real English, Czech and French message files. Component-owned labels translate; story-authored copy remains the supplied fixture text. Components with an explicit `locale` prop use that prop for their server/content reads; adjust its Control alongside the toolbar when reviewing those pages. The provider clock and London timezone are fixed. Components that intentionally read the browser clock retain that behavior; opening-status stories document the time-dependent result.

## Runtime boundaries and fixtures

Storybook uses its own minimal Next config. It does not import the application config, Sentry setup, application environment validation, server providers, analytics or notification pollers. Vite's environment-file loading is disabled. Do not supply production credentials when building or running it.

The preview replaces data and runtime boundaries, while importing production UI components unchanged. `AccountAwareLink`, session-aware headers, drawers, editors and feature containers are the real implementations.

- The offline Better Auth client supplies `parameters.fixtureSession` through a lightweight preview context. Real access/capability hooks resolve that synthetic session. The server session reader sees the same fixture. Authentication actions are simulated and cannot create accounts or sessions.
- Server-only CMS, staff, API workspace access, Journal, drive and network readers resolve declared `parameters.serverFixtures` values. Reader promises are cached until the next story setup, supporting components that read with `React.use()`. Missing readers fail locally; no service credentials or application environment files are loaded.
- `next-intl/server` and request-header adapters supply local messages, locale defaults and empty request metadata. Server-rendered stories opt into `parameters.react.rsc`. Async component hosts use `.storybook/AsyncStory.tsx` to render the actual source output with a stable promise keyed by serializable args and locale; Controls changes resolve fresh output. The homepage’s event/globe aggregate readers also use the explicit server fixture transport, while other search methods retain their real browser client and local HTTP fixtures. Other stories retain the ordinary renderer.
- `parameters.fixtureResponses` declares synthetic browser responses by HTTP method and pathname. Exact query-string keys take precedence over a pathname fallback. A response may set `body`, `status`, `headers` and `delayMs`. Unmatched `/api/`, preview-server or external requests fail locally.
- MapLibre keeps its real map, markers, controls and worker. The two production Carto style URLs resolve to the self-authored local style under `public/maps`, with inline synthetic GeoJSON and no remote tiles or glyphs.

Example response declarations:

```tsx
parameters: {
  fixtureSession: readerSession,
  serverFixtures: { "staff.fetchStaff": { status: 200, body: workspace } },
  fixtureResponses: {
    "GET /api/example-record": { body: record },
    "POST /api/example-record": { status: 422, body: { error: "Example validation error" } },
  },
}
```

Use distinct synthetic IDs for scenarios with different data. Where variants use a fixed endpoint or document-wide state, isolate secondary presets in Docs and explore their controls in Canvas. An offline response exercises presentation and client behavior; permission enforcement and real service writes still need application tests.

The locale toolbar uses the application’s English, Czech and French messages. The provider clock is fixed; components that intentionally read the browser clock (including current opening status) keep that behavior and document it in their stories.

Self-hosted fonts, icons and synthetic artwork stay local. Only the public geographic subdirectories `apps/ui/public/images/globe` and `apps/ui/public/atlas` are additionally mapped, so the real globe can load its masks and boundary geometry. Their existing provenance files remain alongside the assets. The UI public root is never served or copied wholesale. The static build contains the selected assets and needs no UI server.

## Inventory and review

`pnpm storybook:inventory` scans every TS, TSX, JS, JSX and CSS file under `apps/ui/src`. It writes:

- `apps/storybook/audit/inventory.csv`: one row per file, source hash, layer, exports, story imports and boundary signals.
- `apps/storybook/audit/coverage.md`: counts by UI area.
- `apps/storybook/audit/components.csv`: distinct exported components, direct examples, composition references and explicit nonvisual exclusions.
- `apps/storybook/audit/structural-findings.md`: repeated JSX and long class lists to investigate.

`pnpm --filter @repo/storybook coverage:inventory` refreshes the export-level catalogue. `coverage:check` fails when a renderable export is missing or the snapshot/exclusion list is stale. It includes `components/**` and reusable route-owned UI, and excludes framework page/layout entrypoints. React context objects and the few nonvisual bootstrap effects are recorded with a reason in the audit.

The static build also compares the generated index with the source story count, catching silent story/Docs ID collisions. Avoid a story export named `Reference`, which is the global Docs entry name.

The check command fails on stale output. Regenerate after changing source or stories and commit the refreshed files. The inventory includes tests, styles and support code so the review scope stays explicit. A story import is not proof of every exported component or state being covered. Static boundary analysis is conservative and cannot decide whether two components mean the same thing.

See [the pattern-library audit](./pattern-library-audit.md) for reviewed overlaps, completed consolidations and the remaining feature review.

## Deployment notes

No hosting or production release is configured by this change. Storybook is an independent static site, with no Next.js server, CMS, database or runtime secrets. A future deployment should publish only the verified `apps/storybook/dist/` artifact from a checked release commit.

Build from the repository root with the lockfile:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm exec turbo run typecheck --filter=@repo/storybook --concurrency=1
pnpm --filter @repo/storybook lint
pnpm --filter @repo/storybook exec playwright install --with-deps chromium
pnpm test:storybook
pnpm --filter @repo/storybook test:dark
pnpm --filter @repo/storybook coverage:check
pnpm build:storybook
```

Use a dedicated origin or subdomain with the build output at its root. Subpath hosting needs a separately tested Vite base and asset/link configuration; it is not configured here. Serve files as generated, including `iframe.html`, `index.json`, fonts and the hashed assets directory. Do not rewrite missing asset URLs to `index.html`: a missing JavaScript file must return a 404.

Before publication, decide who can access the catalogue and put that policy at the hosting layer. The production site's beta gate does not protect this separate site. `noindex` metadata and `robots.txt` discourage indexing but provide no access control. Leave the existing Docs GitHub Pages deployment and the production application image/release flows in place.

For cache headers, revalidate HTML, `index.json` and other unversioned files; hashed assets may be cached immutably. Keep build artifacts by commit for rollback and replace releases atomically. Keep account-specific domains, DNS, tokens and operator steps in private storage.

After deployment, verify the manager, a direct `?path=/story/...` link, the preview iframe, Controls, locale switching, fonts/images and a drawer interaction on desktop and mobile. Confirm the chosen access gate applies to both manager and iframe/assets. Retain the previous artifact until those checks pass.

Framework reference: [Storybook for Next.js with Vite](https://storybook.js.org/docs/get-started/frameworks/nextjs-vite).

## Appearance coverage

The Appearance toolbar selects Light, Dark or System for the real application tokens. The preview uses the lightweight `AppearanceProvider`, its own `storybook-appearance-v1` storage namespace, and no session/account sync. Changing the header control updates the toolbar too. The manager chrome follows the browser preference separately; it is not the component's appearance. Reference docs use the selected appearance.

Keep interactive primary examples inline so Docs controls stay live. Presets that start with a modal open use an isolated Docs iframe; those iframes inherit their host’s appearance. The explicit System example follows the device preference independently. Repeated inline examples need unique label and heading IDs; preserve stable production anchors by supplying an example-specific ID in the story.

Run `STORYBOOK_APPEARANCE=dark pnpm --filter @repo/storybook test` as well as the default light run. Both execute the same interaction and axe checks with one browser worker; neither disables contrast findings. `Patterns/Appearance` covers settings, the portalled header radio menu and System detection. Use `T.action` for solid buttons with white ink, `T.accent` for links/focus and `T.bg.inverse` with `T.ink.inverse` for deliberately dark panels. Brand artwork, photographs, data palettes and the API response console keep their intended colours.
