import assert from "node:assert/strict"

const text = (node) =>
  Array.isArray(node)
    ? node.map(text).join("")
    : (node?.text ?? text(node?.children ?? []))
const paragraph = (value) => ({
  type: "paragraph",
  children: [{ type: "text", text: value }],
})
const heading = (value) => ({ ...paragraph(value), type: "heading", level: 2 })
const list = (values) => ({
  type: "list",
  format: "unordered",
  children: values.map((value) => ({ ...paragraph(value), type: "list-item" })),
})
const link = (label, url) => ({
  type: "paragraph",
  children: [{ type: "link", url, children: [{ type: "text", text: label }] }],
})

const copy = {
  en: {
    proTitle: "Earn Pro through contributions",
    pro: "Earned Pro is available while your current points total is at least 5,000 and a qualifying contribution has been accepted within the last 30 days. Each qualifying acceptance resets the expiry to 30 days from that acceptance, regardless of how many points it earns. Sending a draft or waiting for review does not reset it.",
    expiry:
      "After 30 days without a qualifying acceptance, earned Pro expires. A later qualifying acceptance restores it if you still have at least 5,000 points. Falling below 5,000 also ends eligibility. Your points and milestone badges are not removed just because earned Pro expires. At 50 points per approved new library, 100 new libraries would earn 5,000 points before any other awards.",
    excluded:
      "Accepted library contributions, Knowledge and Journal work, drive tasks and proposals, discussions, event-feed connections and checklist-option suggestions qualify. Automatic daily-streak and drive-completion bonuses, manual point adjustments, votes, reactions, pending submissions and direct staff publishes do not reset the clock. Requests for new places and role applications do not earn contribution points.",
    independent:
      "Earned Pro is separate from paid membership, verified-staff access, grants and active Team seats. Those routes keep their own eligibility rules. Earning Pro does not cancel an existing paid subscription or its renewal; manage renewal separately in Membership & billing. A tier or a permanent badge alone does not grant permanent Pro.",
    pointsLink: "Points, streaks and tiers",
    newRewards: [
      "An accepted discussion thread: 2 points",
      "An accepted discussion reply or edit: 1 point",
      "An accepted new or replacement event-feed connection: 5 points",
      "An accepted checklist-option suggestion: 5 points for the original proposer",
      "An accepted drive task: 2 extra points",
      "An accepted drive proposal: 10 points",
      "A drive reaching its goal: 25 bonus points if you contributed at least 5 accepted tasks",
    ],
    rewardTitle: "Points for accepted contributions",
    discussion:
      "An accepted new discussion thread earns 2 points; an accepted reply or edit earns 1. Points go to the author of the accepted contribution, once per accepted revision. Each qualifying acceptance renews the 30-day earned-Pro activity window. Drafts, rejected messages, reactions and following do not earn these points.",
    option:
      "When the board accepts a new checklist option, its original proposer earns 5 points and the acceptance renews their 30-day earned-Pro activity window. Clarifications and merged proposals retain the original proposer. Voting, commenting on the proposal or waiting for a decision does not earn this option award; accepted discussion contributions have their own rewards.",
    feed: "An accepted new or replacement event-feed connection earns its submitter 5 points and renews their 30-day earned-Pro activity window. Testing, pausing, resuming or disconnecting a feed does not earn this award. A connection still awaiting review does not count.",
    contribute:
      "Accepted contributions can earn points, including reviewed discussions, event-feed connections and checklist-option suggestions. Earned Pro requires at least 5,000 current points and a qualifying acceptance within the last 30 days. See the points guide for amounts, exclusions and expiry rules.",
    badgeNote:
      "Badges recognise milestones and remain on your profile. Earned Pro has a separate 5,000-point threshold and a renewable 30-day activity window; a badge is not permanent Pro access.",
    editsTitle: "Edits and corrections",
    edits:
      "These count accepted minor and major library-record edits and accepted corrections. You do not need to have claimed the library. Direct staff publishes do not earn these awards.",
    copyEditor:
      "Copy Editor: 10 accepted edits or translations of Journal articles",
    verificationTitle: "Verification",
    verification:
      "These count accepted checks of a library's opening hours or operational status.",
    badgesTitle: "Contribution and conversation milestones",
    badges: [
      "Active Contributor: 5,000 points",
      "Conversation Starter: your first accepted discussion thread",
      "Helpful Voice: 10 accepted discussion replies",
    ],
    renounceTitle: "Renouncing a library claim",
    renounce:
      "You can renounce your own library claim from the Staff area or the Contribute hub, even if you are the library's last Owner. Confirming removes your staff access for that library and ends any live session you started. Your accepted public contributions remain. You can apply again later. Renouncing a library claim does not cancel a paid membership or Team subscription, and it does not replace the handover required of a Team's last Organiser.",
    owner:
      "Another person cannot remove or demote a library's last Owner, but that Owner can voluntarily leave.",
    export:
      "You can download a single published library as JSON or CSV from its page. Atlas CSV/GeoJSON exports allow up to 500 libraries per download for Supporter, 10,000 for Pro and 50,000 for active Team seats. Exports include available source, publisher, licence and attribution details. Whole-dataset nightly downloads and a general public API are separate plans.",
    creditTitle: "Community source credits",
    credit:
      "A published library accepted from a community submission credits its contributor in Source credits, including when an editor publishes the accepted record later. A contributor whose profile and activity are public is linked by username; otherwise the credit says Community member. Public source references are separate from that credit. Private reviewer evidence is never included in the public source list.",
  },
  fr: {
    proTitle: "Obtenir Pro grâce aux contributions",
    pro: "L'accès Pro obtenu par les contributions est actif si votre solde atteint au moins 5 000 points et si une contribution admissible a été acceptée au cours des 30 derniers jours. Chaque acceptation admissible reporte l'expiration à 30 jours après cette acceptation, quel que soit le nombre de points attribués. Envoyer un brouillon ou attendre une vérification ne renouvelle pas ce délai.",
    expiry:
      "Après 30 jours sans acceptation admissible, cet accès Pro expire. Une nouvelle acceptation le rétablit si vous avez toujours au moins 5 000 points. Un solde inférieur à 5 000 met aussi fin à l'éligibilité. L'expiration ne supprime ni vos points ni vos badges. À 50 points par nouvelle bibliothèque approuvée, 100 bibliothèques rapporteraient 5 000 points, sans compter les autres récompenses.",
    excluded:
      "Les contributions acceptées aux bibliothèques, à Knowledge et au Journal, les tâches et propositions de campagnes, les discussions, les connexions de flux d'événements et les suggestions d'options admissibles renouvellent ce délai. Les bonus automatiques de série ou de fin de campagne, les ajustements manuels, les votes, les réactions, les demandes en attente et les publications directes du personnel ne le renouvellent pas. Les demandes de nouveaux lieux et de rôles ne rapportent pas de points.",
    independent:
      "Cet accès est indépendant d'un abonnement payant, du statut de personnel vérifié, d'un accès accordé ou d'une place Team active, qui gardent leurs propres règles. Obtenir Pro par les contributions n'annule ni un abonnement payant existant ni son renouvellement : gérez celui-ci dans Adhésion et facturation. Un rang ou un badge permanent ne donne pas un accès Pro permanent.",
    pointsLink: "Points, séries et niveaux",
    newRewards: [
      "Nouveau fil de discussion accepté : 2 points",
      "Réponse ou modification de discussion acceptée : 1 point",
      "Connexion nouvelle ou remplacée d'un flux d'événements acceptée : 5 points",
      "Suggestion d'option acceptée : 5 points pour la personne à l'origine de la proposition",
      "Tâche de campagne acceptée : 2 points supplémentaires",
      "Proposition de campagne acceptée : 10 points",
      "Campagne ayant atteint son objectif : bonus de 25 points si vous avez contribué à au moins 5 tâches acceptées",
    ],
    rewardTitle: "Points pour les contributions acceptées",
    discussion:
      "Un nouveau fil accepté rapporte 2 points ; une réponse ou une modification acceptée rapporte 1 point. Les points reviennent à l'auteur de la contribution, une seule fois par version acceptée. Chaque acceptation admissible renouvelle le délai de 30 jours de Pro. Les brouillons, messages refusés, réactions et abonnements à un fil ne rapportent pas ces points.",
    option:
      "Lorsque le comité accepte une nouvelle option de formulaire, la personne à l'origine de la proposition reçoit 5 points et renouvelle son délai de 30 jours de Pro. Les clarifications et regroupements conservent cette attribution. Voter, commenter ou attendre une décision ne donne pas cette récompense ; les contributions aux discussions ont leurs propres règles.",
    feed: "Une connexion nouvelle ou remplacée d'un flux d'événements rapporte 5 points à la personne qui l'a proposée lorsqu'elle est acceptée et renouvelle son délai de 30 jours de Pro. Tester, suspendre, reprendre ou déconnecter un flux ne rapporte pas cette récompense. Une connexion en attente de vérification ne compte pas.",
    contribute:
      "Les contributions acceptées peuvent rapporter des points, notamment les discussions vérifiées, les connexions de flux d'événements et les suggestions d'options de formulaire. Pro obtenu par les contributions demande au moins 5 000 points et une acceptation admissible dans les 30 derniers jours. Le guide des points détaille les montants, exclusions et règles d'expiration.",
    badgeNote:
      "Les badges marquent des étapes et restent sur votre profil. Pro obtenu par les contributions demande séparément 5 000 points et une activité acceptée dans un délai renouvelable de 30 jours. Un badge ne garantit pas Pro à vie.",
    editsTitle: "Modifications et corrections",
    edits:
      "Ces badges comptent les modifications mineures et majeures ainsi que les corrections acceptées des fiches. Il n'est pas nécessaire d'avoir revendiqué la bibliothèque. Les publications directes du personnel ne donnent pas ces récompenses.",
    copyEditor:
      "Réviseur : 10 modifications ou traductions acceptées d'articles du Journal",
    verificationTitle: "Vérification",
    verification:
      "Ces badges comptent les vérifications acceptées des horaires ou du statut d'ouverture d'une bibliothèque.",
    badgesTitle: "Contributions et conversations",
    badges: [
      "Active Contributor : 5 000 points",
      "Conversation Starter : votre premier fil accepté",
      "Helpful Voice : 10 réponses acceptées",
    ],
    renounceTitle: "Renoncer à une revendication de bibliothèque",
    renounce:
      "Vous pouvez renoncer à votre revendication depuis l'espace Personnel ou le centre Contribuer, même si vous êtes le dernier Owner de cette bibliothèque. La confirmation retire votre accès à cette bibliothèque et arrête toute session en direct que vous avez lancée. Vos contributions publiques acceptées restent en place. Vous pourrez refaire une demande. Cette renonciation n'annule aucun abonnement payant ou Team et ne remplace pas la transmission exigée du dernier responsable d'une organisation Team.",
    owner:
      "Une autre personne ne peut ni retirer ni rétrograder le dernier Owner d'une bibliothèque, mais celui-ci peut partir volontairement.",
    export:
      "Une bibliothèque publiée peut être téléchargée en JSON ou CSV depuis sa fiche. Les exports Atlas CSV/GeoJSON permettent jusqu'à 500 bibliothèques par téléchargement pour Supporter, 10 000 pour Pro et 50 000 pour une place Team active. Ils comprennent les sources, éditeurs, licences et crédits disponibles. Les téléchargements nocturnes de toutes les données et une API publique générale restent des projets distincts.",
    creditTitle: "Crédits des contributions communautaires",
    credit:
      "La fiche publiée d'une bibliothèque issue d'une proposition acceptée crédite son auteur dans les sources, même si un éditeur publie la fiche ultérieurement. Si le profil et l'activité sont publics, le nom d'utilisateur renvoie au profil ; sinon le crédit indique un membre de la communauté. Les références publiques sont distinctes de ce crédit. Les preuves privées destinées aux modérateurs ne figurent jamais dans la liste publique des sources.",
  },
  cs: {
    proTitle: "Získejte Pro za příspěvky",
    pro: "Pro získané za příspěvky je aktivní, pokud máte aktuálně alespoň 5 000 bodů a během posledních 30 dnů byl přijat váš způsobilý příspěvek. Každé takové přijetí posune konec přístupu na 30 dnů od přijetí bez ohledu na počet přidělených bodů. Odeslání konceptu ani čekání na kontrolu tuto lhůtu neobnovuje.",
    expiry:
      "Po 30 dnech bez přijetí způsobilého příspěvku získané Pro vyprší. Další přijetí jej obnoví, pokud stále máte alespoň 5 000 bodů. Nárok zaniká také při poklesu pod 5 000 bodů. Vypršení samo o sobě neodebírá body ani odznaky. Při 50 bodech za schválenou novou knihovnu by 100 knihoven přineslo 5 000 bodů bez dalších odměn.",
    excluded:
      "Lhůtu obnovují přijaté příspěvky ke knihovnám, do Znalostí a časopisu, úkoly a návrhy kampaní, diskuse, připojení zdrojů akcí a návrhy možností formulářů. Automatické bonusy za sérii či dokončení kampaně, ruční úpravy bodů, hlasování, reakce, čekající návrhy a přímé publikování personálu ji neobnovují. Žádosti o nová místa a role body nepřinášejí.",
    independent:
      "Získané Pro je nezávislé na placeném členství, ověřeném personálu, uděleném přístupu a aktivních místech Team; tyto možnosti mají vlastní podmínky. Získání Pro neruší stávající placené předplatné ani jeho obnovení. Obnovení spravujte samostatně v Členství a fakturace. Úroveň ani trvalý odznak samy o sobě nezajišťují trvalé Pro.",
    pointsLink: "Body, série a úrovně",
    newRewards: [
      "Přijaté nové diskusní vlákno: 2 body",
      "Přijatá odpověď nebo úprava diskuse: 1 bod",
      "Přijaté nové nebo nahrazené připojení zdroje akcí: 5 bodů",
      "Přijatý návrh možnosti formuláře: 5 bodů původnímu navrhovateli",
      "Přijatý úkol kampaně: 2 body navíc",
      "Přijatý návrh kampaně: 10 bodů",
      "Kampaň dosáhne cíle: bonus 25 bodů, pokud jste přispěli alespoň 5 přijatými úkoly",
    ],
    rewardTitle: "Body za přijaté příspěvky",
    discussion:
      "Přijaté nové vlákno přináší 2 body, přijatá odpověď nebo úprava 1 bod. Body dostává autor příspěvku jednou za přijatou verzi. Každé způsobilé přijetí obnovuje 30denní lhůtu získaného Pro. Koncepty, zamítnuté zprávy, reakce a sledování tyto body nepřinášejí.",
    option:
      "Když rada přijme novou možnost formuláře, původní navrhovatel získá 5 bodů a obnoví se jeho 30denní lhůta Pro. Upřesnění a sloučení návrhů zachovávají původního navrhovatele. Hlasování, komentování ani čekání na rozhodnutí tuto odměnu nepřináší; přijaté diskusní příspěvky mají vlastní odměny.",
    feed: "Přijaté nové nebo nahrazené připojení zdroje akcí přinese navrhovateli 5 bodů a obnoví jeho 30denní lhůtu Pro. Testování, pozastavení, obnovení ani odpojení zdroje tuto odměnu nepřináší. Připojení čekající na kontrolu se nezapočítává.",
    contribute:
      "Přijaté příspěvky mohou přinášet body, včetně zkontrolovaných diskusí, připojení zdrojů akcí a návrhů možností formulářů. Získané Pro vyžaduje alespoň 5 000 aktuálních bodů a přijetí způsobilého příspěvku během posledních 30 dnů. Průvodce body uvádí odměny, výjimky i pravidla vypršení.",
    badgeNote:
      "Odznaky označují milníky a zůstávají ve vašem profilu. Získané Pro má samostatný práh 5 000 bodů a obnovitelnou 30denní lhůtu aktivity. Odznak není trvalým přístupem Pro.",
    editsTitle: "Úpravy a opravy",
    edits:
      "Započítávají se přijaté menší i větší úpravy záznamů knihoven a přijaté opravy. Knihovnu nemusíte mít nárokovanou. Přímé publikování personálu tyto odměny nepřináší.",
    copyEditor: "Korektor: 10 přijatých úprav nebo překladů článků časopisu",
    verificationTitle: "Ověřování",
    verification:
      "Započítávají se přijaté kontroly otevírací doby nebo provozního stavu knihovny.",
    badgesTitle: "Milníky příspěvků a diskusí",
    badges: [
      "Active Contributor: 5 000 bodů",
      "Conversation Starter: první přijaté diskusní vlákno",
      "Helpful Voice: 10 přijatých odpovědí",
    ],
    renounceTitle: "Vzdání se nároku na knihovnu",
    renounce:
      "Svého nároku se můžete vzdát v prostoru pro personál nebo v centru Přispět, i když jste posledním vlastníkem dané knihovny. Potvrzením skončí váš přístup personálu k této knihovně a případné živé sdílení, které jste zahájili. Přijaté veřejné příspěvky zůstanou zachovány. Později můžete požádat znovu. Vzdání se nároku neruší placené členství ani předplatné Team a nenahrazuje předání role požadované od posledního organizátora Team.",
    owner:
      "Jiná osoba nemůže posledního vlastníka knihovny odebrat ani mu snížit roli, ale vlastník může dobrovolně odejít.",
    export:
      "Jednu publikovanou knihovnu lze stáhnout jako JSON nebo CSV z její stránky. Exporty Atlasu CSV/GeoJSON umožňují nejvýše 500 knihoven na stažení pro Supporter, 10 000 pro Pro a 50 000 pro aktivní místo Team. Obsahují dostupné údaje o zdrojích, vydavatelích, licencích a autorství. Noční stahování celé datové sady a obecné veřejné API zůstávají samostatnými plány.",
    creditTitle: "Uvedení komunitního přispěvatele",
    credit:
      "Publikovaný záznam knihovny vytvořený z přijatého návrhu uvádí přispěvatele mezi zdroji, i když jej editor publikuje až později. Pokud jsou profil i aktivita veřejné, uživatelské jméno odkazuje na profil; jinak je uveden člen komunity. Veřejné odkazy na zdroje jsou od tohoto poděkování oddělené. Soukromé podklady pro moderátory se nikdy nezobrazují ve veřejném seznamu zdrojů.",
  },
}

