/** Corrections for the self-service Team release; preserve unrelated article sections. */
const text = (value) => ({ type: "text", text: value })
const paragraph = (value) => ({ type: "paragraph", children: [text(value)] })
const heading = (value) => ({
  type: "heading",
  level: 2,
  children: [text(value)],
})
const rich = (...body) => ({ __component: "content.rich-text", body })

const copy = {
  en: {
    setupPrefix: "Ask us about Team for your service",
    setup:
      "When Team signup is enabled, sign in with a verified account and choose Create a Team on the Membership page, or open /staff/team/new. Name your organisation, choose at least five seats, review the annual total and accept the Team terms. Continue to Stripe's hosted checkout for billing, tax and payment details. You become the Organiser; the Team and its seats activate after payment is confirmed. During the closed beta, use Stripe test payment details only: no real payment is taken. Personal Pro is separate and does not create a Team.",
    capacityPrefix: "Invitations count against the seats.",
    capacity:
      "Active members and pending invitations occupy seats. If every seat is taken, remove an unused member or invitation, or open Billing & seats to purchase more. Checking a public-library-service option requests an eligibility review; it does not approve a discount or verify Library authority.",
    workspaceHeading: "Your Team workspace",
    workspace:
      "Open Staff area and choose the Team you want to manage. Members & libraries, API access and Billing & seats keep the same Team selected. If you have several Teams, check its name before changing members, keys or billing. An existing Team has management links rather than another signup. Members can view their Team; Organisers manage it.",
    libraries:
      "Organisers can change the Team name and its covered Libraries from Members & libraries. Verification remains a separate review. An unverified Team's staff assignments are claims awaiting moderation. To add another Library to an already verified Team, the Organiser must have verified Owner access to that Library. Removing a Library ends staff affiliations created there by this Team; separately approved claims are preserved.",
    billingHeading: "Annual billing and seat changes",
    billing:
      "Choose Billing & seats, then Manage Team billing and seats for invoices, payment details, annual renewal and quantities. Stripe shows the amount before you confirm an increase; extra access starts after payment is confirmed. Reductions start at renewal. Remove excess members and pending invitations before that date; scheduled lower capacity also limits new invitations. If the occupied places exceed the paid allowance, Team access is suspended until an Organiser resolves the excess or purchases more seats and refreshes payment status.",
    renewal:
      "Stopping renewal normally keeps paid Team access until the paid-through date. A failed renewal can have up to seven days of grace from its original failure; retries do not extend it. The monthly API add-on has separate billing and cancellation. Existing invoice Teams keep their agreed terms and are not converted automatically. Stopping renewal does not request a refund; the membership and cancellation policies explain refund requests and applicable rights.",
    handoverHeading: "Handover and unfinished Teams",
    handover:
      "Before the last active Organiser deletes their account, give another active member the Organiser role. The Team's subscription belongs to the organisation and continues under its Organisers. An unused setup can be discarded from Team billing only when it has no ongoing subscription, paid coverage, other active member or unresolved checkout; the checks also cover its API subscription. Discarding is not a way to cancel a paid Team.",
    deletionHeading: "If you organise a Team",
    deletion:
      "Team billing belongs to the organisation, not to the Organiser's personal account. Before deleting the last active Organiser's account, promote another active member to Organiser or discard an eligible unused setup from Team billing. Account deletion is refused until this is resolved. A Team with another Organiser keeps its subscription and other members. Team financial references and your own purchase-consent records follow the retention periods in the privacy notice.",
    staffHeading: "Team workspaces and billing",
    staff:
      "You can have a Team workspace before any Library staff claim is approved. From Staff area, select your Team for Members & libraries, API access and Billing & seats. Organisers manage membership and annual billing; ordinary members can view their Team. Creating or paying for a Team does not approve staff access. The Teams for library services guide explains signup, Library verification, seat changes and handover.",
  },
  fr: {
    setupPrefix: "Renseignez-vous sur l'offre « Équipe »",
    setup:
      "Lorsque l'inscription Team est activée, connectez-vous avec un compte dont l'adresse e-mail est vérifiée et choisissez de créer une équipe sur la page Adhésion, ou ouvrez /staff/team/new. Indiquez le nom de l'organisation, choisissez au moins cinq places, vérifiez le total annuel et acceptez les conditions Team. Stripe recueille les coordonnées de facturation et les informations fiscales et de paiement. Vous devenez responsable ; l'équipe et ses places sont activées après confirmation du paiement. Pendant la bêta fermée, utilisez uniquement les moyens de paiement de test Stripe : aucun débit réel n'est effectué. Un abonnement Pro personnel ne crée pas d'équipe.",
    capacityPrefix: "Les invitations sont comptabilisées",
    capacity:
      "Les membres actifs et les invitations en attente occupent des places. Si toutes les places sont prises, retirez un membre ou une invitation inutilisée, ou achetez des places dans la facturation Team. Choisir le type service de bibliothèque publique demande un contrôle d'éligibilité ; cela n'accorde ni réduction ni vérification de l'autorité sur une bibliothèque.",
    workspaceHeading: "L'espace de votre équipe",
    workspace:
      "Dans l'espace Personnel, choisissez l'équipe à gérer. Les pages Membres et bibliothèques, Accès API et Facturation et places conservent cette sélection. Vérifiez le nom de l'équipe avant toute modification si vous appartenez à plusieurs équipes. Une équipe existante propose ses liens de gestion. Les membres peuvent la consulter ; les responsables la gèrent.",
    libraries:
      "Les responsables peuvent modifier le nom et les bibliothèques couvertes. La vérification reste distincte : les affectations d'une équipe non vérifiée attendent une modération. Pour ajouter une bibliothèque à une équipe déjà vérifiée, le responsable doit en être propriétaire vérifié. Retirer une bibliothèque met fin aux accès créés par cette équipe ; les demandes d'accès approuvées séparément sont conservées.",
    billingHeading: "Facturation annuelle et places",
    billing:
      "Ouvrez la facturation Team puis Manage Team billing and seats pour les factures, les coordonnées de paiement, le renouvellement et le nombre de places. Stripe affiche le montant avant confirmation d'une augmentation ; les droits supplémentaires commencent après confirmation du paiement. Une réduction commence au renouvellement. Retirez les membres et invitations en excès avant cette date ; le futur plafond limite aussi les nouvelles invitations. Si les places occupées dépassent les places payées, l'accès Team est suspendu jusqu'à résolution de l'excès ou paiement de places supplémentaires, puis actualisation du statut.",
    renewal:
      "L'arrêt du renouvellement conserve normalement l'accès jusqu'à la fin de la période payée. Un échec de renouvellement peut donner jusqu'à sept jours de grâce à partir du premier échec, sans prolongation par les nouvelles tentatives. L'option API mensuelle se paie et s'annule séparément. Les accords sur facture existants gardent leurs conditions et ne sont pas convertis automatiquement. Arrêter le renouvellement ne demande pas un remboursement ; consultez les conditions d'adhésion et la politique d'annulation.",
    handoverHeading: "Transmettre la responsabilité ou abandonner une création",
    handover:
      "Avant que le dernier responsable actif ne supprime son compte, donnez ce rôle à un autre membre actif. L'abonnement appartient à l'organisation et continue sous ses responsables. Une création inutilisée ne peut être abandonnée depuis la facturation Team que si aucun abonnement en cours, période payée, autre membre actif ou paiement non résolu ne subsiste, y compris pour l'API. Abandonner une création ne remplace pas l'annulation d'une équipe payante.",
    deletionHeading: "Si vous êtes responsable d'une équipe",
    deletion:
      "La facturation Team appartient à l'organisation, pas au compte personnel du responsable. Avant de supprimer le compte du dernier responsable actif, nommez un autre membre actif responsable ou abandonnez une création inutilisée admissible depuis la facturation Team. La suppression est refusée tant que ce point n'est pas résolu. Une équipe qui conserve un responsable garde son abonnement et ses autres membres. Les références financières et les consentements d'achat suivent les durées de conservation de la notice de confidentialité.",
    staffHeading: "Espaces Team et facturation",
    staff:
      "Un espace Team peut exister avant l'approbation d'un accès au personnel d'une bibliothèque. Dans l'espace Personnel, choisissez l'équipe pour accéder aux membres et bibliothèques, à l'API et à la facturation. Les responsables gèrent l'adhésion et la facturation annuelle ; les membres consultent l'équipe. Créer ou payer une équipe ne valide pas les accès au personnel. Le guide des équipes explique l'inscription, la vérification, les places et la transmission du rôle.",
  },
  cs: {
    setupPrefix: "O zřízení týmu pro vaši organizaci",
    setup:
      "Když je registrace Team zapnutá, přihlaste se účtem s ověřeným e-mailem a na stránce Členství zvolte vytvoření týmu nebo otevřete /staff/team/new. Zadejte název organizace, vyberte alespoň pět míst, zkontrolujte roční cenu a přijměte podmínky Team. Fakturační, daňové a platební údaje zadáte na stránce Stripe. Stanete se organizátorem; tým a jeho místa se aktivují po potvrzení platby. V uzavřené betě používejte pouze testovací platební údaje Stripe, bez skutečné platby. Osobní předplatné Pro tým nevytváří.",
    capacityPrefix: "Pozvánky se započítávají",
    capacity:
      "Aktivní členové a čekající pozvánky obsazují místa. Pokud jsou všechna obsazena, odeberte nepoužívaného člena nebo pozvánku, případně kupte další místa ve fakturaci týmu. Volba veřejné knihovní služby žádá o kontrolu nároku; sama neposkytuje slevu ani ověření oprávnění ke knihovně.",
    workspaceHeading: "Pracovní prostor týmu",
    workspace:
      "V sekci pro zaměstnance vyberte tým, který chcete spravovat. Stránky Členové a knihovny, Přístup k API a Fakturace a místa zachovají výběr týmu. Pokud patříte do více týmů, před změnou členů, klíčů nebo plateb zkontrolujte jeho název. Existující tým nabízí odkazy na správu. Členové tým prohlížejí; organizátoři jej spravují.",
    libraries:
      "Organizátoři mohou změnit název a zahrnuté knihovny. Ověření je samostatné: přiřazení neověřeného týmu čekají na moderátora. Pro přidání knihovny do již ověřeného týmu musí mít organizátor ověřené oprávnění vlastníka této knihovny. Odebrání knihovny ukončí oprávnění vytvořená tímto týmem; samostatně schválené žádosti zůstávají.",
    billingHeading: "Roční fakturace a změny počtu míst",
    billing:
      "Ve fakturaci týmu otevřete Manage Team billing and seats pro faktury, platební údaje, obnovování a počet míst. Stripe ukáže cenu před potvrzením navýšení; další přístup začne po potvrzení platby. Snížení platí od obnovení. Před tímto datem odeberte nadbytečné členy a pozvánky; plánovaný nižší limit omezuje i nové pozvánky. Pokud obsazená místa překročí zaplacený počet, přístup Team se pozastaví, dokud organizátor nevyřeší přebytek nebo nezaplatí další místa a neobnoví stav platby.",
    renewal:
      "Zastavení obnovování obvykle zachová přístup do konce zaplaceného období. Neúspěšné obnovení může mít až sedmidenní ochrannou lhůtu od prvního selhání; další pokusy ji neprodlužují. Měsíční doplněk API se platí a ruší samostatně. Stávající fakturované dohody zachovají své podmínky a nepřevedou se automaticky. Zastavení obnovování není žádostí o vrácení peněz; přečtěte si podmínky členství a zásady zrušení.",
    handoverHeading: "Předání správy a nedokončené týmy",
    handover:
      "Než poslední aktivní organizátor smaže účet, předejte tuto roli jinému aktivnímu členovi. Předplatné patří organizaci a pokračuje pod jejími organizátory. Nepoužitou rozpracovanou registraci lze zahodit ve fakturaci týmu jen bez probíhajícího předplatného, zaplaceného období, dalšího aktivního člena a nevyřešené platby; kontroluje se i předplatné API. Zahození registrace neruší placený tým.",
    deletionHeading: "Pokud organizujete tým",
    deletion:
      "Fakturace Team patří organizaci, ne osobnímu účtu organizátora. Před smazáním účtu posledního aktivního organizátora povyšte jiného aktivního člena nebo zahoďte způsobilou nepoužitou registraci ve fakturaci týmu. Do vyřešení je smazání odmítnuto. Tým s dalším organizátorem si ponechá předplatné i ostatní členy. Finanční reference a souhlasy s nákupem se uchovávají podle oznámení o ochraně soukromí.",
    staffHeading: "Pracovní prostory Team a fakturace",
    staff:
      "Pracovní prostor Team můžete mít před schválením oprávnění zaměstnance knihovny. V sekci pro zaměstnance vyberte tým pro členy a knihovny, API a fakturaci. Organizátoři spravují členství a roční platby; ostatní členové tým prohlížejí. Vytvoření ani zaplacení týmu nepotvrzuje oprávnění ke knihovně. Průvodce týmy popisuje registraci, ověření knihoven, místa a předání správy.",
  },
}

