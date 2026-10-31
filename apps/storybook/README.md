# Libraries Global Storybook

The component catalogue is a separate Turborepo app, `@repo/storybook`. It imports the UI app's source and styles; changes to a production component appear here without maintaining a copy.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev:storybook             # http://127.0.0.1:6006
pnpm build:storybook           # apps/storybook/dist/
pnpm test:storybook            # Chromium render, interaction and accessibility tests
pnpm --filter @repo/storybook test:dark
pnpm --filter @repo/storybook coverage:check
pnpm storybook:inventory       # refresh the complete UI source inventory
pnpm storybook:inventory:check # fail if the inventory is stale
```

`pnpm dev` includes Storybook alongside the existing services. If Next.js and Strapi are already running, start only `pnpm dev:storybook`. The port is fixed and the browser does not open automatically.

Before the first browser test run:

```sh
pnpm --filter @repo/storybook exec playwright install chromium
```

On Linux CI, use `playwright install --with-deps chromium`. Tests use one worker. Turbo builds the shared-data and access packages; it does not build Next.js or start Strapi. If running package scripts directly, build those two dependencies first.

The Storybook workflow checks the inventory, types, lint, all stories in light and dark, and the static build. The export gate requires direct or composed examples for every visual component, with documented nonvisual exclusions. The build also verifies that every named story is present in its generated index. Static builds have a 4 GiB Node heap cap; development and checks keep their 2 GiB caps. Storybook tests have their own CI job; the root `test:ci` command remains the application unit suite.

Read [the contributor and deployment guide](../docs/docs/storybook.md) and [the pattern-library audit](../docs/docs/pattern-library-audit.md). The generated per-file inventory and structural duplication signals live in [audit/](audit/coverage.md).
