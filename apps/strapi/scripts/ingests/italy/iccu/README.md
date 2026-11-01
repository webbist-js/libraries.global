# Italian library directory

Imports the [ICCU Anagrafe open-data export](https://anagrafe.iccu.sbn.it/it/open-data/).
The JSON export is CC0; the website's editorial text and images have different,
non-commercial terms. Only export fields are used. The Dataset registry keeps
the publisher, licence URL, attribution, coverage and exclusions.

Run from `apps/strapi`:

```sh
pnpm ingest --dataset=it-iccu
pnpm ingest --dataset=it-iccu --local --check-cms
pnpm ingest --dataset=it-iccu --local --apply --limit=5
pnpm ingest --dataset=it-iccu --snapshot=scripts/ingests/italy/iccu/.cache
```

Dry runs download and map the full export without CMS writes. `--check-cms`
also checks existing geography and Source Records. `--local` requires loopback
CMS and database targets. `--production` requires an explicit non-local CMS URL;
select its credentials using the private content-operations workflow. Do not
run production imports until the import Change Record suppression release has
passed acceptance. The new adapter does not bypass the existing write pipeline.

The downloader caps the ZIP at 32 MiB and the JSON member at 80 MiB. It reads
only `biblioteche.json`, without extracting paths to disk. The source count must
match `metadati.biblioteche-estratte`; missing or duplicate ISIL identities fail
the run. `--refresh` fetches a new snapshot. Keep `.cache/` and `.runs/` for each
published import; both are ignored by Git.

| Source                             | Library field              | Rule                                                                                             |
| ---------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| `codici-identificativi.isil`       | Source Record ID           | Stable `IT-XXnnnn` identifier; never a row number                                                |
| `denominazioni.ufficiale`          | `name`                     | Preserve official spelling; reject overlong names                                                |
| `indirizzo.regione`                | Region                     | Explicit translation to the existing Italian hierarchy; CMS preflight must match                 |
| `indirizzo.provincia.nome`         | Area                       | Match within its Region; report unmatched provinces, quarantine conflicting parents              |
| `indirizzo.coordinate`             | `location`                 | Source order is latitude, longitude; bounds checked; mobile base pins omitted                    |
| `via-piazza`, `comune.nome`, `cap` | Address, city, postal code | Preserve text and leading zeroes                                                                 |
| `tipologia-funzionale`             | `libraryType`              | Public, Special, Academic, National, Mobile or Other; unknown vocabulary is quarantined          |
| `contatti` of type `Url`           | `website`                  | First valid public HTTP(S) URL                                                                   |
| `stato-registrazione`              | Exclusion/warning          | Closed, merged, planned and administrative records excluded; uncensused records retain a warning |

Operational status remains unknown. Restricted admission does not establish an
appointment-only service. No personal contacts, photographs, editorial copy,
daily hours or accessibility claims are imported. Schools are Academic; source
functional classification is not inferred from the institution name.

The shared runner retains provenance on the Library, creates drafts with the
bridge secret, skips known Dataset/record pairs and preserves contributor edits.
Publication remains separate. Review cross-source duplicates before production;
Source Record matching only establishes identity within this Dataset.

Province placement accepts Italian administrative prefixes and a small reviewed
set of equivalent labels (for example Firenze/Florence and Bolzano/Bozen).
Aliases are scoped to the resolved Region; two matching Areas fail the run.
They do not translate between boundary editions or merge abolished provinces.
Run the target geography preflight to verify every province match. Aliases remain
scoped to the parent Region and ambiguity is an error. Existing Source Records
are skipped; this import does not rematch already imported Libraries.

For operator-managed SSH forwards, explicitly combine `--production --ssh-tunnel`. Both CMS and database must use explicit loopback forwarding ports rather than the default service ports. Database TLS verification remains required: set `DATABASE_SSL=true`, `DATABASE_SSL_CA_FILE` to the trusted CA file and `DATABASE_SSL_SERVERNAME` to the remote database certificate name. The existing REST/database identity checks still run. Never pass `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.