export const rewardsGuideSlugs = [
  "points-streaks-and-tiers",
  "plans-and-pro",
  "library-conversations",
  "suggesting-new-options",
  "connect-an-event-feed",
  "managing-event-feeds",
  "how-to-contribute",
  "badges",
  "claiming-your-library",
  "staff-area",
  "teams-for-library-services",
  "reusing-the-data",
  "change-history-on-library-pages",
  "sources-and-data-retention",
]

// Targeted edits preserve unrelated blocks, links, headings and metadata.
export function rewardsGuideBody(doc, locale) {
  if (!rewardsGuideSlugs.includes(doc.slug)) return doc.body
  const c = copy[locale]
  assert.ok(c, "Unsupported editorial locale")
  const body = structuredClone(doc.body)
  const first = body.find((b) => b.__component === "content.rich-text")?.body
  assert.ok(first, `Missing rich text: ${doc.slug}`)
  const add = (title, ...values) =>
    body.push({
      __component: "content.rich-text",
      body: [heading(title), ...values.map(paragraph)],
    })
  const replace = (pattern, value) => {
    let count = 0
    for (const b of body)
      for (const n of b.body ?? []) {
        if (n.type === "paragraph" && pattern.test(text(n))) {
          n.children = paragraph(value).children
          count++
        }
      }
    assert.equal(count, 1, `Expected one paragraph for ${doc.slug}: ${pattern}`)
  }
  const pointLink = () =>
    body.push({
      __component: "content.rich-text",
      body: [
        link(c.pointsLink, "/knowledge/contributing/points-streaks-and-tiers"),
      ],
    })
  if (doc.slug === "points-streaks-and-tiers") {
    replace(/90/, c.pro)
    assert.equal(first[3].type, "list")
    first[3].children.push(...list(c.newRewards).children)
    add(c.proTitle, c.expiry, c.excluded, c.independent)
  }
  if (doc.slug === "plans-and-pro") {
    const substitutions = {
      fr: [
        "Team fait l'objet d'un devis distinct.",
        "Team a un abonnement annuel distinct, géré par ses responsables depuis l'espace Team.",
      ],
      cs: [
        "Team má samostatnou nabídku.",
        "Team má samostatné roční předplatné, které organizátoři spravují v prostoru Team.",
      ],
    }
    const pair = substitutions[locale]
    if (pair) walkText(body, (t) => t.replace(...pair))
    add(c.proTitle, c.pro, c.expiry, c.independent)
    pointLink()
  }
  const reward = {
    "library-conversations": c.discussion,
    "suggesting-new-options": c.option,
    "connect-an-event-feed": c.feed,
    "managing-event-feeds": c.feed,
    "how-to-contribute": c.contribute,
  }[doc.slug]
  if (reward) {
    add(c.rewardTitle, reward)
    pointLink()
  }
  if (doc.slug === "badges") {
    assert.equal(first[2].type, "paragraph")
    assert.equal(first[26].type, "heading")
    first[2] = paragraph(c.badgeNote)
    first[7] = heading(c.editsTitle)
    first[8] = paragraph(c.edits)
    first[20].children[3] = { ...paragraph(c.copyEditor), type: "list-item" }
    first[26] = heading(c.verificationTitle)
    first[27] = paragraph(c.verification)
    body.push({
      __component: "content.rich-text",
      body: [heading(c.badgesTitle), list(c.badges)],
    })
    pointLink()
  }
  if (
    [
      "claiming-your-library",
      "staff-area",
      "teams-for-library-services",
    ].includes(doc.slug)
  ) {
    walkText(body, (t) => {
      const replacements = [
        [
          "lets you leave when another owner remains",
          "lets you leave voluntarily",
        ],
        [
          "permet de quitter l'équipe (à condition qu'un autre propriétaire reste présent)",
          "permet de quitter volontairement la bibliothèque",
        ],
        [
          "umožňuje vám opustit tým (pokud v něm zůstane jiný vlastník)",
          "umožňuje vám dobrovolně opustit knihovnu",
        ],
        [
          "The last owner of a library cannot leave or be made an editor.",
          c.owner,
        ],
        [
          "Le dernier propriétaire d'une bibliothèque ne peut ni quitter celle-ci ni être rétrogradé au statut d'éditeur.",
          c.owner,
        ],
        [
          "Poslední vlastník knihovny nemůže z týmu odejít ani mu nemůže být změněna role na editora.",
          c.owner,
        ],
        [", unless they are its last owner", ", including its last owner"],
        [
          ", sauf s'il en est le dernier propriétaire",
          ", y compris son dernier propriétaire",
        ],
        [
          ", pokud není jejím posledním vlastníkem",
          ", včetně jejího posledního vlastníka",
        ],
      ]
      for (const [before, after] of replacements) t = t.replace(before, after)

      return t
    })
    add(c.renounceTitle, c.renounce)
  }
  if (doc.slug === "reusing-the-data") replace(/CSV.*GeoJSON/, c.export)
  if (doc.slug === "change-history-on-library-pages") {
    walkText(body, (t) =>
      t
        .replace(
          "Supporter, Supporter, Pro and Team",
          "Supporter, Pro and Team"
        )
        .replace(
          "Les membres des forfaits Pro et Team",
          "Les membres des forfaits Supporter, Pro et Team"
        )
        .replace(
          "Uživatelé s tarify Pro a Team",
          "Uživatelé s tarify Supporter, Pro a Team"
        )
    )
  }
  if (
    ["change-history-on-library-pages", "sources-and-data-retention"].includes(
      doc.slug
    )
  )
    add(c.creditTitle, c.credit)

  return body
}

