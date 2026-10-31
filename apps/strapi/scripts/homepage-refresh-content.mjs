import { HOMEPAGE_DEFAULTS } from "../../ui/src/components/home/homepage.content.ts"

const fields = [
  "heroEyebrow",
  "heroTitle",
  "heroText",
  "featuredIntro",
  "atlasBand",
  "communityBand",
  "libraryBand",
  "libraryTools",
  "trustItems",
  "finalCta",
  "knowledgeLinks",
]
const english = Object.fromEntries(
  fields.map((key) => [key, structuredClone(HOMEPAGE_DEFAULTS[key])])
)
english.finalCta.text =
  "An open record, built together. Browsing and searching are free. Membership supports the servers, review tools and analysis that keep the record independent."

const translated = {
  fr: {
    heroEyebrow: "Données ouvertes · Code source ouvert · Utilisation gratuite",
    heroTitle: "Toutes les bibliothèques, *une seule carte.*",
    heroText:
      "Trouvez une bibliothèque près de chez vous, ses horaires et ses services, et aidez à compléter sa fiche. Consultation gratuite, sans compte.",
    featuredIntro: {
      title: "Des bibliothèques *à découvrir*",
      text: "Des institutions de référence, choisies pour leur importance nationale, historique ou culturelle.",
    },
    atlasBand: {
      ...english.atlasBand,
      title: "Voyez comment les territoires *sont desservis.*",
      text: "Explorez les bibliothèques sur une carte mondiale et comparez leur couverture à la population. Au Royaume-Uni, choisissez une durée de trajet à pied ou à vélo pour connaître le nombre de personnes vivant à portée d’une bibliothèque ou d’un service de bibliothèques.",
      primaryLabel: "Ouvrir l’Atlas",
      secondaryLabel: "Comprendre l’Atlas",
    },
    communityBand: {
      ...english.communityBand,
      title: "Deux minutes pour *compléter une fiche.*",
      text: "Pas besoin d’être bibliothécaire. Partagez ce que vous savez : chaque modification acceptée vous est attribuée.",
      primaryLabel: "Contribuer",
      secondaryLabel: "Ajouter une bibliothèque",
    },
    libraryBand: {
      ...english.libraryBand,
      title: "Vous travaillez en bibliothèque ? *Cette fiche est la vôtre.*",
      text: "Revendiquez votre bibliothèque et actualisez ses horaires, services, informations d’accessibilité, événements et arrêts itinérants. Une seule fiche alimente les différents outils.",
      primaryLabel: "Revendiquer votre bibliothèque",
      secondaryLabel: "Découvrir les équipes",
    },
    libraryTools: [
      [
        "Actualiser les horaires, services et informations d’accessibilité",
        "Gratuit",
      ],
      ["Publier des avis et connecter un calendrier d’événements", "Gratuit"],
      ["Gérer les circuits et arrêts des bibliothèques mobiles", "Gratuit"],
      ["Un espace d’équipe pour votre service ou réseau", "Team"],
      ["Des outils de recherche et de comparaison intégrables", "Team"],
      ["Connecter votre application à l’API", "Option API"],
    ].map(([title, text], i) => ({ ...english.libraryTools[i], title, text })),
    trustItems: [
      [
        "Sources",
        "Sites des bibliothèques, jeux de données ouverts et connaissances locales. Les fiches conservent leurs sources pour permettre de vérifier les informations.",
      ],
      [
        "Relecture",
        "Les propositions sont vérifiées avant publication. Le personnel vérifié peut actualiser les fiches de ses bibliothèques, avec un historique des modifications.",
      ],
      [
        "Lacunes",
        "La couverture est inégale. L’absence d’une fiche indique une lacune du répertoire, pas nécessairement une absence de bibliothèque.",
      ],
      [
        "Réutilisation",
        "Consultez le code source, les licences et les mentions d’attribution, ou intégrez les fiches publiées à vos propres outils.",
      ],
    ].map(([title, text], i) => ({ ...english.trustItems[i], title, text })),
    finalCta: {
      ...english.finalCta,
      title: "Vous connaissez une bibliothèque ? *Ajoutez-la à la carte.*",
      text: "Un répertoire ouvert, construit ensemble. La consultation et la recherche sont gratuites. Les adhésions financent les serveurs, les outils de relecture et les analyses.",
      primaryLabel: "Contribuer",
      secondaryLabel: "Soutenir le projet",
    },
    knowledgeLinks: [
      "Premiers pas : trouver et suivre des bibliothèques",
      "Lire la fiche d’une bibliothèque",
      "Ajouter une bibliothèque manquante",
      "Contribuer et comprendre la relecture",
      "Gérer la fiche de votre bibliothèque",
      "Utiliser l’Atlas et lire ses couches",
      "Comprendre nos chiffres et la couverture",
      "Réutiliser les données : licences et API",
    ].map((title, i) => ({ ...english.knowledgeLinks[i], title })),
  },
  cs: {
    heroEyebrow: "Otevřená data · Otevřený kód · Používání zdarma",
    heroTitle: "Všechny knihovny, *jedna mapa.*",
    heroText:
      "Najděte knihovnu ve svém okolí, její otevírací dobu a služby. Pomozte doplnit chybějící údaje. Prohlížení je zdarma a bez účtu.",
    featuredIntro: {
      title: "Knihovny, *které stojí za poznání*",
      text: "Významné instituce vybrané pro svůj národní, historický nebo kulturní význam.",
    },
    atlasBand: {
      ...english.atlasBand,
      title: "Jak knihovny *slouží svému okolí.*",
      text: "Prozkoumejte knihovny na mapě světa a porovnejte jejich dostupnost s počtem obyvatel. Ve Spojeném království zvolte čas chůze nebo jízdy na kole a zjistěte, kolik lidí žije v dosahu knihovny či knihovní služby.",
      primaryLabel: "Otevřít Atlas",
      secondaryLabel: "Jak číst Atlas",
    },
    communityBand: {
      ...english.communityBand,
      title: "Dvě minuty mohou *doplnit záznam.*",
      text: "Nemusíte být knihovník. Podělte se o své znalosti a získejte uznání za každou přijatou změnu.",
      primaryLabel: "Začít přispívat",
      secondaryLabel: "Přidat knihovnu",
    },
    libraryBand: {
      ...english.libraryBand,
      title: "Pracujete v knihovně? *Tento záznam je váš.*",
      text: "Přihlaste se ke správě knihovny a aktualizujte její otevírací dobu, služby, přístupnost, akce a mobilní zastávky. Jediný záznam se používá v různých nástrojích.",
      primaryLabel: "Přihlásit se ke správě knihovny",
      secondaryLabel: "Prozkoumat týmy",
    },
    libraryTools: [
      ["Správa otevírací doby, služeb a přístupnosti", "Zdarma"],
      ["Zveřejňování oznámení a připojení kalendáře akcí", "Zdarma"],
      ["Správa tras a zastávek mobilních knihoven", "Zdarma"],
      ["Týmový prostor pro službu nebo síť", "Team"],
      ["Vložitelné vyhledávače knihoven a srovnávací nástroje", "Team"],
      ["Připojení vaší aplikace k API", "Doplněk API"],
    ].map(([title, text], i) => ({ ...english.libraryTools[i], title, text })),
    trustItems: [
      [
        "Zdroje",
        "Weby knihoven, otevřená data a místní znalosti. Záznamy uchovávají zdroje, abyste si mohli informace ověřit.",
      ],
      [
        "Kontrola",
        "Návrhy komunity se před zveřejněním kontrolují. Ověření zaměstnanci mohou spravovat své knihovny se zaznamenanou historií změn.",
      ],
      [
        "Mezery",
        "Pokrytí je nerovnoměrné. Chybějící záznam znamená mezeru v přehledu, nikoli nutně místo bez knihovny.",
      ],
      [
        "Další využití",
        "Prohlédněte si zdrojový kód, licence a požadavky na uvedení zdrojů nebo použijte zveřejněné záznamy ve vlastních nástrojích.",
      ],
    ].map(([title, text], i) => ({ ...english.trustItems[i], title, text })),
    finalCta: {
      ...english.finalCta,
      title: "Znáte knihovnu? *Přidejte ji na mapu.*",
      text: "Otevřený přehled tvoříme společně. Prohlížení a vyhledávání je zdarma. Členství podporuje servery, nástroje pro kontrolu a analýzy.",
      primaryLabel: "Přispět",
      secondaryLabel: "Podpořit projekt",
    },
    knowledgeLinks: [
      "Začínáme: hledání a sledování knihoven",
      "Jak číst stránku knihovny",
      "Přidání chybějící knihovny",
      "Přispívání a kontrola návrhů",
      "Správa záznamu vaší knihovny",
      "Používání Atlasu a čtení jeho vrstev",
      "Jak počítáme knihovny a pokrytí",
      "Další využití dat: licence a API",
    ].map((title, i) => ({ ...english.knowledgeLinks[i], title })),
  },
}