const mapText = (value, replace) => {
  if (Array.isArray(value)) return value.map((item) => mapText(item, replace))
  if (!value || typeof value !== "object") return value

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === "text" && typeof child === "string"
        ? replace(child)
        : mapText(child, replace),
    ])
  )
}
const plain = (node) =>
  node?.children?.map((child) => child.text ?? "").join("") ?? ""
const upsert = (body, name, ...paragraphs) => {
  const component = rich(heading(name), ...paragraphs.map(paragraph))
  const index = body.findIndex(
    (item) =>
      item.__component === "content.rich-text" && plain(item.body?.[0]) === name
  )
  if (index === -1) body.push(component)
  else body[index] = component
}

export function teamServiceGuideBody(doc, locale) {
  const c = copy[locale]
  if (!c) return null
  const affected = new Set([
    "teams-for-library-services",
    "plans-and-pro",
    "staff-area",
    "deleting-your-account",
  ])
  if (!affected.has(doc.slug)) return null
  let body = mapText(doc.body ?? [], (value) =>
    value.replace(
      "Team is quoted separately.",
      "Team has a separate annual subscription; its Organisers manage it from the Team workspace."
    )
  )
  if (doc.slug === "teams-for-library-services") {
    body = mapText(body, (value) =>
      value.startsWith(c.setupPrefix)
        ? c.setup
        : value.startsWith(c.capacityPrefix)
          ? c.capacity
          : value
    )
    upsert(body, c.workspaceHeading, c.workspace, c.libraries)
    upsert(body, c.billingHeading, c.billing, c.renewal)
    upsert(body, c.handoverHeading, c.handover)
  }
  if (doc.slug === "staff-area") upsert(body, c.staffHeading, c.staff)
  if (doc.slug === "deleting-your-account")
    upsert(body, c.deletionHeading, c.deletion)

  return body
}