function walkText(value, transform) {
  if (Array.isArray(value)) value.forEach((child) => walkText(child, transform))
  else if (value && typeof value === "object")
    for (const key of Object.keys(value)) {
      if (key === "text" && typeof value[key] === "string")
        value[key] = transform(value[key])
      else walkText(value[key], transform)
    }
}

export function rewardsLegalUpdate(doc) {
  if (!["membership", "terms", "privacy", "cookies"].includes(doc.slug))
    return null
  const sections = structuredClone(doc.sections)
  const append = (title, ...values) => {
    const section = sections.find((s) => s.heading === title)
    assert.ok(section, `Missing legal section: ${title}`)
    section.body.push(...values.map(paragraph))
  }
  const choices =
    "After you accept or reject analytics, the choice panel closes. You can reopen Cookie choices from Navigation, the site footer or the cookie policy to change or withdraw your choice. Withdrawing stops further collection, clears analytics cookies and reloads the page to unload Google code. Essential account and beta-access storage is preserved."
  if (doc.slug === "membership") {
    append(
      "The tools you receive",
      copy.en.pro,
      copy.en.expiry,
      copy.en.independent
    )
    walkText(sections, (t) =>
      t.replace(
        "The standard price will be £8/month or £80/year once Reach ships; it is not offered before those tools are available.",
        "A proposed standard price of £8/month or £80/year is a separate future offer and is not currently available. The availability of Reach does not itself change your recurring price."
      )
    )
  }
  if (doc.slug === "terms") {
    sections.find((s) => s.heading === "Library claims").inShort =
      "An approved claim gives staff access for that library. Protected changes still need review."
    sections.find((s) => s.heading === "Licensing your contributions").inShort =
      "Contributions are published under CC BY-SA 4.0; public credit follows your privacy choices."
    sections.find((s) => s.heading === "Contributing").inShort =
      "Community submissions are reviewed before publication. Authorised staff can publish permitted record changes directly."
    append(
      "Points, tiers and badges",
      copy.en.pro,
      "Automatic bonuses and manual adjustments do not renew the activity window. Points and badges are not a promise of permanent Pro. Paid memberships, verified-staff access, grants and active Team seats have separate eligibility rules. Earning Pro does not cancel paid renewal."
    )
    append("Library claims", copy.en.renounce)
    append("Licensing your contributions", copy.en.credit)
  }
  if (doc.slug === "privacy") {
    append("Cookies", choices)
    append("What other people can see", copy.en.credit)
  }
  if (doc.slug === "cookies") append("Controlling cookies", choices)
  const versions = {
    membership: "1.4",
    terms: "1.2",
    privacy: "2.1",
    cookies: "2.1",
  }
  const summaries = {
    membership:
      "Clarified the 5,000-point, 30-day earned-Pro rules and their separation from paid renewal; removed an obsolete Reach pricing trigger. Purchase prices and historical consent are unchanged.",
    terms:
      "Pre-launch clarification of earned Pro, voluntary library-claim renunciation and privacy-aware community source credits.",
    privacy:
      "Clarified community source-credit visibility and where to reopen analytics choices. Analytics purposes and retention are unchanged.",
    cookies:
      "Explained dismissal and reopening of Cookie choices. Consent purposes, retention and withdrawal behaviour are unchanged.",
  }

  return {
    sections,
    revisions: [
      ...doc.revisions,
      {
        version: versions[doc.slug],
        date: "2026-11-01",
        summary: summaries[doc.slug],
        changesUrl: null,
      },
    ],
  }
}
