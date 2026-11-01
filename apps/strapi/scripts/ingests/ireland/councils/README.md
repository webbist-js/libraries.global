# Irish council library feeds

These are four separately registered CC BY 4.0 Datasets, not a national directory.
Every run snapshots the data.gov.ie catalogue entry and checks its licence and
resource URL before reading the ArcGIS source.

| Dataset                     | Publisher                   | Source identity | Reviewed source rows |
| --------------------------- | --------------------------- | --------------- | -------------------: |
| `ie-fingal-libraries`       | Fingal County Council       | `F__REF`        |                   12 |
| `ie-roscommon-libraries`    | Roscommon County Council    | `GlobalID`      |                    6 |
| `ie-galway-libraries`       | Galway County Council       | `GlobalID`      |                   30 |
| `ie-south-dublin-libraries` | South Dublin County Council | `Council_ID`    |                    7 |

The exact catalogue and service URLs are in `feeds.ts`. The registered Dataset
contains its publisher-specific credit and licence URL. A changed row count,
duplicate source identity, truncated response or changed licence stops the run.
ArcGIS object IDs are used to validate acquisition, never as Library identity.

Run these commands from `apps/strapi`, replacing the Dataset key to test each feed:

```sh
pnpm ingest --dataset=ie-fingal-libraries
pnpm ingest --dataset=ie-fingal-libraries --local --check-cms
pnpm ingest --dataset=ie-fingal-libraries --local --apply --limit=5
pnpm ingest --dataset=ie-fingal-libraries --snapshot=scripts/ingests/ireland/councils/ie-fingal-libraries/.cache
```

Source-only dry runs need no CMS. CMS checks and writes require an explicit
`--local` or `--production`; local mode refuses remote CMS/database targets.
Use the private content-operations workflow for production credentials. Wait
for acceptance of the import Change Record suppression release before production
writes. These adapters use the existing draft writer and do not publish.

| Source                            | Library field    | Rule                                                                     |
| --------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| Publisher branch code or GlobalID | Source Record ID | Retained within its own Dataset                                          |
| `Name`                            | `name`           | Preserve the publisher's name                                            |
| Reviewed council geography        | Region           | Dublin, Roscommon or Galway; parent-scoped preflight                     |
| WGS84 point response              | `location`       | Require EPSG:4326 and Irish bounds; missing/invalid point remains absent |
| `Address1`                        | `streetAddress`  | Preserve source text                                                     |
| `Town`, or Fingal `Address2`      | `city`           | No nearest-place assignment                                              |
| `Eircode` / `Postcode`            | `postalCode`     | Preserve text                                                            |
| `Phone` / `Telephone_Number`      | `phone`          | Institutional feed number                                                |
| `Website` / Fingal website field  | `website`        | Valid public HTTP(S) URL only                                            |

Public libraries map to Public, the explicitly named archive service to Archive.
Current operation remains unknown. Email, free-text hours, images and generic
service descriptions are omitted. They do not establish individual accessibility
features or structured opening schedules.

Fingal's combined mobile/home-delivery entry is excluded. Both Galway Woodford
entries are quarantined because distinct IDs do not establish distinct branches.
Galway's feed includes Galway City, Westside and Ballybane: do not also import
the overlapping Galway City feed without an identity reconciliation.
CMS placement uses the existing traditional-county hierarchy: Fingal and South
Dublin feed records belong to Dublin, and Galway city and county records belong
to Galway. Publisher councils remain separate Datasets; the county relation does
not assert a shared library service. A CMS with only modern council-area Regions
needs a separately reviewed placement profile, not invented parent relations.
Equivalent county spellings are accepted only when exactly one Region matches.

Only these reviewed feeds are enabled. The remaining councils need licensed
sources and stable identity checks. Reusing existing records across other
Datasets also needs review; the shared runner skips only known Dataset/record
pairs. Cache snapshots and run logs are retained under each Dataset's ignored
`.cache/` and `.runs/` directories.

For population, car availability and deprivation preparation, see
[`apps/analysis/EUROPE-IMPORTS.md`](../../../../../analysis/EUROPE-IMPORTS.md).

For operator-managed SSH forwards, explicitly combine `--production --ssh-tunnel`. Both CMS and database must use explicit loopback forwarding ports rather than the default service ports. Database TLS verification remains required: set `DATABASE_SSL=true`, `DATABASE_SSL_CA_FILE` to the trusted CA file and `DATABASE_SSL_SERVERNAME` to the remote database certificate name. The existing REST/database identity checks still run. Never pass `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.
