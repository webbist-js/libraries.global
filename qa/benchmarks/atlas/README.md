# Atlas measurements

Use the existing local corpus. Do not generate or load millions of records locally.

`estimate:existing` reads the local CMS database and search statistics, samples at most 200 published libraries, and writes a small JSON report. It does not alter content or search indexes. The sample excludes relations and Notices, so projected byte counts are lower bounds. Database credentials are read internally from the local Strapi environment and never printed.

From the repository root, without installing anything:

```sh
node --import ./apps/strapi/node_modules/tsx/dist/loader.mjs qa/benchmarks/atlas/estimate-existing.ts
```

The historical disposable 100K probe reports are retained under ignored `artifacts/`; its generated data, archives, containers, native image and build cache have been removed. Those results verify the algorithms and provide estimates, but do not establish performance at three million records. `pathological` only reads the saved coincident-point failure report.

Synthetic fixture generation is optional, defaults to 1,000 and rejects more than 5,000. It requires both `ATLAS_BENCH_ENV=disposable-local` and `ATLAS_BENCH_ALLOW_SYNTHETIC=small-fixture-only`. Loader commands only accept the isolated localhost benchmark service and dedicated benchmark index names. Never use them on the existing search service.

Keep points <=1,000, cells <=256, facet values <=512, projection reads <=200 and index/export batches <=500. An incomplete facet sum or oversized archive must fail explicitly. Dense populations retain complete live aggregates; disabling tiles uses bounded current queries. Archive detail zoom is chosen by the real build's completeness and size checks, not by extrapolating a global record count.

Track query latency, index/clock lag, pending retries, archive bytes/build duration, dense tile sizes, retained versions and staging rebuild headroom as production grows. Start investigating before p95 query latency reaches 250 ms, current geometry reaches 256 KiB, or either tile byte limit is reached. Rebuild storage includes a second index, build scratch and retained archives; the linear raw-projection estimate excludes these costs.

The small application-renderer check is `node --import ./apps/strapi/node_modules/tsx/dist/loader.mjs qa/benchmarks/atlas/browser/renderer-smoke.ts` from the root. It uses installed Playwright/tsx/MapLibre, runs 100 point/aggregate mode transitions and pans, verifies graph cleanup, and removes its temporary bundle. It writes a small `/private/tmp/atlas-renderer-smoke.png` for inspection; remove that after use. Browser-entry types use `browser/tsconfig.renderer.json` with the UI bundler settings. It is a correctness check, not a scale or browser latency benchmark.
