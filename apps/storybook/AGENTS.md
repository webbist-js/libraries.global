# Storybook pattern library

This is `@repo/storybook`, a separate Turbo app for `apps/ui` source. Read the UI app's AGENTS.md when editing production components.

- Import production components directly through `@/`; never copy their implementation into stories.
- Organize stories under Foundations, Primitives, Patterns and Features. Use synthetic data and curated local assets.
- Cover meaningful variants with typed args and controls. Use real compound contexts and real portals. Use `useArgs` for controlled inputs.
- Run finite checks sequentially, with one browser worker. Reuse existing application servers; stories do not need Next.js, Strapi or PostgreSQL.
- The Vite aliases in `.storybook/main.ts` are explicit browser seams. Document any additions. Do not load app environment files, credentials, production providers or live services.
- Keep the inventory current with `pnpm storybook:inventory`; check it with `pnpm storybook:inventory:check`.
- Deployment is a separate decision. The static build is `dist/`; do not publish the repo or the UI public directory. Read `../docs/docs/storybook.md` before preparing hosting.
