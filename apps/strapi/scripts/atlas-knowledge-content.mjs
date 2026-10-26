/** Reviewed Atlas guides. Expanded capacity copy is staged until its code release. */
const text = (value) => ({ type: "text", text: value })

export const atlasRich = (markdown) => ({
  __component: "content.rich-text",
  body: markdown
    .trim()
    .split(/\n\s*\n/)
    .map((value) => ({
      type: value.startsWith("## ") ? "heading" : "paragraph",
      ...(value.startsWith("## ") ? { level: 2 } : {}),
      children: [text(value.replace(/^## /, "").replaceAll("\n", " "))],
    })),
})
export const atlasLink = (label, url) => ({
  type: "paragraph",
  children: [{ type: "link", url, children: [text(label)] }],
})
const related = () => ({
  __component: "content.rich-text",
  body: [
    atlasLink("Explore the Atlas", "/map"),
    atlasLink(
      "Walking, cycling and service Reach",
      "/knowledge/data-api/understanding-library-reach"
    ),
    atlasLink(
      "Population, deprivation and Library access",
      "/knowledge/data-api/atlas-population-and-context"
    ),
    atlasLink("Plans and Pro", "/knowledge/governance/plans-and-pro"),
  ],
})

export function reachAllowanceCopy(expanded) {
  return expanded
    ? `Smaller services include 5, 10, 15 and 30 minutes in one calculation. Larger services generate only the selected time. Change the time, then choose Calculate coverage again; the previous result is cleared while your selection differs. An identical saved calculation may be reused.

Pro allows up to 50 eligible libraries, with all four times inside a 2,500 km² envelope and 75 km maximum span. For one selected time, the limits rise to 20,000 km² and 200 km. Active Team seats allow up to 100 libraries, a 5,000 km² / 150 km envelope for all four times, or 40,000 km² / 400 km for one time. Both the service’s library locations and its full reporting boundary must fit. These are conservative bounding boxes, not measurements of land area.

Pro allows 20 new calculations per hour; active Team seats allow 100. Returning a saved identical result does not use a new calculation. Limits also apply to raster cells, the shared queue and calculation time, so a request within the geographic allowance can still be unavailable. Team capacity is bounded; it does not enable an arbitrary national calculation. Buying membership does not grant Library editing authority.`
    : `Service Reach currently supports up to 50 eligible libraries, a 75 km maximum span and a 2,500 km² envelope covering both the library locations and the full reporting area. A larger rural service can exceed this allowance even with relatively few branches. Use one-library Reach to inspect a branch locally. Zooming does not shrink a service’s reporting boundary. One-library Reach requires a local map view, at zoom 11 or closer with no more than 100 matching libraries in view.`
}
export function atlasKnowledgeArticles(sectionId, expanded = false) {
  const article = (title, slug, summary, copy) => ({
    title,
    slug,
    summary,
    author: "Libraries Global Editorial Team",
    articleStatus: "beta",
    section: { connect: [{ documentId: sectionId }] },
    body: [atlasRich(copy), related()],
  })

  return [
    article(
      "Walking, cycling and service Reach",
      "understanding-library-reach",
      "Choose a library or service, calculate modelled walking or cycling coverage, and understand the boundary, population source and limits.",
      `Reach estimates how many residents could reach selected recorded libraries within a chosen walking or cycling time. It models geographical proximity. It does not measure visits, membership, service quality or whether somebody can use a library.

## Calculate coverage

Open Layers and enable Travel-time reach. Choose one library or a library service. The service picker searches by name and lets you narrow the choices by country and region. Selecting a service focuses the map on its mapped libraries. Choose Walking or Cycling and a travel time, then use Calculate coverage. Changing service, mode or library filters needs another calculation; the map does not silently keep an old result for a new selection.

The reporting area comes from the supported districts containing the service’s eligible mapped libraries. It is a description of recorded locations, not a legal service boundary. Panning the map does not change this denominator. Library filters can narrow the included libraries while the full service reporting boundary stays the same. Clear overly restrictive filters if no eligible libraries remain.

## Read the result

The headline percentage is the share of the reporting area’s modelled residents within the selected time. Residents within the time and beyond it use the same population edition. Overlapping library catchments count a resident once. In a four-time result, Distinct bands puts each resident in one interval; Within each time shows cumulative totals. These two presentations answer different questions and should not be added together.

A partial result means routing or population information is incomplete. Unknown counts stay unknown. Missing routes cannot prove that residents lack a nearby library. Zero residents is only shown when the model supports zero. Reach ignores opening hours; a record without hours can still have geographical Reach if it has a suitable fixed location and a supported route.

## Check which libraries were included

Service Reach includes the selected network’s eligible recorded libraries. A nearby branch belonging to another service is not automatically included. In the Aberdeen example, a calculation for Aberdeen City Library Service does not include Westhill simply because it is nearby: Westhill belongs to neighbouring Aberdeenshire. Check neighbouring services or individual libraries before calling an apparent gap a library desert.

Mobile libraries, permanently closed libraries and records without usable mapped origins do not become fixed destinations. The source and exclusions panel explains the selected library count and routing failures. Directory completeness and population coverage are separate: a complete raster cannot supply a missing library record.

## Larger services and calculation limits

${reachAllowanceCopy(expanded)}

## Sources and practical limits

The installed UK profile uses the GHS-POP R2023A 100 m population grid for 2020 and mapped OpenStreetMap roads and paths through Valhalla. Residents are allocated by exact fractional cell intersections in an equal-area projection. This assumes residents are spread uniformly within a cell. Known zero cells count as zero; NoData remains unknown. The source year is not a claim about today’s population.

Walking uses a base speed of 5.1 km/h and cycling 15 km/h; mapped route costs also affect travel time. Ferries are excluded. The model does not include elevation, opening hours, temporary closures or a step-free route guarantee. A chosen time is an analytical threshold, not an accessibility standard. Check the library’s visiting information before travelling.

## Share or download

About explains the source editions, reporting boundary and limitations. Downloads offers CSV, display GeoJSON and Analysis JSON. Analysis JSON retains the selection snapshot, unrounded results and dataset versions. Display geometry is simplified and should not be used to reproduce population counts. Keep the source credits and dates with any published figure.`
    ),
    article(
      "Population, deprivation and Library access",
      "atlas-population-and-context",
      "Use population detail, Library access comparisons and UK context layers without confusing missing records with zero provision.",
      `Population layers help put library locations in context. They describe where people live and the records we hold; they do not establish demand, unmet need or service quality on their own.

## Choose useful population detail

Enable Population density in Layers. Automatic detail follows map zoom. Country averages help compare broad patterns; region and local-area averages provide more detail where those datasets exist. In supported grid areas, zoom in to see the population surface and select a cell for its value. The density unit is residents per square kilometre. A cell’s resident count is a different quantity.

Library filters change the library selection, not the population surface. Keep Population density underneath Reach to compare settlement patterns with a selected service’s catchment. Only one background area layer is shown at once; its legend and source stay in its data drawer.

Country population figures and Reach population are different datasets. A country’s recent World Bank total is not substituted into a 2020 Reach calculation. Keep the year and geography with every comparison. Where local boundaries or a grid are unavailable, Atlas can still show a supported country average. Missing local data does not become a blank country total or an invented fine-grained surface.

## Compare Library access

Library access shows recorded eligible libraries relative to a population denominator. Use Overview for the selected area, Explore for the distribution and Compare for two areas. Check the geography, source year, library scope and missing-data notes before comparing rates. A country-level rate is not a walking-time measure.

Unlocated records can appear in the directory while being absent from a mapped count. An area with no recorded library is not necessarily an area with no library. The denominator’s population quality and the completeness of the library directory both matter.

## Deprivation

The deprivation layer uses each UK nation’s own published index: IMD for England, WIMD for Wales, SIMD for Scotland and NIMDM for Northern Ireland. Its categories describe relative deprivation within that national edition. A similarly numbered category in two nations is not a common UK scale, and it should not be treated as one.

For a supported service calculation, Reach’s Community context can show population-weighted coverage by national deprivation quintile. This uses the same population surface and full analytical catchments as the main result. Unknown or conflicting source areas remain a separate unknown group. If the context calculation lacks enough data, Atlas keeps the valid base Reach result and explains that the context is unavailable.

## Households without a car

This layer uses Census 2021 information for England and Wales. It describes households, not people, journey choices or car availability at a particular time. It can provide context for walking and cycling provision, but cannot establish who can reach a library or whether public transport is adequate.

## Check availability before drawing conclusions

UK routing, population grids and context datasets have their own coverage. Loading library records for Canada, Mexico or another country does not automatically install its routing graph, population raster, census boundaries or deprivation equivalent. Atlas uses the layers supported by the available data and keeps unsupported analyses unavailable. Transit stops and lines, service benchmarking and unfinished coverage tools remain marked Coming soon.`
    ),
    article(
      "Reading partial and fuller library records",
      "library-records-and-missing-information",
      "Understand incomplete records, opening information, recorded facilities, sources and ways to help improve a library page.",
      `A library page can be useful before every field is filled in. The page shows the facts and sources we hold and offers ways to fill gaps. A sparse imported record is a starting point, not confirmation that a service or facility is absent.

## Before a visit

Check the address and map location, operational status, contact details and any recorded visiting requirements. Follow the official website when information is missing or old. Opening hours, staffed hours and access outside staffed hours can differ. Hours not added yet means unknown, not closed. An Open now filter leaves out records without the hours needed to confirm a match.

## Facilities and accessibility

Recorded answers can confirm a feature, record its absence or leave it unknown. A missing answer is not No. The Atlas Accessibility layer distinguishes confirmed matches from records that do not confirm the selected features. Compare shows both; Data gaps helps find records needing answers. These are descriptions of recorded information, not a physical-access audit or a route guarantee.

## Record coverage and sources

Use the record’s source and change information to see where facts came from and when they were added or checked. Completeness describes how much of the record is filled in; it is not a library quality score. A recently updated record can still contain older source material. Imports retain public dataset credits and identifiers so the origin can be checked.

## Help improve the record

Suggest a correction for a fact, add a sourced answer to a missing field or share a useful photo with credit. Claim the library if you work there and want to maintain its information. Accepted edits improve the shared record. A discussion can help coordinate work, but posting in a conversation does not change the library’s facts.

## What Atlas can use

A mapped fixed-location library can support geographical analysis even when opening times or facility answers are missing. It cannot support an hours-based filter without recorded hours, or prove an accessibility match without the relevant answers. Country-level population context may be available before local population or Reach data. Check each panel’s exclusions and coverage notes rather than assuming every feature uses the same set of records.`
    ),
  ]
}
export const atlasExploringBody = [
  atlasRich(`The Atlas maps published libraries with usable locations. Search for a library or place, choose filters and add layers to explore the records in context. Records without locations can still be found in the directory.

## Search, Filters and Layers

Search finds names and places. Filters narrows library records by service, type, opening and recorded features. The service picker has its own country, region and name filters so a growing worldwide list stays manageable. Selecting a service focuses the map on its mapped branches and also supplies the service selection for Reach.

Choose every feature you require: the Services & accessibility filter requires all selected features. Counts describe matching recorded information. Missing answers do not prove a feature is absent. Open now, Staff now and Open at need suitable recorded hours. For mobile libraries, opening at a stop uses recorded timetables or live updates where available.

## Choose a layer

Library locations, mobile routes and stops, library density, opening-hours styling and permanent closures are public. A free account adds recorded Accessibility, event-feed density, Record completeness and Population density. Accessibility offers Matches, Compare and Data gaps; the last two help distinguish confirmed features from incomplete records.

Pro adds UK walking/cycling Reach, Library access with population comparisons, deprivation and households without a car where the required data is installed. Transit, founded-year styling and other unfinished layers remain marked Coming soon. Membership does not fill gaps in the source data.

## Use the data drawers

Active analysis layers have data drawers beside the map. Switch between them to inspect their settings, legend and available result. Minimising a drawer keeps its layer enabled. Turning a layer off removes it; Undo restores the selection. Reach can sit over one background area layer, while mutually exclusive background layers replace each other.

Reach settings stay visible. Choose the service or library and mode, then Calculate coverage. After changing inputs, calculate again. About opens the source explanation, and Downloads lists the supported formats. The map key explains the active colours and symbols; shading controls adjust visibility.

## Map, list and phone layouts

The bottom bar counts matching libraries in the current view and switches between Map and List. The list supports sorting and paging. Moving the map changes the visible selection; a service Reach reporting boundary stays tied to its service. On a phone, the workspace uses sheets with controls to resize or switch views. Keyboard users can navigate the controls and list without relying on map colours.`),
  related(),
]
export const atlasExportBody = [
  atlasRich(`Supporter, Pro and Team members can export a filtered Atlas library selection as CSV or GeoJSON. Individual library record downloads remain public. Exporting records and downloading a Reach analysis are separate actions.

## Export the library selection

Narrow the selection with filters or the map, switch to List and choose Export. CSV suits spreadsheets; GeoJSON retains map geometry. Supporter allows up to 500 libraries per download, Pro 10,000 and Team 50,000. If the selection exceeds the allowance, narrow it before exporting. These are per-download limits, not claims that the directory is complete.

## Retain source and scope

The export carries library identifiers, available visiting/contact details, location and source information. Keep the public source records, attribution, licences and retrieval dates with the data. Empty fields mean the record lacks that value; they should not be converted into a negative answer. A record without a usable location cannot supply a map point.

## Download Reach results

Use Downloads in the Reach drawer for coverage CSV, display GeoJSON or Analysis JSON. The analysis file includes the selected libraries, filters, source editions and unrounded results. CSV rows represent the generated travel times; cumulative counts overlap and must not be added together. Display polygons are simplified. They are useful for presentation, but the resident calculation uses full analytical geometry.

Share the source year, reporting geography, selected service and mode with a figure. Modelled proximity is not observed use, guaranteed admission or step-free access. Keep partial-data warnings with the exported result.`),
  related(),
]
export function atlasJournal(expanded = false) {
  return {
    title: "What the Atlas can tell us about library reach",
    slug: "atlas-library-reach-and-population",
    summary:
      "New population detail, walking and cycling coverage, clearer records and map controls—and why a service boundary matters when reading the result.",
    body: [
      atlasRich(`A cluster of library pins tells us where recorded branches are. It tells us much less about the people around them. The latest Atlas work adds population detail, modelled walking and cycling coverage, and context for reading those results. It also makes the controls easier to follow when several layers are on.

## Aberdeen: a useful figure, with a boundary attached

In an example shared on Reddit, the selected Aberdeen City Library Service calculation put 48.7% of its reporting area’s modelled residents within a 15-minute walk of one of 11 eligible recorded libraries. The denominator was about 227,564 residents from the 2020 population grid. That is a result for a particular service, population edition and routing model, not a survey of library users or a current accessibility standard.

A reader pointed out the library in Westhill, across the boundary in Aberdeenshire. That question matters. Service Reach includes the selected service’s recorded libraries; it does not automatically add every neighbouring operator. Before calling an apparent gap a library desert, check the neighbouring services, the directory’s coverage and the visiting information. A model can answer the question we give it while leaving an important part of the real journey outside the selection.`),
      {
        __component: "content.rich-text",
        body: [
          atlasLink(
            "The Aberdeen example and discussion",
            "https://www.reddit.com/r/dataisbeautiful/comments/1xezi9b/comment/19rnesjhbis2o/"
          ),
        ],
      },
      atlasRich(`## Follow roads and paths, then count residents once

Reach uses Valhalla and mapped OpenStreetMap roads and paths for walking and cycling catchments. For a service, it combines the catchments before counting residents, so overlapping branches do not count the same people twice. The UK profile uses GHS-POP R2023A’s 100 m grid for 2020, allocating boundary cells by the area intersected. The result retains its source year and exclusions.

Walking speed, mapped paths and model settings affect the answer. The model does not include elevation, opening hours, temporary changes or a step-free route guarantee. Ferries are excluded. A partial route or missing population cell stays a data gap; it cannot become evidence that nobody is served.

## Look beyond country averages

Population density now offers area detail and a population grid where those datasets are installed. A country average is useful context, but it can hide the difference between a city neighbourhood and a sparsely settled district. Keep the grid beneath Reach to see that distinction. Library filters do not change the underlying population surface.

Library access offers population comparisons and an area comparison view. UK deprivation and households-without-a-car layers add context where their editions are supported. Deprivation categories belong to each nation’s own index, so matching category numbers across England, Wales, Scotland and Northern Ireland do not create a common UK ranking. The car layer describes households in England and Wales, not people’s actual transport choices.

## Keep the selection and result together

The service picker can be narrowed by country, region and name. It focuses the map on the chosen service and supplies the reporting selection. Active data drawers keep layer settings and results accessible alongside the map. Reach’s calculation action stays visible, and source explanations and downloads have their own panels.

When all four times are available, Distinct bands places each resident in one interval; Within each time shows cumulative totals. Analysis JSON retains the selection and data editions, while CSV and display GeoJSON support spreadsheets and mapping. Keep the scope and source notes with any chart or screenshot.

## Bigger rural services need a bounded calculation

${reachAllowanceCopy(expanded)}

## More records, with the gaps visible

Library pages now handle sparse records alongside fuller ones, showing the information available and routes to improve what is missing. Missing hours mean unknown opening, not closed. Missing facility answers do not mean a facility is absent. Completeness describes the record, not the quality of the library.

The Canadian and Mexican imports broaden the directory. They do not install local routing graphs or population rasters by themselves. Country population context can work while a fine-grained Reach calculation remains unavailable. Extending those analytical packs is separate work; opening-time enrichment also needs better source feeds.

These tools can help a library service or council ask where recorded provision and settlement patterns align, and where more evidence is needed. They cannot decide on closures, demand or equitable access by themselves. The useful next step is often to check a boundary, confirm a missing record or ask what the model leaves out.`),
      related(),
    ],
  }
}

/** Existing translated guides must not keep describing shipped layers as planned. */
export const atlasLocalizedCorrections = {
  fr: {
    priceOld:
      "lorsque les outils Reach seront disponibles ; il n’est pas proposé avant leur disponibilité.",
    priceNew:
      "lorsque cette offre distincte sera introduite ; elle n’est pas proposée actuellement. La disponibilité de Reach ne modifie pas le prix d’un abonnement existant.",
    deliveredHeading: "Outils Atlas disponibles",
    delivered:
      "Pro comprend la portée à pied et à vélo au Royaume-Uni, Library access avec comparaison de deux territoires, ainsi que la défavorisation et les ménages sans voiture dans les zones couvertes. La densité de population est disponible avec un compte gratuit. Les transports, les analyses comparatives de services, les espaces d’analyse partagés et les rapports de fréquentation restent prévus. Importer des bibliothèques ne fournit pas automatiquement les données locales de population ou de routage.",
    exploring: `L’Atlas affiche les bibliothèques publiées dont la localisation est exploitable. Les fiches sans coordonnées restent consultables dans l’annuaire.

## Recherche, filtres et couches

Recherchez une bibliothèque ou un lieu. Les filtres limitent les fiches par service, type, horaires et caractéristiques renseignées. Le sélecteur de service se réduit par pays, région et nom ; le choix recentre la carte sur ses bibliothèques. Chaque caractéristique choisie doit être confirmée dans la fiche. Une réponse manquante ne signifie pas Non. Les filtres d’ouverture nécessitent des horaires connus.

Les localisations, itinéraires mobiles, densité de bibliothèques, ouvertures tardives et fermetures sont publics. Un compte gratuit ajoute Accessibilité, densité des flux d’événements, complétude des fiches et densité de population. Accessibilité distingue les correspondances confirmées des lacunes dans les fiches. Pro ajoute Reach, Library access et les couches de contexte disponibles. Les couches non achevées restent signalées À venir.

## Lire les résultats

Les couches d’analyse actives disposent de panneaux de données. Passez d’un panneau à l’autre pour consulter ses réglages, sa légende et son résultat. Réduire un panneau laisse la couche active ; la désactiver la retire. Reach peut se superposer à une couche de fond géographique.

Dans Reach, choisissez une bibliothèque ou un service, le mode de déplacement et la durée, puis lancez le calcul. Après une modification des entrées, recalculez. Le périmètre de population du service ne change pas quand vous déplacez la carte. À propos explique les sources ; Téléchargements présente les formats. Une couverture modélisée ne mesure ni les visites ni un accès sans obstacles garanti.

## Carte, liste et téléphone

La barre inférieure compte les bibliothèques correspondantes dans la vue et permet de passer à la liste, avec tri et pagination. Sur téléphone, les commandes et les données utilisent des panneaux redimensionnables. Les contrôles et la liste sont utilisables au clavier.`,
    exporting: `Les membres Supporter, Pro et Team peuvent exporter une sélection de bibliothèques de l’Atlas en CSV ou GeoJSON. Le téléchargement d’une fiche individuelle reste public.

## Exporter la sélection

Appliquez les filtres ou déplacez la carte, ouvrez la liste et choisissez Exporter. Le CSV convient aux tableaux ; le GeoJSON conserve les points cartographiques. La limite par téléchargement est de 500 bibliothèques pour Supporter, 10 000 pour Pro et 50 000 pour Team. Réduisez une sélection qui dépasse cette limite.

## Garder les sources

Conservez les identifiants, références publiques, licences, crédits et dates de collecte. Une valeur vide indique une information inconnue, pas une réponse négative. Une fiche sans localisation exploitable ne peut pas fournir de point cartographique.

## Télécharger une analyse Reach

Le panneau Reach propose CSV, GeoJSON d’affichage et JSON d’analyse. Ce dernier conserve la sélection, les filtres, les éditions des sources et les valeurs non arrondies. Les totaux cumulatifs se recoupent : ne les additionnez pas. Les polygones affichés sont simplifiés ; le calcul utilise les contours analytiques complets. Publiez l’année, le territoire, le service et le mode avec vos résultats. Les avertissements de données partielles doivent accompagner le fichier.`,
  },
  cs: {
    priceOld: "po zpřístupnění nástrojů Reach; předtím se nenabízí.",
    priceNew:
      "po samostatném zavedení této nabídky; nyní se nenabízí. Zpřístupnění Reach nemění cenu stávajícího předplatného.",
    deliveredHeading: "Dostupné nástroje Atlasu",
    delivered:
      "Pro zahrnuje pěší a cyklistický Reach ve Spojeném království, Library access s porovnáním dvou oblastí a vrstvy deprivace a domácností bez auta tam, kde jsou dostupná potřebná data. Hustota obyvatelstva je dostupná s bezplatným účtem. Veřejná doprava, porovnávání knihovních sítí, sdílené analytické prostory a návštěvnost zůstávají plánované. Import knihoven sám neposkytuje místní populační rastr ani směrovací graf.",
    exploring: `Atlas zobrazuje zveřejněné knihovny s použitelnou polohou. Záznamy bez souřadnic lze stále najít v adresáři.

## Hledání, filtry a vrstvy

Vyhledejte knihovnu nebo místo. Filtry omezují záznamy podle sítě, typu, otevírací doby a zaznamenaných vlastností. Výběr sítě lze zúžit podle země, regionu a názvu; výběr zaměří mapu na její knihovny. Každá zvolená vlastnost musí být v záznamu potvrzená. Chybějící odpověď neznamená Ne. Filtry otevření vyžadují známou otevírací dobu.

Polohy, mobilní trasy, hustota knihoven, večerní otevření a trvalá uzavření jsou veřejné. Bezplatný účet přidává přístupnost, hustotu událostí, úplnost záznamů a hustotu obyvatelstva. Vrstva přístupnosti rozlišuje potvrzené shody od chybějících údajů. Pro přidává Reach, Library access a dostupné kontextové vrstvy. Nedokončené vrstvy jsou označené Připravujeme.

## Čtení výsledků

Aktivní analytické vrstvy mají datové panely. Přepínáním zobrazíte nastavení, legendu a výsledek příslušné vrstvy. Minimalizace panelu vrstvu nevypne; vypnutí vrstvy ji odstraní. Reach lze zobrazit nad jednou plošnou podkladovou vrstvou.

V Reach zvolte knihovnu nebo síť, způsob dopravy a čas a spusťte výpočet. Po změně vstupů znovu vypočítejte pokrytí. Posunutí mapy nemění populační oblast sítě. Panel O datech vysvětluje zdroje a Stahování nabízí formáty. Modelovaný dosah neměří návštěvy ani nezaručuje bezbariérovou cestu.

## Mapa, seznam a telefon

Dolní lišta počítá odpovídající knihovny v aktuálním výřezu a přepíná mapu a seznam s řazením a stránkováním. Na telefonu se ovládání a data otevírají v upravitelných panelech. Ovládací prvky a seznam lze používat klávesnicí.`,
    exporting: `Členové Supporter, Pro a Team mohou vybranou sadu knihoven z Atlasu exportovat do CSV nebo GeoJSON. Stažení jednotlivého záznamu zůstává veřejné.

## Export výběru

Použijte filtry nebo posuňte mapu, otevřete seznam a zvolte Export. CSV je vhodné pro tabulky, GeoJSON zachovává mapové body. Limit na stažení je 500 knihoven pro Supporter, 10 000 pro Pro a 50 000 pro Team. Větší výběr nejprve zúžte.

## Zachování zdrojů

Ponechte identifikátory, veřejné odkazy, licence, uvedení zdrojů a data získání. Prázdná hodnota znamená neznámý údaj, nikoli zápornou odpověď. Záznam bez použitelné polohy nemůže poskytnout mapový bod.

## Stažení analýzy Reach

Panel Reach nabízí CSV, zobrazovací GeoJSON a analytický JSON. Analytický soubor zachovává výběr, filtry, verze zdrojů a nezaokrouhlené hodnoty. Kumulativní součty se překrývají: nesčítejte je. Zobrazované polygony jsou zjednodušené; výpočet používá úplnou analytickou geometrii. Uveďte rok, oblast, síť a způsob dopravy. U částečných výsledků zachovejte upozornění na chybějící data.`,
  },
}
