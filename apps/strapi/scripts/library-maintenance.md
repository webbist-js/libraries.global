# Local library maintenance

These tools are for the local prelaunch catalogue. They read `apps/strapi/.env`,
reject remote database/Strapi hosts, and default to a dry run. Apply mode requires
`--backup <path>` pointing to a completed PostgreSQL custom-format dump (`pg_dump
-Fc`). Keep the dump and reports until the result has been checked.

Run with Node 22 from the repository root:

```sh
node apps/strapi/scripts/compact-library-audit-baselines.cjs
node apps/strapi/scripts/check-library-audit-compaction.cjs
node apps/strapi/scripts/publish-ready-libraries.cjs
```

`compact-library-audit-baselines.cjs --apply --backup <path>` removes only draft
import creation baselines with an identical published baseline for a live library.
The match includes locale, source, field, values, entityRef, actor, reviewer and
event date; neither entry can belong to a submission. A transaction protects the
operation. Fingerprints verify that retained audit entries, libraries, source
components, dataset credits and article history do not change. Any discrepancy
rolls back the deletion. The regression check uses connection-local temporary
tables and does not write persistent catalogue data.

`publish-ready-libraries.cjs --apply --backup <path>` publishes draft-only libraries
with complete entityRefs, plus all draft-only geographic places, through normal
Strapi routes. It publishes parents first, checks the entityRef against location
links, and verifies each published library's sources, identity and creation date.
Existing published libraries are not republished. Publication events reach the
normal audit, search and Atlas outbox hooks.

Publication reports are written under `.scratch/audit-history/`. An apply run
creates `publication-manifest.json`; rerunning resumes that manifest and verifies
already-published entries. Before planning a new group, move the completed
manifest, result and progress reports into an archive subdirectory. Dry runs
write `publication-plan.json` and do not replace an apply manifest. One advisory
lock serializes apply runs, including manifest creation.

## Repairing missing geography

`repair-library-geography.cjs` consumes three cached evidence files under
`.scratch/audit-history/`:

- `entityref-gap-evidence.json`: draft identities, original source IDs, location
  relations, addresses and coordinates from the original Nordic import cache.
- `current-nordic-places.json`: existing area and region document IDs, country
  codes, official population reporting codes and each library's current map pin.
- `osm-gap-boundaries.json`: OpenStreetMap administrative areas containing each
  map pin, keyed by its original Wikidata ID, with raw area IDs and tags.

The dry run must match every input before apply mode can write. A normal match
requires the expected country, one current municipality, and a containing region
that agrees with its existing CMS hierarchy. Ambiguous matches fail. Christiansø
uses its existing Statistics Denmark reporting area (411 under 084), supported by
the island administration's library page; it is outside the municipalities.

Apply mode connects the verified region/area and lets the library lifecycle
generate the entityRef. It appends supporting `sourceRecords` for the geography,
with supported fields, source URL, retrieval date and dataset credit, while
verifying that original sources, map pins, names, slugs and creation dates stay
intact. Repairs do not mark a library as personally verified. Progress is saved
after each record; a resumed run checks existing relations and avoids duplicate
references. Keep the cached evidence with the repair report.

After repair, start a fresh publication manifest for the newly eligible libraries.
Check database totals, public library search, and the Atlas worker after publication;
Strapi retains draft versions of published records, so success means no draft-only
documents remain, rather than no physical draft rows.
