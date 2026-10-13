# Reviewed geographic corrections

These are editorial corrections to existing drafts after the initial Wikidata import. The shared runner skips matching Source Records on replay, preserving these changes. Import counts in the ingest guide describe the original snapshot, before these corrections.

## AU Library, Psykiatri — 11 October 2026

- Source identity: [Wikidata Q21107575](https://www.wikidata.org/wiki/Q21107575).
- Library document: `afhan56seir5djx60e86n6qr`.
- Added Area: Aarhus Kommune, reporting code `751`, document `q8ef56sml7z30ggnpfu2cxzt`.
- Added Region: Midtjylland, reporting code `082`, document `juas4k2uakzhesz5qpygt674`.
- The existing lifecycle generated `europe:denmark:midtjylland:aarhus-kommune:au-library-psykiatri-dk-q21107575`.

AU's [staff welcome booklet](https://medarbejdere.au.dk/fileadmin/www.medarbejdere.au.dk/hr/Rekruttering/Onboarding/Introduktion_for_nyansatte/velkomstfolder_DK_2509_web.pdf) lists the library at Skovagervej 2, 8240 Risskov. Its [library resource guide](https://library.au.dk/fileadmin/www.bibliotek.au.dk/Search/Adgang_til_Det._Kgl._Biblioteks-Aarhus_Universitets_ressourcer_lsa.pdf) also identifies the library in Risskov. The [Aarhus municipal property register](https://backoffice.aarhus.dk/media/osvl30n3/aarhus-kommune-regnskab-2020-bilag-b-ejendomsfortegnelse-2020.pdf?format=noformat) places Skovagervej, Risskov in Aarhus Kommune, code 751. The [regional municipal directory](https://www.rm.dk/om-os/hvad-er-regionen/kommuner/) confirms Aarhus Kommune belongs to Midtjylland.

The geographic assignment follows that historical address evidence. It does not establish present operation or a current visitor address. The record remains a draft with operational status unknown. Name, address, coordinates, contact fields and original Wikidata attribution were preserved. The API response and resulting database values were checked; the before/after record and source URLs are retained in `dk/.runs/au-library-psykiatri-geography-correction.json`.

This correction reduces the initial batch's 124 missing entity references to 123.
