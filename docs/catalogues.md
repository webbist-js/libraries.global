# Catalogues

How libraries.global connects Libraries to their library service's online
catalogue (OPAC) and shows live book availability.

The connector code is in [`packages/catalogues`](../packages/catalogues/README.md),
a TypeScript port of [LibrariesHacked/catalogues-library](https://github.com/LibrariesHacked/catalogues-library).
The rule that we never get past bot protection is in
[ADR 0004](./adr/0004-catalogue-connectors-never-bypass-bot-protection.md).

## Model

```
Catalogue (api::catalogue.catalogue)          one per library service
  system, baseUrl, version, settings           → CatalogueConfig for the package
  gssCode, countryCode                         scopes branch matching
  branchStatus / availabilityStatus            unverified | active | failing | unsupported
  source                                       librarieshacked | detected | manual
  └── Catalogue Branch (api::catalogue-branch.catalogue-branch)
        name, code                             as the catalogue lists it
        libraryDocumentId                      the Library it corresponds to
        matchStatus                            confirmed | auto | review | unmatched | rejected
```

Neither type has draft & publish. They hold operational data, not editorial
content. Branches point at Libraries by `documentId` rather than through a
relation, so matching never writes to a Library. In Strapi v5 that write would
go to the Library's draft, and publishing it to make the link live would also
publish any unrelated pending edits.

A service shares a catalogue with its branches, and sometimes with other
services (Libraries West and the London Libraries Consortium each run one
catalogue for several authorities, split by settings). That's why the
Catalogue sits at the service level and not on each Library.

## Flows

**Seeding.** On first boot Strapi imports the 209 UK library services from the
LibrariesHacked dataset (`importUkServices`, idempotent by GSS code). Re-run
it with `POST /api/catalogues/import-uk` (API token).

**New Library.** When a Library is created or saved with a `catalogueUrl`, a
document middleware (`src/documentMiddlewares/catalogue.ts`) calls
`linkLibrary` in the background. It detects the system from the URL (or the
page HTML), finds the Catalogue with the same system and base URL (using the
Area's `gssCode` to choose between shared ones), or creates one with
`source: detected`, and then runs branch discovery.

**Branch discovery.** `discoverBranches` lists the catalogue's branches and
matches each one against candidate Libraries: those in the Area with the
Catalogue's GSS code, then those whose `catalogueUrl` is on the same host,
then the whole country. Confident matches are saved as `auto`, near-misses as
`review`. An editor's `confirmed`/`rejected` decision is never overwritten.
This runs weekly (`catalogueBranchDiscoveryJob`, Mondays 02:00, needs
`CRON_ENABLED=true`), or on demand with
`POST /api/catalogues/:documentId/discover`.

**Availability.** The library page (RSC) calls
`GET /api/catalogues/for-library/:documentId`. If the Library has a Catalogue
whose `availabilityStatus` isn't `unsupported`, it renders the "Check the
catalogue" section. A reader enters an ISBN, the browser calls the Next route
`/api/catalogues/availability`, and that calls Strapi
`GET /api/catalogues/availability?library=…&isbn=…`, which runs the connector.
Results are cached for 30 minutes per catalogue and ISBN. The Next route allows
10 checks per reader IP per minute, and Strapi caps all traffic at 120 a minute.

## Reviewing matches

In the admin panel, filter Catalogue Branches by `matchStatus = review`, then
set `libraryDocumentId` and `confirmed`, or set `rejected`. `unmatched`
branches are often libraries the atlas doesn't have yet, which makes them good
leads for new Library records.

## Before production

- `DEFAULT_USER_AGENT` in `packages/catalogues/src/http.ts` links to
  `https://www.libraries.global/wiki/catalogues`. That page has to exist and
  explain what the bot does and how to contact us, or the honest User-Agent
  doesn't mean much.
- Run from a UK region. Some council sites block non-UK traffic.
- Set Area `gssCode` for UK Areas. Branch matching is much more accurate when
  scoped to the right authority.