export function homepageRefreshContent(locale) {
  const { libraryBand, libraryTools, trustItems, ...copy } = structuredClone(
    locale === "en" ? english : translated[locale]
  )
  const plain = (value) =>
    typeof value === "string"
      ? value.replaceAll("*", "")
      : Array.isArray(value)
        ? value.map(plain)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value).map(([key, child]) => [key, plain(child)])
            )
          : value
  const cleanCopy = Object.fromEntries(
    Object.entries(copy).map(([key, value]) => [
      key,
      ["heroTitle", "atlasBand", "communityBand", "finalCta"].includes(key)
        ? value
        : plain(value),
    ])
  )

  return {
    ...cleanCopy,
    journeysIntro: null,
    coverageIntro: null,
    eventsIntro: null,
    knowledgeBand: null,
    finalBenefits: [],
    openIntro: null,
    contentTitle: plain(libraryBand.title),
    contentText: libraryBand.text,
    contentCtaLabel: libraryBand.primaryLabel,
    contentCtaHref: libraryBand.primaryHref,
    journeys: libraryTools.map((tool) => ({
      tone: "steward",
      title: tool.title,
      text: tool.text,
      ctaHref: tool.href,
    })),
    openLinks: plain(trustItems),
    journalIntro: {
      title: { en: "From the Journal", fr: "Le Journal", cs: "Z časopisu" }[
        locale
      ],
      text: null,
    },
  }
}
