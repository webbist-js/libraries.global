/** Reader-facing corrections for the dashboard release. No pricing or role rules change. */
const paragraph = (text) => ({
  type: "paragraph",
  children: [{ type: "text", text }],
})
const heading = (text) => ({
  type: "heading",
  level: 2,
  children: [{ type: "text", text }],
})
const textOf = (node) =>
  typeof node?.text === "string"
    ? node.text
    : (node?.children ?? []).map(textOf).join("")

export const dashboardCopy = {
  en: {
    navigation:
      "On a computer, use the menu on the left to move between sections. On a phone, the main shortcuts sit at the bottom; the menu button opens the other destinations. Search and language selection are in the page's top bar. Plans and pricing is near the top of Navigation.",
    profile:
      "Select your photo to open your profile drawer over the current page. Its tabs contain your contributions, following, recognition, notifications and settings. Use Public profile to see the separate page other people can visit. Closing the drawer returns you to the page you were reading.",
    notifications:
      "Open your profile drawer and choose Notifications. A dot on your photo marks unread updates. Read an update or choose Mark all read to clear the counter.",
    staff:
      "Once your library claim is approved, or a Team organiser assigns you to a library, open Staff in the left menu. On a phone, find Staff in Navigation. You can also use the Staff edge tab or Alt+S to open the staff drawer over your current page. The full Staff area and the drawer use the same library selection. Team access alone does not grant permission to edit every library.",
    moderationBefore: "Moderation then appears in your account menu.",
    moderationAfter:
      "Moderation then appears in the left menu, or in Navigation on a phone. It opens the separate Moderation workspace.",
    sections:
      "On a computer, the left sidebar links to each section. On a phone, use the section chips or open Section navigation. The back link names the place it returns to.",
    sectionHeading: "The sections",
    items: [
      "Opening hours: the recorded weekly schedule, local time and the date it was checked. Notices can change the usual hours.",
      "Plan your visit: directions, official links, phone and email, followed by the address, transport notes and admission information when recorded.",
      "Accessibility and facilities: recorded answers and questions still open. A missing answer does not mean a facility is unavailable.",
      "Services and About and collections: what the library offers, its history and collections, where recorded.",
      "Sources and reuse: source credits, licences, record checks and change history. Expand a source to see its identifiers and the fields it supports.",
      "Community: stories, conversations and ways to improve this record. Some sections appear only when there is information to show.",
    ],
    writerHeading: "Sources and data updates",
    writer:
      "For a Journal article, add sources in the editor's Sources fields. Give each source a clear title. Add a public URL when there is one, and its publisher and access date when useful. These references appear beside the article. External links in the story are not automatically treated as citations. Entries added is for Index data updates; leave it empty for contributed stories.",
    networkHeading: "Browse connected libraries",
    network:
      "Choose Networks below Libraries to explore public library services, university systems and consortia. Search by name, kind and country. A network page searches all its published member libraries by library or town, country, region, type and recorded facilities. Choose several facilities to require all of them. The map shows the current result page; Open in Atlas shows the whole network. Network membership does not give staff access or guarantee identical borrowing rules at each branch.",
  },
  fr: {
    navigation:
      "Sur ordinateur, utilisez le menu de gauche pour changer de rubrique. Sur téléphone, les raccourcis principaux sont en bas ; le bouton de menu ouvre les autres destinations. La recherche et le choix de langue sont dans la barre en haut de la page. Les offres et tarifs sont mis en avant dans Navigation.",
    profile:
      "Sélectionnez votre photo pour ouvrir le panneau de profil au-dessus de la page actuelle. Ses onglets regroupent vos contributions, abonnements, distinctions, notifications et paramètres. Profil public ouvre la page que les autres peuvent consulter. Fermez le panneau pour retrouver votre lecture.",
    notifications:
      "Ouvrez votre panneau de profil, puis Notifications. Un point sur votre photo signale les nouveautés non lues. Lisez une notification ou choisissez Tout marquer comme lu pour effacer le compteur.",
    staff:
      "Une fois votre demande de rattachement approuvée, ou après votre affectation par un responsable d’équipe, ouvrez Personnel dans le menu de gauche. Sur téléphone, cette entrée se trouve dans Navigation. L’onglet latéral Personnel et Alt+S ouvrent aussi le panneau du personnel au-dessus de la page actuelle. Ce panneau et l’espace complet utilisent la même bibliothèque sélectionnée. L’accès à une équipe ne donne pas à lui seul le droit de modifier toutes les bibliothèques.",
    moderationBefore:
      "L'option de modération s'affichera alors dans le menu de votre compte.",
    moderationAfter:
      "La modération apparaît alors dans le menu de gauche, ou dans Navigation sur téléphone. Elle ouvre un espace de modération distinct.",
    sections:
      "Sur ordinateur, le panneau de gauche donne accès aux sections. Sur téléphone, utilisez les raccourcis de section ou ouvrez Navigation de section. Le lien de retour indique le lieu auquel il mène.",
    sectionHeading: "Les sections",
    items: [
      "Horaires : le programme hebdomadaire enregistré, l’heure locale et la date de vérification. Des avis peuvent modifier les horaires habituels.",
      "Préparer votre visite : itinéraire, liens officiels, téléphone et e-mail, puis adresse, transports et conditions d’admission lorsqu’ils sont renseignés.",
      "Accessibilité et équipements : les réponses enregistrées et les questions encore ouvertes. Une réponse manquante ne signifie pas qu’un équipement est absent.",
      "Services, présentation et collections : les activités, l’histoire et les fonds de la bibliothèque, lorsqu’ils sont documentés.",
      "Sources et réutilisation : crédits, licences, vérifications et historique. Dépliez une source pour voir ses identifiants et les champs qu’elle documente.",
      "Communauté : récits, discussions et moyens d’améliorer la notice. Certaines sections n’apparaissent que si elles contiennent des informations.",
    ],
    writerHeading: "Sources et mises à jour des données",
    writer:
      "Pour un article du Journal, ajoutez les références dans les champs Sources de l’éditeur. Donnez un titre clair à chaque source. Ajoutez une URL publique si elle existe, ainsi que l’éditeur et la date de consultation si nécessaire. Ces références figurent à côté de l’article. Les liens externes du texte ne deviennent pas automatiquement des citations. Le nombre d’entrées ajoutées concerne les bilans de données de l’Index ; laissez ce champ vide pour les récits contribués.",
    networkHeading: "Explorer les bibliothèques d’un réseau",
    network:
      "Choisissez Réseaux sous Bibliothèques pour parcourir les services publics, systèmes universitaires et consortiums. Recherchez par nom, type et pays. La page d’un réseau recherche dans toutes ses bibliothèques publiées par nom ou ville, pays, région, type et équipements enregistrés. Plusieurs équipements sélectionnés doivent tous être présents. La carte montre la page de résultats actuelle ; l’Atlas permet de voir tout le réseau. L’appartenance à un réseau ne donne pas d’accès au personnel et ne garantit pas les mêmes règles de prêt dans chaque établissement.",
  },
  cs: {
    navigation:
      "Na počítači přecházejte mezi sekcemi pomocí levé nabídky. Na telefonu jsou hlavní zkratky dole; tlačítko nabídky otevře další cíle. Vyhledávání a volba jazyka jsou v horní liště stránky. Plány a ceny najdete nahoře v Navigaci.",
    profile:
      "Výběrem své fotografie otevřete panel profilu nad aktuální stránkou. Jeho karty obsahují příspěvky, sledování, ocenění, oznámení a nastavení. Veřejný profil otevře samostatnou stránku, kterou mohou navštívit ostatní. Zavřením panelu se vrátíte k původní stránce.",
    notifications:
      "Otevřete panel svého profilu a zvolte Oznámení. Tečka na fotografii označuje nepřečtené novinky. Přečtěte si oznámení nebo zvolte Označit vše jako přečtené a počítadlo se vynuluje.",
    staff:
      "Po schválení přiřazení ke knihovně nebo po přidělení knihovny organizátorem týmu otevřete Personál v levé nabídce. Na telefonu je tato volba v Navigaci. Boční záložka Personál a Alt+S také otevřou panel personálu nad aktuální stránkou. Panel i celá pracovní sekce používají stejnou vybranou knihovnu. Samotný přístup k týmu neopravňuje k úpravám všech knihoven.",
    moderationBefore:
      "V nabídce vašeho účtu se poté objeví možnost moderování.",
    moderationAfter:
      "Moderování se poté objeví v levé nabídce nebo v Navigaci na telefonu. Otevře samostatnou sekci pro moderování.",
    sections:
      "Na počítači odkazuje na jednotlivé sekce levý panel. Na telefonu použijte zkratky sekcí nebo otevřete Navigaci sekce. Odkaz zpět uvádí místo, kam se vrátíte.",
    sectionHeading: "Jednotlivé sekce",
    items: [
      "Otevírací doba: zaznamenaný týdenní rozvrh, místní čas a datum kontroly. Oznámení mohou běžnou otevírací dobu měnit.",
      "Naplánujte návštěvu: trasa, oficiální odkazy, telefon a e-mail, dále adresa, doprava a podmínky vstupu, pokud jsou uvedeny.",
      "Přístupnost a vybavení: zaznamenané odpovědi a dosud nezodpovězené otázky. Chybějící odpověď neznamená, že vybavení není dostupné.",
      "Služby, informace a fondy: nabídka knihovny, její historie a sbírky, pokud jsou doloženy.",
      "Zdroje a další využití: uvedení zdrojů, licence, kontroly záznamu a historie změn. Rozbalením zdroje zobrazíte identifikátory a doložená pole.",
      "Komunita: příběhy, diskuze a možnosti zlepšení záznamu. Některé sekce se zobrazují jen tehdy, když obsahují informace.",
    ],
    writerHeading: "Zdroje a aktualizace dat",
    writer:
      "U článku v Journalu přidejte citace do polí Zdroje v editoru. U každého zdroje uveďte srozumitelný název. Pokud existuje veřejná URL, přidejte ji; podle potřeby doplňte vydavatele a datum přístupu. Zdroje se zobrazí vedle článku. Externí odkazy v textu se automaticky nepovažují za citace. Počet přidaných záznamů patří k datovým aktualizacím Indexu; u přispěvatelských příběhů ho nevyplňujte.",
    networkHeading: "Procházení propojených knihoven",
    network:
      "Volbou Sítě pod Knihovnami procházejte veřejné knihovní služby, univerzitní systémy a konsorcia. Hledejte podle názvu, druhu a země. Stránka sítě prohledává všechny její publikované knihovny podle názvu či města, země, regionu, typu a zaznamenaného vybavení. Při výběru více položek vybavení musí být splněny všechny. Mapa ukazuje aktuální stránku výsledků; Atlas zobrazí celou síť. Členství v síti nedává zaměstnanecká oprávnění ani nezaručuje stejná pravidla výpůjček ve všech pobočkách.",
  },
}