export function teamServiceLegalSections(doc) {
  if (doc.slug === "cancellation-refunds")
    return mapText(doc.sections ?? [], (value) =>
      value.replace(
        "[Supporter or Pro]",
        "[Supporter, Pro, Team or Team API add-on]"
      )
    )
  if (doc.slug !== "terms") return doc.sections ?? []

  return (doc.sections ?? []).map((section) => {
    if (section.heading === "Library claims")
      return {
        ...section,
        body: mapText(section.body, (value) =>
          value.replace(
            "An approved claim lets you propose fuller edits to that library's record and shows that you're connected to it. It doesn't make you the library's official representative on Libraries Global, and your edits are still reviewed.",
            "An approved claim gives you staff access for that Library. Permitted staff changes publish directly; protected fields and other people's staff claims still need moderation. A Team's payment does not verify Library authority. Staff access does not make you the Library's official representative on Libraries Global."
          )
        ),
      }
    if (section.heading === "Donations and paid features")
      return {
        ...section,
        body: mapText(section.body, (value) =>
          value.replace(
            "Supporter and Pro are optional recurring digital memberships processed by Stripe Managed Payments.",
            "Supporter and Pro are optional personal recurring memberships. Team is a separate annual organisation subscription, and Team API is a separate monthly add-on. Payments use Stripe Managed Payments. Team Organisers manage seats, invoices and renewal from the Team workspace. Team payment does not verify Library authority or grant staff permissions. Existing invoice agreements retain their agreed terms."
          )
        ),
      }
    if (section.heading === "Removing content and suspending accounts")
      return {
        ...section,
        body: mapText(section.body, (value) =>
          value.replace(
            "You can stop using Libraries Global and delete your account at any time.",
            "You can stop using Libraries Global and request account deletion in Settings. Personal billing must be reconciled first. If you are the last active Team Organiser, transfer that role to another active member or discard an eligible unused setup before deletion. The organisation's subscription continues when another Organiser remains."
          )
        ),
      }
    if (section.heading === "Emails and account updates")
      return {
        ...section,
        body: mapText(section.body, (value) =>
          value.replace(
            "During the closed beta, visitors need the shared invitation password to enter. Passing it does not create an account or subscribe you to emails. The beta waitlist is used only for requested access.",
            "During the closed beta, visitors request an individual invitation. Redeeming its link opens browser access; it does not create an account, join a Team or subscribe you to optional emails. Team invitations and account verification are separate steps."
          )
        ),
      }

    return section
  })
}

