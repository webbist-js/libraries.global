# @repo/catalogues

Talk to public library catalogues. Given a catalogue URL, this package works
out which library management system runs it, lists the branches it knows about,
and checks how many copies of a book (by ISBN) are on the shelf at each one.

libraries.global uses it to link each Library in the atlas to its library
service's catalogue and to show live availability on library pages.

## Credit

This is a TypeScript port of
**[catalogues-library](https://github.com/LibrariesHacked/catalogues-library)
by [Libraries Hacked](https://www.librarieshacked.org/)**, which has mapped the
catalogues of every UK public library service and worked out how to query
each kind of system. The connectors here are adapted from theirs, and the UK
service list (`src/data/librarieshacked-uk-services.json`) is their
`data.json`, unmodified. Both are MIT licensed; see [NOTICE](./NOTICE).

If you're working on UK library data, start with their work. If you fix a
connector here, consider sending the fix upstream too.

## What's different from upstream

- **TypeScript**, typed results, and errors with codes (`bot_challenge`,
  `blocked`, `http`, `timeout`, `parse`, `unsafe_url`, `unsupported`,
  `invalid_input`) instead of a swallowed `exception` field.
- **We don't get past bot protection.** Upstream's Arena connector runs
  JavaScript from the site's "loading" page with `Function()` to get a
  cookie; ours stops and reports `bot_challenge`. We send an honest
  User-Agent instead of rotating browser ones.
- **Checks every URL against private and loopback addresses**, including each
  redirect hop. Catalogue URLs can come from community contributions.
- **Branch codes** are returned where the catalogue exposes them, which makes
  matching branches to real places much more reliable.
- **Detection**: `detectCatalogue(url)` identifies the system from the URL, or
  failing that from the page HTML, so new libraries can be connected
  automatically.
- **Tests run against recorded pages** (`tests/fixtures/`), so CI doesn't depend
  on 200 council websites being up. `pnpm test:live` hits real sites.
- **Bug fixes**, including Enterprise counting the first "available" status as
  unavailable (`indexOf(...) > 0`) and LUCI's endpoints having moved.

## Usage

```ts
import {
  checkAvailability,
  detectCatalogue,
  listBranches,
  ukLibraryServices,
} from "@repo/catalogues"

// Identify a catalogue from any page on it
const detected = await detectCatalogue("https://aberdeencity.spydus.co.uk/")
// → { ok: true, value: { system: "spydus", baseUrl: "https://aberdeencity.spydus.co.uk/", … } }

// Or use a known UK library service
const aberdeen = ukLibraryServices.find((s) => s.gssCode === "S12000033")!

const branches = await listBranches(aberdeen.catalogue)
// → { ok: true, value: [{ name: "Airyhall Library", code: "28083" }, …] }

const copies = await checkAvailability(aberdeen.catalogue, "9781408855652")
// → { ok: true, value: { found: true, recordUrl: "…", holdings: [
//      { branch: "Airyhall Library", available: 1, unavailable: 1 }, … ] } }
```

Every call returns an `Outcome`: `{ ok: true, value }` or
`{ ok: false, error: { code, message } }`. Nothing throws.

Also exported: `matchBranch` (fuzzy branch → place name matching),
`findEditionIsbns` (other editions of a work, via Open Library),
`isValidIsbn` / `toIsbn13`, and `CatalogueHttp` if you want to set the
User-Agent, timeouts or per-host throttling yourself.

## Systems

What works when requests come from a UK IP with our honest User-Agent, as of
September 2026:

| System                  | UK services | Branches | ISBN lookup | Notes                                                             |
| ----------------------- | ----------: | :------: | :---------: | ----------------------------------------------------------------- |
| Spydus (Civica)         |          89 |    ✓     |      ✓      |                                                                   |
| Arena (Axiell)          |          40 |    ✓     |      ✗      | Search is behind a JavaScript challenge on every site we tried    |
| Enterprise (SirsiDynix) |          34 |    ✓     |      ✓      | Shared catalogues use `libraryNameFilter`                         |
| Prism 3                 |          20 |    ✗     |      ✗      | The hosting CDN refuses anything that isn't a browser             |
| Koha                    |           9 |    ✓     |      ✗      | Branches from the public REST API; the catalogue is behind Anubis |
| Aspen Discovery         |           7 |    ✓     |      ✓      |                                                                   |
| LUCI (Solus)            |           5 |    ✓     |      ✓      | Consortium catalogue: holdings include other services' branches   |
| Iguana                  |           3 |    ✓     |      ✓      | Renfrewshire serves an incomplete TLS chain                       |
| Durham                  |           1 |    ✓     |      ~      | Availability is inferred from waiting lists                       |
| WebPAC (Innovative)     |           1 |    ✓     |      ✓      | Holdings are by shelf location                                    |

"✗" is a deliberate choice. We could get past these blocks by pretending to be
a browser or solving the challenge, but a library service that puts its
catalogue behind bot protection has told us what it wants. The right fix is to
ask the service (or its supplier) to allow our User-Agent, or to use an
official API.

## Adding a connector

1. Add the system to `CatalogueSystem` in `src/types.ts`.
2. Write `src/connectors/<system>.ts` exporting a `CatalogueConnector`. Use the
   `CatalogueHttp` you're given for every request; use `uniqueBranches` and
   `HoldingsTally` from `./common`. `spydus.ts` is the simplest example.
3. Register it in `src/registry.ts`, and teach `src/detect.ts` to recognise it.
4. Record fixtures with curl (a request or two per page, with our
   User-Agent) into `tests/fixtures/<system>/` and write
   `tests/connectors/<system>.test.ts`.

Be a polite client: `CatalogueHttp` already throttles requests per host (250ms
by default). Don't add retries that hammer a site that's failing.