function mapTree(value, fn) {
  if (Array.isArray(value)) return value.map((child) => mapTree(child, fn))
  if (!value || typeof value !== "object") return value
  const mapped = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === "url" && typeof child === "string"
        ? child.replaceAll(
            /\/contribute\/moderation(?=[/?#]|$)/g,
            "/moderation"
          )
        : mapTree(child, fn),
    ])
  )

  return fn(mapped)
}

export function dashboardGuideBody(doc, locale) {
  const copy = dashboardCopy[locale]
  if (!copy) return doc.body ?? []
  let body = mapTree(structuredClone(doc.body ?? []), (node) => {
    if (node.type === "text")
      node.text = node.text?.replace(
        copy.moderationBefore,
        copy.moderationAfter
      )
    if (
      node.type === "paragraph" &&
      doc.slug === "your-account-and-profile" &&
      /Open Notifications from your profile menu|Accédez aux notifications depuis le menu de votre profil|Oznámení otevřete z nabídky profilu/.test(
        textOf(node)
      )
    )
      return paragraph(copy.notifications)

    return node
  })
  const rich = body.find((block) => block.__component === "content.rich-text")
  if (!rich?.body) return body
  if (doc.slug === "staff-area") rich.body[0] = paragraph(copy.staff)
  if (doc.slug === "reading-a-library-page") {
    const index = rich.body.findIndex(
      (block) =>
        block.type === "heading" && textOf(block) === copy.sectionHeading
    )
    if (
      index !== -1 &&
      rich.body[index + 1]?.type === "paragraph" &&
      rich.body[index + 2]?.type === "list"
    ) {
      rich.body[index + 1] = paragraph(copy.sections)
      rich.body[index + 2] = {
        type: "list",
        format: "unordered",
        children: copy.items.map((text) => ({
          type: "list-item",
          children: [{ type: "text", text }],
        })),
      }
    }
  }
  const add = (title, text) => {
    if (!rich.body.some((block) => textOf(block) === text))
      rich.body.push(heading(title), paragraph(text))
  }
  if (doc.slug === "about-libraries-global")
    add(
      {
        en: "Getting around",
        fr: "Se déplacer sur le site",
        cs: "Pohyb po webu",
      }[locale],
      copy.navigation
    )
  if (doc.slug === "your-account-and-profile")
    add(
      {
        en: "Opening your own profile",
        fr: "Ouvrir votre propre profil",
        cs: "Otevření vlastního profilu",
      }[locale],
      copy.profile
    )
  if (doc.slug === "finding-a-library") add(copy.networkHeading, copy.network)
  if (doc.slug === "writing-and-editing-articles")
    add(copy.writerHeading, copy.writer)

  return body
}
