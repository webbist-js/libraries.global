# Beta authentication reset

`reset-beta.mjs` is an explicit one-shot reset for the existing local development database. It refuses remote hosts, new plugin accounts, changed plans, unknown dependencies and repeat execution. It never creates a database or schema. Production needs a separately reviewed operator procedure and maintenance window.

Before running it, stop account writes and take a restorable database snapshot with a PostgreSQL client matching the server. Keep snapshots, environment files and reports outside Git. Verify the endpoint is the development database, not a production tunnel. The script requires an explicit environment file containing `DATABASE_URL`.

1. Generate a plan: `node scripts/auth/reset-beta.mjs --env-file apps/ui/.env.local --report /private/tmp/auth-reset-plan.json`.
2. Review the manifest, deletion tables, cleared identity columns, reference inventory and retained-content counts. Unexpected dependencies require a code review, not a blanket cascade.
3. Rehearse with `--rehearse PLAN_DIGEST` and a separate private report. The entire mutation runs and rolls back after retained-data fingerprints and account-reference checks pass.
4. Apply the same reviewed plan using `--apply PLAN_DIGEST`. Data drift requires a fresh plan and review. The transaction writes a durable completion checkpoint.
5. Run `node scripts/auth/retire-legacy-settings.mjs apps/ui/.env.local` to remove only the reviewed obsolete plugin/backfill settings after the reset checkpoint and retired tables are verified. Then start the new CMS, verify plugin schemas and application state, then exercise authentication and domain permissions before reopening writes. Never rerun the reset to remove test users created after cutover; use account deletion.

The manifest removes beta accounts, profiles, grants and account-owned test state. It retains catalogue/editorial records, publication dates, source provenance, media inventory, CMS administrators and API tokens. History becomes a system baseline, not a new contribution. Retired ownership cannot reconnect through email; billing callbacks require a current customer binding.

Rollback requires the matching pre-cutover code and full database snapshot before accepting new writes. Rolling back only an application image does not restore the old identity model. Recovery after new registrations requires a reviewed forward-recovery plan.

## Local acceptance

With the existing Next.js app running and port 1337 free, run `NODE_OPTIONS=--max-old-space-size=4096 node scripts/auth-local-acceptance.mjs` from `apps/strapi`. It compiles and starts the sole local CMS, captures auth email in memory, exercises cookie transport and the real PostgreSQL adapter, and stops the CMS afterward. It also uses an in-memory WebAuthn device to test registration, login, large unsigned counters, origin/replay rejection and mobile identity confirmation. When local mobile signing is unconfigured, the runner supplies an ephemeral fixture key without writing it to the environment file.

Synthetic accounts are cleaned up. Runtime logs can contain verification links; keep them private and out of commits. OAuth provider authorization still needs browser acceptance. The synthetic WebAuthn check does not exercise physical device prompts or platform credential storage.