/** Update only the introductory copy affected by the Team offer. */
export function teamServiceLegalMetadata(doc) {
  if (doc.slug === "membership")
    return {
      lead: "Terms for Supporter, Pro, Team and Team API digital tools, recurring payments and access.",
      summaryPoints: mapText(doc.summaryPoints ?? [], (value) =>
        value.replace(
          "Cancel renewal in Membership & billing; statutory rights remain unchanged.",
          "Manage personal renewal in Settings and Team or API renewal in the Team workspace; statutory rights remain unchanged."
        )
      ),
    }
  if (doc.slug === "cancellation-refunds")
    return {
      summaryPoints: mapText(doc.summaryPoints ?? [], (value) =>
        value.replace(
          "Stop renewal in Settings without deleting your account.",
          "Stop personal renewal in Settings and Team or API renewal in the Team workspace, without deleting your account."
        )
      ),
    }
  if (doc.slug === "terms")
    return {
      summaryPoints: mapText(doc.summaryPoints ?? [], (value) =>
        value.replace(
          "Every contribution is reviewed by a person, then published under CC BY-SA 4.0 and credited to your username.",
          "Contributor suggestions are reviewed before publication. Verified staff can publish permitted changes to their own libraries. Published contributions use CC BY-SA 4.0."
        )
      ),
    }

  return {}
}
