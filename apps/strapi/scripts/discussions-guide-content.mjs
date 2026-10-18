/** Reviewed editorial copy for the community publishing release, in each CMS locale. */
import { stripComponentIds } from "./team-pricing-content.mjs"

const guidePath = "/knowledge/contributing/library-conversations"
const plansPath = "/knowledge/governance/plans-and-pro"

// Plain paragraphs, level-two headings and ordinary Markdown links only.
export function richText(markdown) {
  return {
    __component: "content.rich-text",
    body: markdown
      .trim()
      .split(/\n\s*\n/)
      .map((line) => {
        const isHeading = line.startsWith("## ")
        const value = isHeading ? line.slice(3) : line
        const children = []
        const pattern = /\[([^\]]+)\]\(([^)]+)\)/g
        let end = 0
        for (const match of value.matchAll(pattern)) {
          if (match.index > end)
            children.push({ type: "text", text: value.slice(end, match.index) })
          children.push({
            type: "link",
            url: match[2],
            children: [{ type: "text", text: match[1] }],
          })
          end = match.index + match[0].length
        }
        if (end < value.length)
          children.push({ type: "text", text: value.slice(end) })

        return {
          type: isHeading ? "heading" : "paragraph",
          ...(isHeading ? { level: 2 } : {}),
          children,
        }
      }),
  }
}

const main = {
  en: {
    "how-to-contribute": `Libraries Global is kept up to date by the people who use it. You need a free account and something you know about a library; you do not need technical knowledge or a paid membership.

## Ways to help

Suggest a correction from a library page, answer its Yes/No facilities questions, share a photo or add a public source. Keep official names as the library writes them and say where your information came from. Leave uncertain facts blank.

Use [Add a missing library](/contribute/add-library) for a missing record. You can request a missing region or area from that form. Translate this record changes language-specific text; shared facts such as opening hours and location stay the same across languages.

If you work or volunteer at a library, claim it so you can look after its record and connect its events feed once your claim is approved. A Team purchase does not verify a claim.

You can submit a Journal story with a verified account, suggest an improvement to an article, or report a problem on a Knowledge page. An editor role is needed to edit Knowledge directly or revise another writer’s Journal work in your granted languages. Authored articles and revisions go to another reviewer before publication.

Vote for missing checklist options on [Suggestions](/community/suggestions), or suggest a new one after checking the matches. A suggestion is checked before it opens for votes.

## Talk about what you have found

[Discussions](/community/discussions) lets you ask questions, exchange ideas and follow conversations. Threads can also appear beside libraries, drives, articles and suggestions. Reading public discussions needs no account; starting, replying, reacting and following are free account features. A reply does not change a record, cast a vote or complete a drive task. See [Joining library conversations](${guidePath}).

## Review, progress and roles

Follow formal contributions in [My submissions](/contribute/submissions). Reviewers check the evidence, accept the contribution or explain what needs changing. Discussion messages and edits have their own review queue, and their pending text and pictures stay private to the author and authorised reviewers.

Accepted formal contributions earn the points shown for that action. New contributors can have five formal contributions waiting at once; the limit rises with their tier. Discussion participation does not replace those contributions or grant a role.

After five accepted changes you can apply to become a Knowledge editor, Journal editor or moderator. Roles are never bought or earned with points. Only submit text and pictures you have the right to share under the site’s contribution terms.`,
    "roles-and-permissions": `You can read public library pages, articles and discussions without a role. A free verified account can contribute, submit Journal stories and take part in discussions.

## Roles, tiers and membership

Roles grant responsibility; tiers reflect contribution points and affect formal submission limits; membership adds data tools. Paying for Supporter, Pro or Team never grants a community role, review authority or points.

## Library staff and editors

Verified library staff look after the libraries covered by their approved claims or verified Team assignments. Most record edits publish directly; sensitive changes such as moving, changing the type or permanently closing a library still need review. Staff can review other people’s record suggestions for their own library, but cannot approve their own work or someone else’s claim.

Knowledge editors edit and translate Knowledge in their granted languages. Journal editors can revise other authors’ stories in their granted languages; ordinary members can submit Journal stories and revisions to their own stories. Authored articles and revisions need a different authorised reviewer. Editor or staff status alone does not allow discussion moderation.

## Moderators and the editorial board

Moderators review within their assigned queue and languages. Index covers library records and related requests; Knowledge and Journal cover their article submissions and reports; Discussions covers discussion messages, proposed edits, reports and restrictions. Applications access covers editor applications. Only the editorial board decides moderator applications.

The [moderation workspace](/contribute/moderation) groups work into Library changes, Articles, Claims, Drives, Role applications and Discussions. These categories help you find work; they do not broaden your permissions. The board can review across queues and languages. Nobody reviews their own submissions, including board members.

## Discussion bylines and linked feeds

Public bylines may show Editor, Moderator or Editorial board. Suggested this identifies a suggestion’s proposer. Private or activity-hidden profiles use an anonymous byline without role tags. A badge describes the author; review controls still require the right permission.

Feed managers curate links and featured threads. Verified library staff may propose links for their own library. Linking a conversation does not approve messages or grant moderation access. Read [Joining library conversations](${guidePath}).

## Applying and ending a role

After five accepted formal changes you may apply for an editor or moderator role. Choose the queue and languages for a moderator application, including Discussions. There can be one open application per role; after rejection, the same role has a 30-day reapplication wait. Roles may expire or be ended, and a new grant can take up to a minute to appear.`,
    "becoming-a-moderator": `Moderators check other people’s contributions, compare changes with their evidence and explain their decisions. The role is separate from editor access, library staff authority and paid membership.

## Choose a queue and languages

You can apply for Index, Knowledge, Journal or Discussions. Index covers library records and related requests; Knowledge and Journal cover article submissions and reports. Discussions covers new messages, proposed edits, reported messages and participant restrictions. Language access limits which work you can review. Knowledge and Journal applicants can also express section preferences.

The [moderation workspace](/contribute/moderation) displays Library changes, Articles, Claims, Drives, Role applications and Discussions. Only work within your review scope appears. Applications access is separately assigned; only the editorial board decides moderator applications.

## Applying

You need at least five accepted formal changes. Open [the application form](/contribute/knowledge/apply), choose Moderator, then select your queue and languages. Write 20–2,000 characters about why you are applying, optionally add up to five sample links, and confirm the guidelines. Your accepted changes are attached automatically.

You can have one open application for each role. If an application is rejected, you can apply for that role again after 30 days. The board’s decision and any requested changes appear in My submissions; role decisions also send a service email. Payment and points do not buy the role.

## Reviewing contributions

Check the source, accuracy, duplication and permission to publish text or pictures. Explain requests for changes and declined submissions. Compare the published version with a proposed edit and check for newer changes before deciding. Every decision is recorded.

Discussion text and pictures remain private to their author and authorised reviewers until accepted. A published message stays visible while an edit awaits review. Use the Discussions queue for messages, reports and restrictions; opening a linked feed does not grant access to its private queue.

## The same rule for everyone

Nobody approves their own contribution, including moderators and board members. Review only within your queue and languages, and ask for changes when the evidence is insufficient. Feed linking and featuring are separate curation decisions. See [Joining library conversations](${guidePath}) and [How review works](/knowledge/governance/how-review-works).`,
    "how-review-works": `Formal contributions and discussion messages are checked before publication. Authored articles and article revisions also need another authorised reviewer. Verified library staff can publish most changes to their own record directly; sensitive record changes still need moderation.

## One workspace, different kinds of work

[Moderation](/contribute/moderation) groups Library changes, Articles, Claims, Drives, Role applications and Discussions in one workspace. A moderator’s queues and languages determine what appears. The editorial board can review across scopes and decides applications to become a moderator.

Nobody can approve their own contribution. A library’s verified staff can review another person’s record suggestion for that library. The first valid decision wins.

## Formal submissions

Draft means saved privately. Submitted means waiting for review. Needs changes means the reviewer has explained what is missing. Accepted means approved, and Not accepted includes a reason. Follow these states and notes in [My submissions](/contribute/submissions).

Submitting freezes the review payload. Article requests for changes reopen a private draft for revision and resubmission. Other contribution types explain their available next step in My submissions; where there is no editing action, send a new contribution with the requested evidence. Private decision notes are not a public conversation or a private chat thread.

Reviewers check sources, accuracy, duplicates, rights to text and photos, and the claimed relationship to a library. They compare current and proposed values. Approval and publication depend on the contribution type; use Approve and publish only when the result is ready. Decisions are logged and accepted record changes appear in the library’s history.

## Discussion review

New messages and proposed edits wait in Discussions. Only their author and authorised reviewers can see pending text and pictures. Published text remains visible while an edit waits. The queue also handles reported messages and participant restrictions, within the reviewer’s language and access scope.

Editors, library staff, moderators and board members follow the same discussion review rule: a different authorised person decides. Curating a library or drive feed does not approve a message. [Joining library conversations](${guidePath}) explains replies, follows and privacy.

## Decisions and updates

Review decisions create private inbox updates. Optional review emails are controlled in notification settings; approved claims and role decisions also send essential service emails. A discussion follow sends an inbox update after a new contribution is approved, without previewing pending text. Review times vary with the queue.

## Review guidelines

Judge the contribution against its evidence, explain what needs changing, respect the author’s privacy and stay within your scope. The author’s role, tier or membership does not change the standard. Never approve your own work.`,
    "suggesting-new-options": `Libraries Global uses shared lists for accessibility, services, facilities and library types. Suggest an option when the checklist is missing something people could reliably verify at a library.

## Check before suggesting

On [Suggestions](/community/suggestions), use Suggest something for the checklist and type what you were looking for. Matches show existing checklist options and ideas already suggested. If it is already an option, correct the relevant library record. If someone has suggested it, vote for that idea or add to its conversation.

If your idea is different, explain how, who it helps and how a library could confirm it. Choose a category and send it for review. Your initial vote is saved. Pending suggestions stay private to their author and authorised reviewers until accepted for publication. Signed-in accounts can suggest and vote; daily limits apply.

## Voting and the shortlist

You can support several ideas, vote once on each and withdraw your vote while voting is open. The board shows the current cutoff and provisional shortlist on the page. Rankings can change before the cutoff; being on the provisional shortlist does not guarantee acceptance.

The board publishes its decisions and reasons. Accepted ideas can be added to the relevant shared list, including library types. Some decisions may need further implementation. Not added explains why an idea was declined or handled through an existing option. Read the decision before proposing the same name again.

## Conversations inside suggestion cards

Read conversation opens the thread inside the card. Show earlier replies loads more of it. Add to the conversation sends a message for review; it does not cast a vote or change the suggestion. Copy link points to the same conversation, which can also open as a full discussion.

Suggested this marks the original proposer. Editor, Moderator and Editorial board tags identify public roles. A moderator checks every message and edit, including their own colleagues’ messages; nobody approves their own. Pending text and pictures stay private to their author and authorised reviewers. See [Joining library conversations](${guidePath}).

## If your suggestion needs changes

Read the private feedback and use the available resubmission action or the form with the same name and requested changes. A declined proposal is not a public checklist option. Votes, discussion replies and a library correction are separate actions.`,
    "becoming-an-editor": `Editors look after Knowledge guides and Journal stories in their granted languages. You do not need an editor role to submit your own Journal story or take part in discussions.

## Writing and review

Knowledge direct editing requires Knowledge editor access. Journal editors may revise another writer’s story; ordinary verified members can draft and revise their own stories. Use the relevant editor in [Contribute](/contribute). Drafts stay private and resumable.

Authored articles, translations and revisions go to a different authorised reviewer before publication. The submitted snapshot cannot be silently changed. A request for changes reopens the draft; revise it and submit again. Approved revisions retain the original author and credit other contributors. Read [Writing and editing articles](/knowledge/contributing/writing-and-editing-articles).

## Applying

After five accepted formal changes, open [the application form](/contribute/knowledge/apply) and choose Knowledge editor or Journal editor. Apply separately if you want both. Choose your languages and optional sections, write 20–2,000 characters about your application, optionally add up to five sample links and agree to the guidelines. Accepted changes are attached automatically.

A moderator reads your application. The decision and any requested changes appear in My submissions, and a service email confirms role decisions. Only one application per role can be open; after rejection you can apply for that role again after 30 days. A grant can take up to a minute to appear.

## Editor guidelines

Cite checkable sources, preserve official names, use plain language and keep translations faithful to the source. Submit a record correction for library facts rather than hiding it in an article conversation. Roles are never bought or earned with points.

An editor role alone grants neither direct library editing nor discussion moderation. Public Editor tags describe the author. All discussion messages and edits need another authorised reviewer; [Joining library conversations](${guidePath}) explains the rules.`,
    "writing-and-editing-articles": `Knowledge contains reference guides; the Journal contains stories, interviews and news from the library community. A verified member can submit a Journal story and revise their own stories. Knowledge direct editing requires a Knowledge editor role, and revising another writer’s Journal work requires the appropriate editor access.

## Start with a private draft

Open the relevant editor in [Contribute](/contribute). Add a title, summary, section, language and the relevant topics, places or libraries. Your draft is private and can be resumed. Translate only into languages your role permits, preserving the source’s meaning.

The editor supports paragraphs, headings, emphasis, links, lists, quotes, code, callouts and images. Use Write and Preview to check the result. Cite sources, add accessible image descriptions and only upload pictures you have the right to share.

## Submit and respond to review

Submit for review freezes a snapshot. A different authorised reviewer checks articles and revisions, including those written by editors. If changes are requested, reopen the private draft, respond to the note and submit again. Track the decision in My submissions.

The review checks the version you started from. If the publication has changed, compare the new version and explicitly adopt it before resubmitting. An approved revision keeps the original author; editors and translators receive contributor credit. Unrelated unpublished edits are not published as part of your review.

## Conversations and corrections

An article’s conversation is for questions and discussion. Posting there does not revise the article. Use an article revision or Report an issue for a factual correction or broken link, and correct library facts on the library record itself. [Joining library conversations](${guidePath}) explains public replies and moderation.

## Contribution points

Accepted formal work earns the points shown for the action: a new Journal story 30, a new Knowledge guide 25, a translation 15 and an accepted article edit 8. Membership does not affect review or grant editor access.`,
    "improving-knowledge-articles": `Knowledge editors and the Libraries Global team maintain these guides. You can help by reporting errors, suggesting a revision or asking a question in the article’s conversation.

## Report an issue

Sign in, choose Report an issue and describe the incorrect or outdated information, broken formatting or link, missing information or unclear wording. Quote the passage and add a source where possible. Send for review and follow the result in My submissions. For a missing topic, report it from the closest related guide.

## Editing and translating

Direct editing requires a Knowledge editor role covering the article’s language. Authored revisions and translations go to a different authorised reviewer before publication. If changes are requested, revise the reopened draft and resubmit. The published article retains its original author and credits contributors.

Where a translation is unavailable, readers can see the English guide with a translation notice. Translators should preserve the source’s meaning. After five accepted changes you may [apply to become an editor](/contribute/knowledge/apply).

## Discussing the guide

Use the conversation for a question or an exchange of ideas. A reply does not change the article or replace a formal report. Public messages and proposed edits are moderated; pending content stays private to the author and authorised reviewers. See [Joining library conversations](${guidePath}).`,
    "the-editorial-board": `The editorial board looks after Libraries Global’s content, reviewers and shared checklist decisions. For now, the Libraries Global team carries out this work while the board is being formed.

## Content and review

Board members can edit Knowledge and Journal work across languages and review all moderation queues. Authored articles, revisions and discussion contributions still require a different authorised reviewer. No board member approves their own contribution, and review decisions are logged.

Only the board decides applications to become a moderator. Moderators with Applications access can decide editor applications. Roles are never bought or awarded through points.

## Suggestions and linked conversations

The board reviews the published shortlist at the cutoff shown on Suggestions and explains decisions to add an option or decline it. Votes help establish priorities; a provisional position is not an acceptance decision.

Permitted board managers also curate library and drive feeds: accepting link proposals, featuring or unlinking conversations and choosing whether a feed is visible. These are curation actions. They do not approve messages, transfer ownership or make a restricted thread public. Verified library staff can propose links for their own library.

[Joining library conversations](${guidePath}) explains message review and privacy. For questions about the board, contact info@libraries.global.`,
  },
  fr: {
    "how-to-contribute": `Libraries Global est tenu à jour par les personnes qui l’utilisent. Un compte gratuit et une information sur une bibliothèque suffisent ; aucune connaissance technique ni adhésion payante n’est nécessaire.

## Comment aider

Proposez une correction depuis une fiche, répondez aux questions Oui/Non sur les équipements, partagez une photo ou ajoutez une source publique. Respectez les noms officiels et indiquez d’où vient l’information. Laissez les faits incertains vides.

Utilisez [Ajouter une bibliothèque](/contribute/add-library) pour une fiche manquante. Le formulaire permet aussi de demander une région ou une zone absente. Traduire cette fiche ne modifie que les textes propres à la langue ; les horaires et la position sont communs aux traductions.

Si vous travaillez ou êtes bénévole dans une bibliothèque, demandez votre rattachement pour gérer sa fiche et son flux d’événements après validation. Acheter Team ne valide pas ce rattachement.

Avec un compte vérifié, vous pouvez proposer un article au Journal, suggérer une amélioration ou signaler un problème dans un guide. Modifier directement Knowledge ou réviser le travail d’un autre auteur du Journal demande le rôle d’éditeur adapté à la langue. Les articles et révisions passent devant une autre personne avant publication.

Votez pour les options manquantes dans [Suggestions](/community/suggestions), ou proposez-en une après avoir consulté les correspondances. Elle est vérifiée avant l’ouverture des votes.

## Échanger avec la communauté

[Discussions](/community/discussions) permet de poser une question, partager une idée et suivre une conversation. Les fils peuvent aussi apparaître auprès des bibliothèques, campagnes, articles et suggestions. La lecture publique ne demande pas de compte ; démarrer, répondre, réagir et suivre sont gratuits. Une réponse ne modifie pas une fiche, ne compte pas comme un vote et ne termine pas une tâche. Voir [Participer aux conversations](${guidePath}).

## Vérification, progression et rôles

Suivez vos contributions formelles dans [Mes contributions](/contribute/submissions). Les personnes chargées de la vérification contrôlent les sources et expliquent leur décision. Les messages et modifications de discussion ont leur propre file ; les textes et images en attente restent privés pour leur auteur et les personnes autorisées à les vérifier.

Les contributions formelles acceptées donnent les points indiqués pour chaque action. Un nouveau compte peut en avoir cinq en attente ; ce plafond augmente avec son niveau. Participer à une discussion ne remplace pas ces contributions et n’accorde pas de rôle.

Après cinq modifications acceptées, vous pouvez demander un rôle d’éditeur Knowledge, d’éditeur Journal ou de modérateur. Les rôles ne s’achètent pas et ne s’obtiennent pas avec des points. N’envoyez que des textes et images que vous avez le droit de partager selon les conditions du site.`,
    "roles-and-permissions": `Aucun rôle n’est nécessaire pour lire les fiches, articles et discussions publics. Un compte gratuit vérifié permet de contribuer, proposer un article au Journal et participer aux discussions.

## Rôles, niveaux et adhésion

Les rôles donnent des responsabilités ; les niveaux reflètent les points et les plafonds de contributions formelles ; l’adhésion ajoute des outils de données. Supporter, Pro et Team n’accordent ni rôle communautaire, ni pouvoir de modération, ni points.

## Personnel et éditeurs

Le personnel vérifié gère les bibliothèques couvertes par un rattachement approuvé ou une affectation Team vérifiée. La plupart des modifications de fiche sont publiées directement ; déplacer une bibliothèque, changer son type ou la fermer définitivement demande une vérification. Le personnel peut examiner les propositions d’autrui pour sa bibliothèque, mais pas ses propres contributions ni le rattachement d’une autre personne.

Les éditeurs Knowledge modifient et traduisent les guides dans les langues autorisées. Les éditeurs Journal peuvent réviser les articles d’autres auteurs ; les membres ordinaires peuvent proposer leurs propres articles et révisions. Les articles et révisions demandent une autre personne autorisée pour leur vérification. Être éditeur ou membre du personnel ne donne pas le droit de modérer les discussions.

## Modérateurs et comité éditorial

Les modérateurs interviennent dans leurs files et langues. Index couvre les fiches et demandes associées ; Knowledge et Journal couvrent les articles et signalements ; Discussions couvre les messages, modifications proposées, signalements et restrictions. L’accès Applications concerne les candidatures d’éditeurs. Seul le comité éditorial décide des candidatures de modérateurs.

L’[espace de modération](/contribute/moderation) regroupe les modifications de bibliothèques, articles, rattachements, campagnes, candidatures et discussions. Ces catégories facilitent la navigation sans élargir les droits. Le comité peut examiner toutes les files et langues. Personne ne valide ses propres contributions, y compris ses membres.

## Noms et fils associés

Les signatures publiques peuvent porter les mentions Éditeur, Modérateur ou Comité éditorial. À l’origine de cette suggestion identifie la personne qui a proposé une idée. Un profil privé ou masquant son activité utilise une signature anonyme, sans badge de rôle. Un badge décrit l’auteur ; les commandes de modération exigent toujours l’autorisation adaptée.

Les responsables de flux choisissent les liens et fils mis en avant. Le personnel vérifié peut proposer un lien pour sa bibliothèque. Associer un fil ne valide pas ses messages et ne donne aucun droit de modération. Voir [Participer aux conversations](${guidePath}).

## Demander ou quitter un rôle

Après cinq modifications formelles acceptées, vous pouvez demander un rôle d’éditeur ou de modérateur. Choisissez la file et les langues, notamment Discussions. Une seule candidature par rôle peut être ouverte ; après un refus, le délai est de 30 jours. Les rôles peuvent expirer ou être retirés. Un nouveau droit peut prendre une minute à apparaître.`,
    "becoming-a-moderator": `Les modérateurs vérifient les contributions d’autres personnes, les comparent aux sources et expliquent leurs décisions. Ce rôle est distinct des droits d’éditeur, du personnel de bibliothèque et de l’adhésion payante.

## Choisir une file et des langues

Vous pouvez demander Index, Knowledge, Journal ou Discussions. Index couvre les fiches et demandes associées ; Knowledge et Journal, les articles et signalements. Discussions couvre les nouveaux messages, modifications proposées, messages signalés et restrictions de participation. Les langues autorisées limitent les éléments à examiner. Pour Knowledge et Journal, vous pouvez aussi préciser les sections souhaitées.

L’[espace de modération](/contribute/moderation) regroupe modifications de bibliothèques, articles, rattachements, campagnes, candidatures et discussions. Seuls les éléments de votre périmètre apparaissent. L’accès Applications est attribué séparément ; seul le comité éditorial décide des candidatures de modérateurs.

## Envoyer une candidature

Il faut au moins cinq modifications formelles acceptées. Ouvrez [le formulaire](/contribute/knowledge/apply), choisissez Modérateur, puis la file et les langues. Expliquez votre motivation en 20 à 2 000 caractères, ajoutez éventuellement cinq liens d’exemples au maximum et acceptez les règles. Vos contributions acceptées sont jointes automatiquement.

Une seule candidature par rôle peut être ouverte. Après un refus, vous pouvez redemander ce rôle après 30 jours. La décision et les demandes de modifications figurent dans Mes contributions ; les décisions de rôle sont aussi envoyées par e-mail de service. Ni paiement ni points n’achètent le rôle.

## Vérifier les contributions

Contrôlez les sources, l’exactitude, les doublons et les droits sur les textes et images. Expliquez les refus et demandes de modifications. Comparez une proposition à la version publiée et vérifiez les changements plus récents avant de décider. Chaque décision est enregistrée.

Les textes et images de discussion en attente ne sont visibles que par leur auteur et les personnes autorisées. La version publiée reste visible pendant l’examen d’une modification. Utilisez Discussions pour les messages, signalements et restrictions ; ouvrir un flux associé ne donne pas accès à sa file privée.

## La même règle pour tous

Personne ne valide sa propre contribution, même les modérateurs et membres du comité. Restez dans votre file et vos langues ; demandez des modifications si les preuves sont insuffisantes. Associer ou mettre en avant un fil est une décision distincte. Voir [Participer aux conversations](${guidePath}) et [Comment fonctionne la vérification](/knowledge/governance/how-review-works).`,
    "how-review-works": `Les contributions formelles et les messages de discussion sont vérifiés avant publication. Les articles et révisions demandent également une autre personne autorisée. Le personnel vérifié peut publier directement la plupart des modifications de sa propre fiche ; les changements sensibles restent soumis à modération.

## Un espace, plusieurs catégories

[Modération](/contribute/moderation) regroupe modifications de bibliothèques, articles, rattachements, campagnes, candidatures et discussions. Les files et langues du modérateur déterminent ce qui apparaît. Le comité éditorial peut intervenir dans tous les périmètres et décide des candidatures de modérateurs.

Personne ne valide ses propres contributions. Le personnel vérifié peut examiner la proposition d’une autre personne pour sa bibliothèque. La première décision valide est conservée.

## Contributions formelles

Brouillon signifie enregistré en privé ; Envoyé, en attente ; Modifications nécessaires, avec les précisions du réviseur ; Accepté, approuvé ; Non accepté, avec un motif. Suivez ces états dans [Mes contributions](/contribute/submissions).

L’envoi fige la version examinée. Pour un article, une demande de modifications rouvre un brouillon privé que vous pouvez réviser et renvoyer. Pour les autres contributions, Mes contributions indique l’étape disponible ; sans action de modification, envoyez une nouvelle contribution avec les preuves demandées. Les notes privées de décision ne sont ni une discussion publique ni une messagerie privée.

Les réviseurs contrôlent les sources, l’exactitude, les doublons, les droits sur les textes et photos et le lien déclaré avec la bibliothèque. Ils comparent les valeurs actuelles et proposées. La publication dépend du type de contribution ; Approuver et publier s’utilise lorsque le résultat est prêt. Les décisions sont enregistrées et les modifications acceptées figurent dans l’historique de la fiche.

## Vérifier les discussions

Les nouveaux messages et modifications proposées attendent dans Discussions. Seuls leur auteur et les personnes autorisées voient le contenu en attente. Le texte publié reste visible pendant l’examen d’une modification. La file traite aussi les signalements et restrictions, dans les limites de langue et d’accès du réviseur.

Éditeurs, personnel, modérateurs et comité suivent la même règle : une autre personne autorisée décide. Gérer les liens d’un flux ne valide pas les messages. [Participer aux conversations](${guidePath}) explique les réponses, suivis et règles de confidentialité.

## Décisions et notifications

Les décisions créent une notification privée. Les e-mails facultatifs se règlent dans les préférences ; les rattachements acceptés et décisions de rôle envoient aussi des e-mails de service. Suivre une discussion donne une notification après une contribution approuvée, sans aperçu du contenu en attente. Les délais dépendent de la file.

## Règles de vérification

Évaluez la contribution selon ses preuves, expliquez les modifications demandées, respectez la confidentialité et votre périmètre. Le rôle, le niveau et l’adhésion de l’auteur ne changent pas les critères. Ne validez jamais votre propre travail.`,
    "suggesting-new-options": `Libraries Global utilise des listes communes pour l’accessibilité, les services, les équipements et les types de bibliothèques. Proposez une option lorsqu’il manque un élément que l’on peut vérifier de façon fiable dans une bibliothèque.

## Vérifier les correspondances

Dans [Suggestions](/community/suggestions), utilisez Proposer un élément pour la liste et saisissez ce que vous cherchiez. Les correspondances montrent les options existantes et les idées déjà proposées. Si l’option existe, corrigez la fiche de la bibliothèque. Si l’idée est déjà proposée, votez pour elle ou participez à sa conversation.

Si votre idée est différente, expliquez en quoi, à qui elle sert et comment une bibliothèque peut la confirmer. Choisissez une catégorie et envoyez-la pour vérification. Votre premier vote est enregistré. La proposition en attente reste privée pour son auteur et les réviseurs autorisés jusqu’à validation. Il faut être connecté pour proposer ou voter ; des limites quotidiennes s’appliquent.

## Votes et présélection

Vous pouvez soutenir plusieurs idées, voter une fois pour chacune et retirer votre vote tant que le vote reste ouvert. La page indique la date limite et la présélection provisoire. Le classement peut changer ; une place provisoire ne garantit pas l’acceptation.

Le comité publie ses décisions et leurs motifs. Les idées acceptées peuvent rejoindre la liste adaptée, y compris les types de bibliothèques. Certaines décisions demandent encore un travail de mise en œuvre. Non ajouté explique le refus ou le recours à une option existante. Lisez la décision avant de proposer le même nom.

## Conversations dans les cartes

Lire la conversation ouvre le fil dans la carte. Afficher les réponses précédentes en charge davantage. Ajouter à la conversation envoie un message pour vérification ; cela ne vote pas et ne modifie pas l’idée. Copier le lien mène au même fil, également disponible en discussion complète.

À l’origine de cette suggestion désigne son auteur. Les badges Éditeur, Modérateur et Comité éditorial décrivent les rôles publics. Chaque message et modification est vérifié par une autre personne autorisée, même pour les membres de l’équipe. Le contenu en attente reste privé. Voir [Participer aux conversations](${guidePath}).

## Si des modifications sont demandées

Lisez le retour privé puis utilisez l’action disponible pour renvoyer la proposition, ou le formulaire avec le même nom et les modifications demandées. Une proposition refusée n’est pas une option publique. Vote, réponse et correction de fiche sont des actions distinctes.`,
    "becoming-an-editor": `Les éditeurs gèrent les guides Knowledge et les articles du Journal dans leurs langues autorisées. Vous n’avez pas besoin de ce rôle pour proposer votre propre article au Journal ou participer aux discussions.

## Rédiger et faire vérifier

Modifier directement Knowledge exige le rôle correspondant. Les éditeurs Journal peuvent réviser le travail d’autres auteurs ; les membres vérifiés peuvent rédiger et réviser leurs propres articles. Ouvrez l’éditeur adapté dans [Contribute](/contribute). Les brouillons sont privés et peuvent être repris.

Articles, traductions et révisions passent devant une autre personne autorisée avant publication. La version envoyée ne peut pas changer discrètement. Une demande de modifications rouvre le brouillon ; corrigez-le et renvoyez-le. Une révision approuvée conserve l’auteur d’origine et crédite les autres contributeurs. Voir [Rédiger et modifier des articles](/knowledge/contributing/writing-and-editing-articles).

## Candidater

Après cinq modifications formelles acceptées, ouvrez [le formulaire](/contribute/knowledge/apply) et choisissez Éditeur Knowledge ou Éditeur Journal. Envoyez une candidature distincte pour chaque rôle. Choisissez les langues et sections éventuelles, expliquez votre motivation en 20 à 2 000 caractères, ajoutez au maximum cinq exemples et acceptez les règles. Les contributions acceptées sont jointes automatiquement.

Un modérateur lit la candidature. La décision et les demandes de modifications apparaissent dans Mes contributions ; les décisions de rôle sont aussi envoyées par e-mail. Une seule candidature par rôle peut être ouverte. Après un refus, le délai est de 30 jours. Un droit peut prendre une minute à apparaître.

## Règles éditoriales

Citez des sources vérifiables, respectez les noms officiels, utilisez un langage simple et traduisez fidèlement. Corrigez les faits d’une bibliothèque sur sa fiche plutôt que dans une conversation d’article. Les rôles ne s’achètent pas et ne s’obtiennent pas avec des points.

Être éditeur ne donne ni accès direct aux fiches ni pouvoir de modérer les discussions. Le badge Éditeur décrit l’auteur. Chaque message et modification demande une autre personne autorisée ; voir [Participer aux conversations](${guidePath}).`,
    "writing-and-editing-articles": `Knowledge rassemble les guides de référence ; le Journal, les récits, entretiens et nouvelles de la communauté. Un membre vérifié peut proposer un article au Journal et réviser ses propres articles. Modifier directement Knowledge demande le rôle d’éditeur Knowledge ; réviser le travail d’un autre auteur demande les droits Journal adaptés.

## Commencer par un brouillon privé

Ouvrez l’éditeur adapté dans [Contribute](/contribute). Ajoutez un titre, un résumé, une section, une langue et les sujets, lieux ou bibliothèques pertinents. Le brouillon reste privé et peut être repris. Ne traduisez que dans vos langues autorisées, en respectant le sens de la source.

L’éditeur propose paragraphes, titres, emphase, liens, listes, citations, code, encadrés et images. Vérifiez le rendu avec Écriture et Aperçu. Citez les sources, décrivez les images pour l’accessibilité et ne partagez que celles pour lesquelles vous disposez des droits.

## Envoyer et répondre à la vérification

Envoyer pour vérification fige une version. Une autre personne autorisée examine articles et révisions, y compris ceux des éditeurs. Si des modifications sont demandées, reprenez le brouillon privé, répondez à la note et renvoyez-le. Suivez la décision dans Mes contributions.

La vérification tient compte de la version de départ. Si l’article a changé, comparez la publication actuelle et adoptez explicitement cette version avant de renvoyer votre travail. Une révision approuvée conserve l’auteur d’origine et crédite éditeurs et traducteurs. Les brouillons sans rapport ne sont pas publiés avec elle.

## Conversations et corrections

La conversation d’un article sert aux questions et échanges. Y répondre ne révise pas l’article. Utilisez une révision ou Signaler un problème pour corriger un fait ou un lien, et la fiche de bibliothèque pour ses propres données. Voir [Participer aux conversations](${guidePath}).

## Points

Le travail formel accepté donne les points de l’action : 30 pour un nouvel article Journal, 25 pour un guide Knowledge, 15 pour une traduction et 8 pour une modification d’article. L’adhésion ne change ni la vérification ni les droits d’éditeur.`,
    "improving-knowledge-articles": `Les éditeurs Knowledge et l’équipe Libraries Global entretiennent ces guides. Vous pouvez signaler une erreur, proposer une révision ou poser une question dans la conversation de l’article.

## Signaler un problème

Connectez-vous, choisissez Signaler un problème et décrivez l’information incorrecte ou périmée, le lien ou formatage cassé, l’élément manquant ou la formulation peu claire. Citez le passage et ajoutez une source si possible. Envoyez pour vérification et suivez la décision dans Mes contributions. Pour un sujet absent, partez du guide le plus proche.

## Modifier et traduire

La modification directe demande le rôle d’éditeur Knowledge dans la langue concernée. Révisions et traductions passent devant une autre personne autorisée avant publication. Si des modifications sont demandées, corrigez le brouillon rouvert et renvoyez-le. L’article conserve son auteur d’origine et crédite les contributeurs.

Si aucune traduction n’existe, la version anglaise peut être affichée avec une mention. Les traductions doivent respecter le sens de la source. Après cinq modifications acceptées, vous pouvez [demander un rôle d’éditeur](/contribute/knowledge/apply).

## Échanger sur le guide

Utilisez la conversation pour poser une question ou partager une idée. Une réponse ne modifie pas l’article et ne remplace pas un signalement. Messages et modifications sont modérés ; le contenu en attente reste privé pour l’auteur et les réviseurs autorisés. Voir [Participer aux conversations](${guidePath}).`,
    "the-editorial-board": `Le comité éditorial veille au contenu de Libraries Global, aux réviseurs et aux décisions sur les listes communes. L’équipe Libraries Global assure actuellement ce travail pendant sa constitution.

## Contenu et vérification

Les membres peuvent modifier Knowledge et Journal dans toutes les langues et examiner toutes les files. Leurs articles, révisions et messages de discussion demandent toujours une autre personne autorisée. Personne ne valide ses propres contributions et chaque décision est enregistrée.

Seul le comité décide des candidatures de modérateurs. Les modérateurs ayant accès à Applications peuvent décider des candidatures d’éditeurs. Les rôles ne s’achètent pas et ne s’obtiennent pas avec des points.

## Suggestions et conversations associées

Le comité examine la présélection à la date limite indiquée sur Suggestions et explique ses décisions d’ajouter ou refuser une option. Les votes aident à établir les priorités ; une position provisoire n’est pas une acceptation.

Les responsables autorisés gèrent aussi les flux des bibliothèques et campagnes : accepter une proposition de lien, mettre un fil en avant, retirer son association ou masquer le flux. Ces actions ne valident pas les messages, ne changent pas le propriétaire et ne rendent pas public un fil restreint. Le personnel vérifié peut proposer des liens pour sa bibliothèque.

[Participer aux conversations](${guidePath}) explique la vérification et la confidentialité. Pour toute question sur le comité, écrivez à info@libraries.global.`,
  },
  cs: {
    "how-to-contribute": `Libraries Global aktualizují lidé, kteří jej používají. Stačí bezplatný účet a informace o knihovně; nepotřebujete technické znalosti ani placené členství.

## Jak pomoci

Na stránce knihovny navrhněte opravu, odpovězte na otázky Ano/Ne o vybavení, přidejte fotografii nebo veřejný zdroj. Zachovejte oficiální názvy a uveďte původ informací. Nejisté údaje nevyplňujte.

Chybějící záznam přidejte přes [Přidat knihovnu](/contribute/add-library). Ve formuláři lze požádat také o chybějící region či oblast. Překlad záznamu mění pouze text v daném jazyce; otevírací doba a poloha zůstávají společné.

Pokud v knihovně pracujete nebo působíte jako dobrovolník, požádejte o přístup zaměstnance. Po schválení můžete spravovat záznam a zdroj akcí. Zakoupení Team tento vztah neověřuje.

S ověřeným účtem můžete zaslat článek do Journal, navrhnout úpravu článku nebo nahlásit problém v Knowledge. Přímé úpravy Knowledge a revize článků jiných autorů vyžadují příslušnou redakční roli pro daný jazyk. Články a revize před zveřejněním kontroluje jiná oprávněná osoba.

Na stránce [Návrhy](/community/suggestions) hlasujte pro chybějící možnosti seznamu nebo po kontrole shod navrhněte novou. Před otevřením hlasování projde kontrolou.

## Zapojte se do rozhovoru

[Diskuse](/community/discussions) slouží k otázkám, sdílení nápadů a sledování rozhovorů. Vlákna se mohou zobrazovat také u knihoven, kampaní, článků a návrhů. Veřejné diskuse lze číst bez účtu; založení, odpovědi, reakce a sledování jsou zdarma. Odpověď neopravuje záznam, není hlasem a nedokončuje úkol kampaně. Viz [Zapojení do knihovních diskusí](${guidePath}).

## Kontrola, postup a role

Formální příspěvky sledujte v [Mých příspěvcích](/contribute/submissions). Kontrolující ověří zdroje a vysvětlí rozhodnutí. Zprávy a úpravy diskusí mají vlastní frontu; čekající text i obrázky vidí jen autor a oprávnění kontrolující.

Přijaté formální příspěvky získávají body uvedené u dané akce. Nový účet může mít pět příspěvků čekajících na kontrolu; limit roste s úrovní. Diskusní účast je nenahrazuje a neuděluje roli.

Po pěti přijatých změnách můžete požádat o roli editora Knowledge, editora Journal nebo moderátora. Role se nekupují ani nezískávají za body. Posílejte pouze text a obrázky, které smíte sdílet podle podmínek webu.`,
    "roles-and-permissions": `Ke čtení veřejných záznamů, článků a diskusí nepotřebujete roli. Bezplatný ověřený účet umožňuje přispívat, zasílat články do Journal a účastnit se diskusí.

## Role, úrovně a členství

Role určují odpovědnost, úrovně odrážejí body a limity formálních příspěvků a členství přidává datové nástroje. Supporter, Pro ani Team neudělují komunitní roli, oprávnění ke kontrole ani body.

## Zaměstnanci a editoři

Ověření zaměstnanci spravují knihovny pokryté schválenou žádostí nebo ověřeným přiřazením Team. Většina úprav se publikuje přímo; přesun knihovny, změna typu nebo trvalé uzavření vyžadují kontrolu. Zaměstnanec může posoudit cizí návrh ke své knihovně, ne vlastní příspěvek ani žádost jiného člověka o přístup.

Editoři Knowledge upravují a překládají příručky v povolených jazycích. Editoři Journal mohou revidovat práce jiných autorů; běžní členové zasílají vlastní články a jejich revize. Články a revize musí zkontrolovat jiná oprávněná osoba. Role editora ani zaměstnance sama nedává oprávnění moderovat diskuse.

## Moderátoři a redakční rada

Moderátoři pracují ve svých frontách a jazycích. Index pokrývá záznamy a související žádosti, Knowledge a Journal články a hlášení, Discussions zprávy, navrhované úpravy, hlášení a omezení účasti. Přístup Applications slouží žádostem o redakční role. O žádostech moderátorů rozhoduje pouze redakční rada.

[Moderační prostor](/contribute/moderation) seskupuje změny knihoven, články, žádosti o přístup, kampaně, žádosti o role a diskuse. Kategorie pomáhají s orientací, nerozšiřují oprávnění. Rada může kontrolovat všechny fronty a jazyky. Nikdo neschvaluje vlastní příspěvky, ani členové rady.

## Jména a propojená vlákna

Veřejná jména mohou mít štítky Editor, Moderátor nebo Redakční rada. Navrhl/a toto označuje autora návrhu. Soukromý profil nebo profil se skrytou aktivitou používá anonymní označení bez štítků rolí. Štítek popisuje autora; ovládání kontroly stále vyžaduje příslušné oprávnění.

Správci přehledů vybírají odkazy a zvýrazněná vlákna. Ověření zaměstnanci mohou navrhnout propojení pro svou knihovnu. Připojení vlákna neschvaluje zprávy a nedává moderační práva. Viz [Zapojení do knihovních diskusí](${guidePath}).

## Žádost a ukončení role

Po pěti přijatých formálních změnách můžete požádat o redakční či moderační roli. U moderátora vyberte frontu a jazyky, včetně Discussions. Pro každou roli může být otevřena jedna žádost; po zamítnutí lze požádat znovu za 30 dní. Role mohou vypršet nebo být odebrány. Nové oprávnění se může projevit do minuty.`,
    "becoming-a-moderator": `Moderátoři kontrolují příspěvky ostatních, porovnávají je se zdroji a vysvětlují rozhodnutí. Role je oddělená od redakčních práv, přístupu zaměstnanců knihoven a placeného členství.

## Vyberte frontu a jazyky

Můžete požádat o Index, Knowledge, Journal nebo Discussions. Index zahrnuje záznamy a související žádosti; Knowledge a Journal články a hlášení. Discussions pokrývá nové zprávy, navrhované úpravy, nahlášené zprávy a omezení účasti. Jazyková oprávnění omezují dostupné položky. U Knowledge a Journal lze uvést také preferované sekce.

[Moderační prostor](/contribute/moderation) seskupuje změny knihoven, články, žádosti o přístup, kampaně, žádosti o role a diskuse. Zobrazuje jen práci ve vašem rozsahu. Applications se přiděluje samostatně; žádosti moderátorů rozhoduje pouze redakční rada.

## Podání žádosti

Potřebujete nejméně pět přijatých formálních změn. Otevřete [formulář](/contribute/knowledge/apply), vyberte Moderátor a zvolte frontu a jazyky. Napište 20–2 000 znaků o své motivaci, případně přidejte nejvýše pět ukázek a potvrďte pravidla. Přijaté příspěvky se připojí automaticky.

Pro každou roli lze mít jednu otevřenou žádost. Po zamítnutí lze o stejnou roli požádat za 30 dní. Rozhodnutí a požadované změny se zobrazí v Mých příspěvcích; rozhodnutí o roli přijde také služebním e-mailem. Role se nekupuje ani nezískává za body.

## Kontrola příspěvků

Ověřte zdroje, správnost, duplicity a práva k textu a obrázkům. Vysvětlete zamítnutí a požadované změny. Porovnejte návrh s publikovanou verzí a před rozhodnutím zkontrolujte novější úpravy. Každé rozhodnutí se zaznamenává.

Čekající diskusní text a obrázky vidí jen autor a oprávnění kontrolující. Zveřejněná verze zůstává viditelná během kontroly úpravy. Zprávy, hlášení a omezení řešte ve Discussions; otevření propojeného přehledu nedává přístup do soukromé fronty.

## Stejné pravidlo pro všechny

Nikdo neschvaluje vlastní příspěvek, ani moderátor či člen rady. Dodržujte rozsah fronty a jazyků; při nedostatku důkazů požádejte o změny. Propojování a zvýrazňování vláken je samostatné rozhodnutí. Viz [Zapojení do knihovních diskusí](${guidePath}) a [Jak funguje kontrola](/knowledge/governance/how-review-works).`,
    "how-review-works": `Formální příspěvky a diskusní zprávy procházejí kontrolou před zveřejněním. Články a revize musí také zkontrolovat jiná oprávněná osoba. Ověření zaměstnanci mohou většinu změn své knihovny publikovat přímo; citlivé změny stále podléhají moderaci.

## Jeden prostor, různé kategorie

[Moderace](/contribute/moderation) seskupuje změny knihoven, články, žádosti o přístup, kampaně, žádosti o role a diskuse. Fronty a jazyky moderátora určují, co se zobrazí. Redakční rada může kontrolovat napříč rozsahy a rozhoduje žádosti o roli moderátora.

Nikdo neschvaluje vlastní příspěvky. Ověření zaměstnanci mohou posoudit cizí návrh ke své knihovně. Platí první oprávněné rozhodnutí.

## Formální příspěvky

Koncept znamená soukromě uložený návrh. Odesláno znamená čekání na kontrolu. Vyžaduje změny obsahuje vysvětlení kontrolujícího. Přijato znamená schváleno a Nepřijato obsahuje důvod. Stav a poznámky sledujte v [Mých příspěvcích](/contribute/submissions).

Odeslání zmrazí kontrolovanou verzi. U článků žádost o změny znovu otevře soukromý koncept k úpravě a odeslání. U ostatních typů ukazují Mé příspěvky další dostupný krok; bez možnosti úpravy pošlete nový příspěvek s požadovanými zdroji. Soukromé poznámky k rozhodnutí nejsou veřejná diskuse ani soukromý chat.

Kontrolující ověřují zdroje, správnost, duplicity, práva k textu a fotografiím a vztah žadatele ke knihovně. Porovnávají aktuální a navrhované hodnoty. Publikace závisí na typu příspěvku; Schválit a publikovat použijte jen u hotového výsledku. Rozhodnutí se zaznamenávají a přijaté změny se objeví v historii záznamu.

## Kontrola diskusí

Nové zprávy a navrhované úpravy čekají ve Discussions. Čekající obsah vidí jen autor a oprávnění kontrolující. Publikovaný text zůstává viditelný během kontroly úpravy. Fronta řeší také hlášení a omezení účasti v rámci jazykových a přístupových práv.

Editoři, zaměstnanci, moderátoři i rada dodržují stejné pravidlo: rozhoduje jiná oprávněná osoba. Správa propojení přehledu neschvaluje zprávy. [Zapojení do knihovních diskusí](${guidePath}) vysvětluje odpovědi, sledování a soukromí.

## Rozhodnutí a oznámení

Rozhodnutí vytvářejí soukromá oznámení. Volitelné e-maily lze nastavit v předvolbách; schválení přístupu zaměstnance a rozhodnutí o roli posílají i služební e-mail. Sledovaná diskuse upozorní po schválení nového příspěvku bez náhledu čekajícího textu. Doba kontroly závisí na frontě.

## Pravidla kontroly

Posuzujte příspěvek podle důkazů, vysvětlete požadované změny, respektujte soukromí a svůj rozsah. Role, úroveň ani členství autora nemění měřítka. Nikdy neschvalujte vlastní práci.`,
    "suggesting-new-options": `Libraries Global používá společné seznamy přístupnosti, služeb, vybavení a typů knihoven. Navrhněte možnost, pokud chybí něco, co lze v knihovně spolehlivě ověřit.

## Nejprve zkontrolujte shody

Na stránce [Návrhy](/community/suggestions) použijte Navrhnout položku do seznamu a napište, co jste hledali. Shody ukazují existující možnosti a dřívější návrhy. Pokud možnost existuje, opravte záznam knihovny. Pokud ji už někdo navrhl, hlasujte pro ni nebo se zapojte do její diskuse.

Pokud je váš nápad jiný, vysvětlete rozdíl, komu pomůže a jak jej knihovna ověří. Zvolte kategorii a odešlete jej ke kontrole. První hlas se uloží. Čekající návrh vidí do schválení jen autor a oprávnění kontrolující. Pro navrhování a hlasování se přihlaste; platí denní limity.

## Hlasování a užší výběr

Můžete podpořit více nápadů, každý jednou, a hlas během otevřeného hlasování vzít zpět. Stránka ukazuje uzávěrku a předběžný užší výběr. Pořadí se může měnit a předběžné místo nezaručuje přijetí.

Rada zveřejňuje rozhodnutí i důvody. Přijaté návrhy lze přidat do příslušného seznamu včetně typů knihoven. Některá rozhodnutí mohou vyžadovat další implementaci. Nepřidáno vysvětluje zamítnutí nebo využití existující možnosti. Před opakováním stejného názvu si rozhodnutí přečtěte.

## Diskuse uvnitř karet

Přečíst diskusi otevře vlákno v kartě. Zobrazit dřívější odpovědi načte další příspěvky. Přidat do diskuse odešle zprávu ke kontrole; nehlasuje ani nemění návrh. Kopírovat odkaz vede na stejné vlákno, které lze otevřít také jako úplnou diskusi.

Navrhl/a toto označuje původního navrhovatele. Štítky Editor, Moderátor a Redakční rada popisují veřejné role. Každou zprávu a úpravu kontroluje jiná oprávněná osoba, i u členů týmu. Čekající obsah zůstává soukromý. Viz [Zapojení do knihovních diskusí](${guidePath}).

## Když návrh vyžaduje změny

Přečtěte si soukromou zpětnou vazbu a použijte dostupnou akci k opětovnému odeslání nebo formulář se stejným názvem a požadovanými změnami. Zamítnutý návrh není veřejnou položkou seznamu. Hlas, odpověď a oprava knihovny jsou oddělené akce.`,
    "becoming-an-editor": `Editoři spravují příručky Knowledge a články Journal v povolených jazycích. K zaslání vlastního článku do Journal ani k účasti v diskusi tuto roli nepotřebujete.

## Psaní a kontrola

Přímé úpravy Knowledge vyžadují příslušnou roli. Editoři Journal mohou revidovat práci jiných autorů; ověření členové mohou psát a revidovat vlastní články. Otevřete odpovídající editor v [Přispět](/contribute). Koncepty jsou soukromé a lze v nich pokračovat.

Články, překlady a revize před publikací kontroluje jiná oprávněná osoba. Odeslaná verze se nemůže skrytě měnit. Žádost o změny znovu otevře koncept; upravte jej a odešlete znovu. Schválená revize zachová původního autora a uvede další přispěvatele. Viz [Psaní a úpravy článků](/knowledge/contributing/writing-and-editing-articles).

## Podání žádosti

Po pěti přijatých formálních změnách otevřete [formulář](/contribute/knowledge/apply) a zvolte Editor Knowledge nebo Editor Journal. Pro obě role pošlete oddělené žádosti. Vyberte jazyky a případně sekce, napište 20–2 000 znaků, přidejte nejvýše pět ukázek a potvrďte pravidla. Přijaté příspěvky se připojí automaticky.

Žádost čte moderátor. Rozhodnutí a požadované změny jsou v Mých příspěvcích; rozhodnutí o roli přijde i e-mailem. Pro každou roli může být otevřena jedna žádost. Po zamítnutí lze požádat znovu za 30 dní. Nové oprávnění se může projevit do minuty.

## Redakční pravidla

Uvádějte ověřitelné zdroje, zachovejte oficiální názvy, pište srozumitelně a překládejte věrně. Údaje knihovny opravujte v jejím záznamu, nikoli pouze v diskusi u článku. Role se nekupují ani nezískávají za body.

Redakční role sama nedává přímé úpravy knihoven ani moderační práva. Veřejný štítek Editor popisuje autora. Každou diskusní zprávu a úpravu kontroluje jiná oprávněná osoba; viz [Zapojení do knihovních diskusí](${guidePath}).`,
    "writing-and-editing-articles": `Knowledge obsahuje referenční příručky; Journal příběhy, rozhovory a zprávy knihovní komunity. Ověřený člen může zaslat článek do Journal a revidovat vlastní články. Přímá úprava Knowledge vyžaduje roli editora Knowledge; revize práce jiného autora odpovídající oprávnění Journal.

## Začněte soukromým konceptem

Otevřete editor v [Přispět](/contribute). Přidejte název, shrnutí, sekci, jazyk a související témata, místa či knihovny. Koncept je soukromý a lze se k němu vrátit. Překládejte pouze do povolených jazyků a zachovejte význam zdroje.

Editor podporuje odstavce, nadpisy, zvýraznění, odkazy, seznamy, citace, kód, upozornění a obrázky. Výsledek ověřte v režimech Psaní a Náhled. Uveďte zdroje, přidejte přístupné popisy obrázků a sdílejte pouze fotografie, ke kterým máte práva.

## Odeslání a připomínky

Odeslat ke kontrole zmrazí verzi. Články a revize, včetně práce editorů, posuzuje jiná oprávněná osoba. Při požadavku na změny otevřete soukromý koncept, zapracujte poznámku a odešlete znovu. Rozhodnutí sledujte v Mých příspěvcích.

Kontrola vychází z verze, od které jste začali. Pokud se publikace změnila, porovnejte aktuální znění a před opětovným odesláním je výslovně přijměte jako základ. Schválená revize zachová původního autora a uvede editory a překladatele. Nesouvisející koncepty se s ní nepublikují.

## Diskuse a opravy

Diskuse u článku slouží otázkám a výměně názorů. Odpověď článek neopravuje. Pro věcnou chybu či nefunkční odkaz použijte revizi nebo Nahlásit problém; údaje knihovny opravte v jejím záznamu. Viz [Zapojení do knihovních diskusí](${guidePath}).

## Body

Přijatá formální práce přináší body uvedené u akce: nový článek Journal 30, příručka Knowledge 25, překlad 15 a přijatá úprava článku 8. Členství nemění kontrolu ani neuděluje redakční přístup.`,
    "improving-knowledge-articles": `Příručky Knowledge spravují editoři a tým Libraries Global. Pomozte nahlášením chyby, návrhem revize nebo otázkou v diskusi u článku.

## Nahlášení problému

Přihlaste se, zvolte Nahlásit problém a popište chybnou či zastaralou informaci, rozbité formátování nebo odkaz, chybějící obsah či nejasné znění. Citujte pasáž a pokud možno přidejte zdroj. Odešlete ke kontrole a výsledek sledujte v Mých příspěvcích. Chybějící téma nahlaste z nejbližší související příručky.

## Úpravy a překlady

Přímé úpravy vyžadují roli editora Knowledge pro daný jazyk. Revize a překlady před zveřejněním kontroluje jiná oprávněná osoba. Při požadavku na změny upravte znovu otevřený koncept a odešlete jej. Publikace zachová původního autora a uvede přispěvatele.

Není-li překlad dostupný, může se zobrazit anglická verze s upozorněním. Překlad má zachovat význam zdroje. Po pěti přijatých změnách můžete [požádat o redakční roli](/contribute/knowledge/apply).

## Rozhovor o příručce

Diskusi použijte pro otázky a nápady. Odpověď nemění článek ani nenahrazuje formální hlášení. Zprávy a úpravy se moderují; čekající obsah je soukromý pro autora a oprávněné kontrolující. Viz [Zapojení do knihovních diskusí](${guidePath}).`,
    "the-editorial-board": `Redakční rada pečuje o obsah Libraries Global, kontrolující a rozhodnutí o společných seznamech. Než se rada ustaví, tuto práci vykonává tým Libraries Global.

## Obsah a kontrola

Členové mohou upravovat Knowledge a Journal ve všech jazycích a kontrolovat všechny fronty. Jejich články, revize a diskusní příspěvky stále musí posoudit jiná oprávněná osoba. Nikdo neschvaluje vlastní příspěvky a rozhodnutí se zaznamenávají.

O žádostech moderátorů rozhoduje pouze rada. Moderátoři s přístupem Applications mohou rozhodovat žádosti editorů. Role se nekupují ani nezískávají za body.

## Návrhy a propojené diskuse

Rada posuzuje užší výběr k datu uzávěrky uvedenému na stránce Návrhy a vysvětluje přijetí či zamítnutí možnosti. Hlasy pomáhají určit priority; předběžné pořadí není rozhodnutím o přijetí.

Oprávnění správci také vybírají obsah přehledů knihoven a kampaní: přijímají návrhy propojení, zvýrazňují či odpojují vlákna a určují viditelnost přehledu. Tyto akce neschvalují zprávy, nepřevádějí vlastnictví ani nezveřejňují omezené vlákno. Ověření zaměstnanci mohou navrhovat propojení pro svou knihovnu.

[Zapojení do knihovních diskusí](${guidePath}) vysvětluje kontrolu a soukromí. S dotazy k radě pište na info@libraries.global.`,
  },
}

const additions = {
  en: {
    "plans-and-pro": `## Discussions are free

Read public discussions without an account. Starting a thread, replying, reacting and following are included in a free verified account. Supporter, Pro and Team do not grant discussion moderation. [Joining library conversations](${guidePath}) explains the review and privacy rules.`,
    "reading-a-library-page": `## Conversations about this library

A Conversations section can show threads associated with the library. Choose a language filter, read the original discussion or start one with a verified account. A thread linked to a drive or another page shares the same messages and decisions wherever it appears. Pending content remains private; linking it does not change its access rules.

A discussion does not correct library facts. Use the record’s correction action for an address, hours or facility. Following a library is separate from following its discussion. See [Joining library conversations](${guidePath}).`,
    "staff-area": `## Conversations for your library

The library’s shared conversation feed can reuse an existing discussion. Verified staff can propose links for their own libraries; permitted feed managers decide associations, featuring and visibility. Removing a feed link does not delete the thread.

Staff access and Team seats do not grant discussion moderation. New messages and edits, including yours, require a different authorised reviewer and stay private until accepted. Use a record edit for library facts. See [Joining library conversations](${guidePath}).`,
    "your-account-and-profile": `## Your discussion preferences

New message forms use your selected writing language first, then your profile languages, your optional profile country as a hint and the interface fallback. You can change the language before sending. Reading all languages does not change your writing choice.

Follow a discussion for inbox updates after new contributions are approved. These follows are separate from library or drive follows, and notifications do not preview pending text. Private or activity-hidden profiles use anonymous bylines without role tags; words already published in a public thread remain public. See [Joining library conversations](${guidePath}).`,
    "deleting-your-account": `## Discussion content and deletion

Accepted public discussion text can remain with its author attribution removed. Your private unpublished messages and revision proposals, reports, reactions and discussion follows are removed through account erasure. A private profile does not hide text already published publicly. See [Joining library conversations](${guidePath}) and the [privacy notice](/legal/privacy).

Account deletion first stops billing and is refused if cancellation cannot be confirmed. Independent access and payment records follow the retention rules in the membership and privacy notices; deletion does not erase emails already delivered to your inbox.`,
    "teams-for-library-services": `## Shared conversations

Discussion participation is free for every verified account. A library or drive can reuse an existing thread, with one shared set of messages and review decisions. Staff may propose links for their own library; permitted managers curate feeds. A Team organiser or seat does not grant discussion moderation. See [Joining library conversations](${guidePath}).`,
  },
  fr: {
    "plans-and-pro": `## Les discussions sont gratuites

Lisez les discussions publiques sans compte. Démarrer un fil, répondre, réagir et suivre sont inclus dans un compte gratuit vérifié. Supporter, Pro et Team ne donnent aucun droit de modération. [Participer aux conversations](${guidePath}) explique la vérification et la confidentialité.`,
    "reading-a-library-page": `## Conversations sur cette bibliothèque

Une section Conversations peut afficher les fils associés à la bibliothèque. Filtrez par langue, ouvrez la discussion d’origine ou démarrez-en une avec un compte vérifié. Un fil associé à une campagne ou une autre page conserve partout les mêmes messages et décisions. Le contenu en attente reste privé ; l’association ne change pas ses droits d’accès.

Une discussion ne corrige pas les données. Utilisez la correction de fiche pour une adresse, des horaires ou un équipement. Suivre une bibliothèque est distinct de suivre sa discussion. Voir [Participer aux conversations](${guidePath}).`,
    "staff-area": `## Conversations pour votre bibliothèque

Le flux partagé peut reprendre une discussion existante. Le personnel vérifié peut proposer des liens pour ses bibliothèques ; les responsables autorisés décident des associations, mises en avant et de la visibilité. Retirer un lien ne supprime pas le fil.

L’accès du personnel et les places Team ne donnent pas de droit de modération. Chaque message et modification, y compris les vôtres, attend la validation d’une autre personne autorisée et reste privé jusque-là. Utilisez une modification de fiche pour les faits. Voir [Participer aux conversations](${guidePath}).`,
    "your-account-and-profile": `## Vos préférences de discussion

Les formulaires utilisent d’abord la langue de rédaction choisie, puis les langues du profil, le pays facultatif comme indice et enfin la langue de l’interface par défaut. Vous pouvez changer la sélection avant l’envoi. Lire toutes les langues ne change pas ce choix.

Suivre une discussion donne des notifications après l’approbation de nouveaux messages. Ces suivis sont distincts de ceux des bibliothèques et campagnes ; les notifications ne dévoilent pas le texte en attente. Les profils privés ou masquant leur activité utilisent une signature anonyme, sans badge de rôle. Les textes déjà publiés dans un fil public restent publics. Voir [Participer aux conversations](${guidePath}).`,
    "deleting-your-account": `## Discussions et suppression

Le texte public accepté peut être conservé sans attribution à votre compte. Vos messages et propositions de révision non publiés, signalements, réactions et suivis sont supprimés lors de l’effacement du compte. Un profil privé ne masque pas un texte déjà publié. Voir [Participer aux conversations](${guidePath}) et la [politique de confidentialité](/legal/privacy).

La suppression arrête d’abord la facturation et est refusée si l’annulation ne peut pas être confirmée. Les droits d’accès indépendants et données de paiement suivent les règles de conservation des notices d’adhésion et de confidentialité. Les e-mails déjà reçus ne sont pas effacés.`,
    "teams-for-library-services": `## Conversations partagées

La participation est gratuite pour tout compte vérifié. Une bibliothèque ou campagne peut reprendre un fil existant avec les mêmes messages et décisions. Le personnel propose les liens pour sa bibliothèque ; les responsables autorisés gèrent les flux. Être organisateur Team ou occuper une place ne donne pas de droit de modération. Voir [Participer aux conversations](${guidePath}).`,
  },
  cs: {
    "plans-and-pro": `## Diskuse jsou zdarma

Veřejné diskuse čtěte bez účtu. Zakládání vláken, odpovědi, reakce a sledování jsou součástí bezplatného ověřeného účtu. Supporter, Pro ani Team nedávají moderační práva. [Zapojení do knihovních diskusí](${guidePath}) vysvětluje kontrolu a soukromí.`,
    "reading-a-library-page": `## Diskuse o knihovně

Sekce Diskuse může zobrazovat vlákna spojená s knihovnou. Vyberte jazykový filtr, otevřete původní diskusi nebo založte novou s ověřeným účtem. Vlákno připojené ke kampani nebo jiné stránce všude sdílí stejné zprávy a rozhodnutí. Čekající obsah zůstává soukromý; propojení nemění přístupová pravidla.

Diskuse neopravuje údaje knihovny. Adresu, otevírací dobu či vybavení změňte návrhem opravy záznamu. Sledování knihovny a její diskuse jsou oddělené. Viz [Zapojení do knihovních diskusí](${guidePath}).`,
    "staff-area": `## Diskuse pro vaši knihovnu

Sdílený přehled může použít existující diskusi. Ověření zaměstnanci navrhují propojení pro své knihovny; oprávnění správci rozhodují o připojení, zvýraznění a viditelnosti. Odstranění odkazu nemaže vlákno.

Zaměstnanecký přístup ani místo v Team nedává moderační práva. Každou zprávu a úpravu včetně vaší musí posoudit jiná oprávněná osoba; do schválení zůstává soukromá. Fakta měňte úpravou záznamu. Viz [Zapojení do knihovních diskusí](${guidePath}).`,
    "your-account-and-profile": `## Předvolby diskusí

Formuláře nejprve použijí zvolený jazyk psaní, potom jazyky profilu, volitelnou zemi jako vodítko a nakonec výchozí jazyk rozhraní. Před odesláním lze výběr změnit. Čtení ve všech jazycích tuto volbu nemění.

Sledování diskuse přináší oznámení po schválení nových příspěvků. Je oddělené od sledování knihoven a kampaní; oznámení neodhalují čekající text. Soukromé profily a profily se skrytou aktivitou používají anonymní označení bez štítků rolí. Text již zveřejněný ve veřejném vlákně zůstává veřejný. Viz [Zapojení do knihovních diskusí](${guidePath}).`,
    "deleting-your-account": `## Diskuse a smazání účtu

Přijatý veřejný text může zůstat bez uvedení vašeho účtu. Soukromé nepublikované zprávy a návrhy revizí, vaše hlášení, reakce a sledování diskusí se při výmazu odstraní. Soukromý profil neskryje již zveřejněný text. Viz [Zapojení do knihovních diskusí](${guidePath}) a [zásady soukromí](/legal/privacy).

Smazání nejprve zastaví fakturaci a je odmítnuto, pokud zrušení nelze potvrdit. Nezávislá přístupová oprávnění a platební údaje se řídí pravidly uchovávání v podmínkách členství a zásadách soukromí. Již doručené e-maily se nesmažou.`,
    "teams-for-library-services": `## Sdílené diskuse

Účast je zdarma pro každý ověřený účet. Knihovna či kampaň může použít existující vlákno se společnými zprávami a rozhodnutími. Zaměstnanci navrhují propojení pro svou knihovnu; oprávnění správci spravují přehled. Role organizátora Team ani místo v týmu nedává moderační práva. Viz [Zapojení do knihovních diskusí](${guidePath}).`,
  },
}

const billingSummary = {
  en: `## Membership and access

Supporter and Pro add data tools; Team supplies Pro seats and service tools. They do not grant trust, community roles, staff verification or discussion moderation. Manage paid membership separately from complimentary access in Settings → Membership & billing. Read [Plans and Pro](${plansPath}) for current prices, included tools, invoices, plan changes and cancellation, and [Team API access](/knowledge/data-api/team-api-access) for the separately billed add-on.`,
  fr: `## Adhésion et accès

Supporter et Pro ajoutent des outils de données ; Team fournit des places Pro et des outils pour les services. Ils n’accordent ni confiance, ni rôle communautaire, ni vérification du personnel, ni pouvoir de modération. Gérez l’adhésion payante séparément des accès offerts dans Paramètres → Adhésion et facturation. Consultez [Formules et Pro](${plansPath}) pour les prix, outils, factures, changements et annulations, et [Accès à l’API Team](/knowledge/data-api/team-api-access) pour l’option facturée séparément.`,
  cs: `## Členství a přístup

Supporter a Pro přidávají datové nástroje; Team poskytuje místa Pro a nástroje pro knihovní služby. Nedávají důvěru, komunitní roli, ověření zaměstnance ani moderační práva. Placené členství spravujte odděleně od bezplatného přístupu v Nastavení → Členství a fakturace. [Tarify a Pro](${plansPath}) uvádí aktuální ceny, nástroje, faktury, změny a rušení; [Přístup k Team API](/knowledge/data-api/team-api-access) popisuje samostatně účtovaný doplněk.`,
}

const staffPlans = {
  en: `## Staff access is independent of payment

Every verified library staff member can look after their own library, post notices, connect event feeds and review other people’s record suggestions for free. A Team organiser can assign colleagues when the service has been verified. A paid seat alone does not verify anyone’s library relationship.

Owner and Editor levels determine staff responsibilities. Owners control live-sharing permissions for mobile libraries; assigned people still need the relevant library access. Membership does not bypass record review or grant discussion moderation. Verified staff may propose conversation links for their libraries; permitted managers decide what appears in the feed. Read [Joining library conversations](${guidePath}).`,
  fr: `## L’accès du personnel est indépendant du paiement

Tout membre vérifié du personnel peut gérer sa bibliothèque, publier des avis, connecter des événements et examiner les propositions de fiche d’autrui gratuitement. Un organisateur Team peut affecter des collègues lorsque le service a été vérifié. Une place payante ne prouve pas à elle seule le lien avec la bibliothèque.

Les niveaux Propriétaire et Éditeur déterminent les responsabilités. Les propriétaires contrôlent la diffusion en direct des bibliobus ; les personnes affectées doivent toujours disposer des droits adaptés. L’adhésion ne contourne pas la vérification et ne donne pas de pouvoir de modérer les discussions. Le personnel peut proposer des liens ; les responsables autorisés choisissent le contenu du flux. Voir [Participer aux conversations](${guidePath}).`,
  cs: `## Přístup zaměstnanců nezávisí na platbě

Každý ověřený zaměstnanec může zdarma spravovat svou knihovnu, zveřejňovat oznámení, připojit akce a posuzovat cizí návrhy změn. Organizátor Team může přiřazovat kolegy po ověření služby. Placené místo samo neověřuje vztah člověka ke knihovně.

Úrovně Vlastník a Editor určují odpovědnost zaměstnanců. Vlastníci řídí oprávnění k živému sdílení mobilních knihoven; přiřazené osoby stále potřebují odpovídající přístup. Členství neobchází kontrolu a nedává moderační práva. Zaměstnanci mohou navrhovat odkazy na diskuse; oprávnění správci vybírají obsah přehledu. Viz [Zapojení do knihovních diskusí](${guidePath}).`,
}

export const newGuides = {
  en: {
    title: "Joining library conversations",
    summary:
      "Start a discussion, reply, follow a conversation and understand what moderators check before a message appears.",
    body: `## Read and take part

Open [Community → Discussions](/community/discussions) to ask a question, share an idea or read what others have tried. Public conversations can be read without an account. Sign in with a verified account to start, reply, react or follow. These features are free; no paid membership or editor role is required. Restricted subjects and threads keep their access rules wherever they are linked.

## One conversation in several places

Threads can appear in Discussions, on library pages, beside a drive, under an article or inside a suggestion card. A shared feed links to the original thread: messages and review decisions are the same wherever it appears. Unlinking a feed entry does not delete the discussion.

On Suggestions, Read conversation opens the replies in the card. Load earlier replies or copy a link to the same thread. In Discussions, use the subject, language and library or drive filters, search, unanswered threads or your followed conversations.

## Joining or replying

Join the conversation at the bottom adds a message to the original thread. Reply under a first-level response addresses that response and appears one level below it. Replies do not keep nesting. The bottom form remains available while you reply.

A message does not change a library record, revise an article, cast a suggestion vote or complete a drive task. Use the corresponding correction, revision, vote or task action.

## Before publication

Every new message and proposed edit needs a different authorised reviewer, including contributions from editors, moderators and the editorial board. Only you and authorised reviewers see pending text and pictures. When you edit a published message, its approved version stays visible until the edit is accepted. Declined contributions can include private feedback so you can revise and send them again.

Describe pictures for people who cannot see them. Images follow the same review and visibility rules as their message.

## Language and follows

Choose the language you are writing in. Forms prefer your explicit selection, then profile languages, your optional profile country as a hint and the interface fallback. You can change the selection. Reading all languages does not change your writing preference.

Follow a discussion for an inbox update after a new contribution is approved. Pending text is not included in previews. Following a library or drive is separate from following a discussion.

## Names and privacy

Public bylines can show Editor, Moderator or Editorial board. Suggested this marks a suggestion’s original proposer. These tags describe the author; moderation still needs the relevant permission. Private or activity-hidden profiles use anonymous bylines without role tags. A private profile does not hide words already published publicly.

## Reports and feed management

Report a published message if it needs moderation. Reviewers work within their Discussions queue, languages and private-thread access. Staff and editor roles alone grant no discussion moderation.

Permitted feed managers can accept link proposals, feature or unlink threads, or hide a feed. Verified library staff can propose links for their own libraries. Linking does not approve messages, transfer ownership or imply endorsement by the original author.

## Deleting your account

Approved public text can remain with your attribution removed. Private unpublished messages and proposals, your reports, reactions and follows are removed through account erasure. Read the [account-deletion guide](/knowledge/getting-started/deleting-your-account) and [privacy notice](/legal/privacy) for the full details.`,
  },
  fr: {
    title: "Participer aux conversations des bibliothèques",
    summary:
      "Démarrer une discussion, répondre, suivre un fil et comprendre la vérification avant publication.",
    body: `## Lire et participer

Ouvrez [Communauté → Discussions](/community/discussions) pour poser une question, partager une idée ou lire les expériences d’autrui. La lecture publique ne demande pas de compte. Connectez-vous avec un compte vérifié pour démarrer, répondre, réagir ou suivre. Ces fonctions sont gratuites, sans adhésion ni rôle d’éditeur. Les sujets et fils restreints conservent leurs règles d’accès partout où ils sont associés.

## Une conversation, plusieurs emplacements

Un fil peut apparaître dans Discussions, sur une fiche, auprès d’une campagne, sous un article ou dans une carte de suggestion. Le flux renvoie au fil d’origine : messages et décisions sont identiques partout. Retirer une association ne supprime pas la discussion.

Dans Suggestions, Lire la conversation ouvre les réponses dans la carte. Chargez les réponses précédentes ou copiez un lien vers ce même fil. Dans Discussions, utilisez les filtres de sujet, langue, bibliothèque ou campagne, la recherche, les fils sans réponse ou les conversations suivies.

## Rejoindre ou répondre

Rejoindre la conversation, en bas, ajoute un message au fil d’origine. Répondre sous une réponse de premier niveau s’adresse à cette réponse et apparaît un niveau en dessous. Les réponses ne s’imbriquent pas davantage. Le formulaire du bas reste disponible pendant votre réponse.

Un message ne modifie pas une fiche ou un article, ne vote pas pour une suggestion et ne termine pas une tâche de campagne. Utilisez l’action de correction, révision, vote ou tâche correspondante.

## Avant publication

Chaque nouveau message et modification proposée demande une autre personne autorisée, même pour les éditeurs, modérateurs et membres du comité. Seuls vous et les réviseurs autorisés voyez les textes et images en attente. Lors d’une modification, la version approuvée reste visible jusqu’à la nouvelle décision. Un refus peut comporter un retour privé pour vous permettre de corriger et renvoyer le message.

Décrivez les images pour les personnes qui ne peuvent pas les voir. Elles suivent les mêmes règles de vérification et de visibilité que leur message.

## Langue et suivi

Choisissez votre langue de rédaction. Le formulaire privilégie votre choix explicite, puis les langues du profil, le pays facultatif comme indice et enfin la langue de l’interface. Vous pouvez changer ce choix. Lire toutes les langues ne modifie pas la préférence de rédaction.

Suivez une discussion pour recevoir une notification après l’approbation d’une nouvelle contribution. Le contenu en attente n’apparaît pas dans l’aperçu. Suivre une bibliothèque ou campagne est distinct de suivre sa discussion.

## Noms et confidentialité

Les signatures publiques peuvent afficher Éditeur, Modérateur ou Comité éditorial. À l’origine de cette suggestion identifie son auteur initial. Ces badges décrivent l’auteur ; la modération exige toujours l’autorisation adaptée. Les profils privés ou masquant leur activité ont une signature anonyme, sans rôle. Rendre le profil privé ne masque pas les textes déjà publiés publiquement.

## Signalements et gestion des flux

Signalez un message publié s’il demande une intervention. Les réviseurs restent dans leur file Discussions, leurs langues et les droits d’accès aux fils privés. Les rôles du personnel et d’éditeur ne donnent pas seuls le droit de modérer.

Les responsables autorisés peuvent accepter les liens proposés, mettre en avant ou dissocier un fil, ou masquer un flux. Le personnel vérifié propose les liens pour ses bibliothèques. Une association ne valide pas les messages, ne transfère pas la propriété et n’implique pas l’approbation de l’auteur initial.

## Supprimer le compte

Les textes publics acceptés peuvent rester sans attribution à votre compte. Les messages et propositions privés non publiés, vos signalements, réactions et suivis sont supprimés lors de l’effacement. Consultez le [guide de suppression](/knowledge/getting-started/deleting-your-account) et la [politique de confidentialité](/legal/privacy).`,
  },
  cs: {
    title: "Zapojení do knihovních diskusí",
    summary:
      "Založte diskusi, odpovězte, sledujte vlákno a zjistěte, co moderátoři kontrolují před zveřejněním.",
    body: `## Čtení a účast

Otevřete [Komunita → Diskuse](/community/discussions), pokud máte otázku, nápad nebo chcete číst zkušenosti ostatních. Veřejné diskuse jsou dostupné bez účtu. Pro založení, odpověď, reakci či sledování se přihlaste s ověřeným účtem. Funkce jsou zdarma, bez členství či redakční role. Omezená témata a vlákna si všude zachovávají přístupová pravidla.

## Jedna diskuse na více místech

Vlákna se mohou zobrazovat v Diskusích, u knihovny, kampaně, článku nebo uvnitř karty návrhu. Sdílený přehled odkazuje na původní vlákno: zprávy a rozhodnutí jsou všude stejné. Odpojení nemaže diskusi.

V Návrzích otevře Přečíst diskusi odpovědi v kartě. Můžete načíst dřívější odpovědi nebo zkopírovat odkaz na stejné vlákno. V Diskusích využijte filtry tématu, jazyka, knihovny a kampaně, vyhledávání, nezodpovězená vlákna a sledované diskuse.

## Zapojení nebo odpověď

Formulář Zapojit se do diskuse dole přidá zprávu do původního vlákna. Odpovědět pod příspěvkem první úrovně reaguje na tento příspěvek a zobrazí se o jednu úroveň níže. Další úrovně se nevnořují. Spodní formulář zůstává dostupný i při psaní odpovědi.

Zpráva neopravuje záznam ani článek, není hlasem pro návrh a nedokončuje úkol kampaně. Použijte příslušnou opravu, revizi, hlasování nebo úkol.

## Před zveřejněním

Každou novou zprávu a navrhovanou úpravu musí posoudit jiná oprávněná osoba, i u editorů, moderátorů a rady. Čekající text a obrázky vidíte jen vy a oprávnění kontrolující. Při úpravě publikované zprávy zůstává schválené znění viditelné do přijetí změny. Zamítnutí může obsahovat soukromou zpětnou vazbu pro úpravu a nové odeslání.

Popište obrázky lidem, kteří je nemohou vidět. Platí pro ně stejná pravidla kontroly a viditelnosti jako pro zprávu.

## Jazyk a sledování

Vyberte jazyk, ve kterém píšete. Formulář upřednostní výslovnou volbu, poté jazyky profilu, volitelnou zemi jako vodítko a nakonec výchozí jazyk rozhraní. Výběr můžete změnit. Čtení ve všech jazycích nemění jazyk psaní.

Sledovaná diskuse přinese oznámení po schválení nového příspěvku. Čekající text není součástí náhledu. Sledování knihovny nebo kampaně je oddělené od sledování diskuse.

## Jména a soukromí

Veřejná jména mohou mít štítky Editor, Moderátor nebo Redakční rada. Navrhl/a toto označuje původního navrhovatele. Štítky popisují autora; moderace stále vyžaduje příslušné oprávnění. Soukromé profily nebo profily se skrytou aktivitou používají anonymní označení bez role. Soukromý profil neskrývá již veřejně zveřejněný text.

## Hlášení a správa přehledů

Nahlaste publikovanou zprávu, pokud vyžaduje zásah. Kontrolující dodržují rozsah Discussions, jazyků a přístupu k soukromým vláknům. Role zaměstnance nebo editora sama nedává moderační práva.

Oprávnění správci přijímají návrhy propojení, zvýrazňují či odpojují vlákna nebo skryjí přehled. Ověření zaměstnanci navrhují propojení pro své knihovny. Propojení neschvaluje zprávy, nepřevádí vlastnictví ani neznamená souhlas původního autora.

## Smazání účtu

Schválený veřejný text může zůstat bez uvedení vašeho účtu. Soukromé nepublikované zprávy a návrhy, vaše hlášení, reakce a sledování se při výmazu odstraní. Podrobnosti uvádí [příručka smazání účtu](/knowledge/getting-started/deleting-your-account) a [zásady soukromí](/legal/privacy).`,
  },
}

const compactBillingSlugs = new Set([
  "your-account-and-profile",
  "deleting-your-account",
  "change-history-on-library-pages",
  "plans-and-staff-access",
])
const teamHeadings = new Set([
  "Team prices and API access",
  "Tarifs Team et accès à l’API",
  "Ceny Team a přístup k API",
])
const nodeText = (node) =>
  typeof node?.text === "string"
    ? node.text
    : (node?.children ?? []).map(nodeText).join("")

function deduplicateSections(component) {
  if (
    component.__component !== "content.rich-text" ||
    !Array.isArray(component.body)
  )
    return component
  const result = []
  const seen = new Map()
  const chunks = []
  for (const node of component.body) {
    if (node.type === "heading" || !chunks.length) chunks.push([])
    chunks.at(-1).push(node)
  }
  for (const chunk of chunks) {
    // Drop exact repeated sections, not merely headings that share a name.
    const key = JSON.stringify(chunk)
    if (seen.has(key)) continue
    seen.set(key, true)
    for (const node of chunk) {
      if (
        node.type === "heading" &&
        result.at(-1)?.type === "heading" &&
        nodeText(node) === nodeText(result.at(-1))
      )
        continue
      result.push(node)
    }
  }

  return { ...component, body: result }
}

export const updatedGuideSlugs = [
  ...new Set([
    ...Object.keys(main.en),
    ...Object.keys(additions.en),
    ...compactBillingSlugs,
  ]),
]

export function updatedGuideBody(doc, locale) {
  if (!updatedGuideSlugs.includes(doc.slug) || !main[locale]) return null
  let body = stripComponentIds(doc.body ?? [])
  const addition = additions[locale][doc.slug]
  if (addition) {
    const ownHeading = nodeText(richText(addition).body[0])
    body = body.filter(
      (c) =>
        c.__component !== "content.rich-text" ||
        nodeText(c.body?.[0]) !== ownHeading
    )
  }
  if (main[locale][doc.slug]) {
    const position = body.findIndex(
      (c) => c.__component === "content.rich-text"
    )
    if (position === -1)
      throw new Error(`Missing main guide text: ${locale}/${doc.slug}`)
    body[position] = richText(
      main[locale][doc.slug].replaceAll(
        "/contribute/add-library",
        "/contribute/index/new"
      )
    )
  }
  if (compactBillingSlugs.has(doc.slug)) {
    const ownHeadings = new Set([
      nodeText(richText(billingSummary[locale]).body[0]),
      nodeText(richText(staffPlans[locale]).body[0]),
    ])
    body = body.filter(
      (c) =>
        c.__component !== "content.rich-text" ||
        !(
          nodeText(c.body?.[0]) === "Supporter and Pro digital tools" ||
          teamHeadings.has(nodeText(c.body?.[0])) ||
          ownHeadings.has(nodeText(c.body?.[0]))
        )
    )
    // English staff-access copy had been entirely replaced by billing copy.
    if (doc.slug === "plans-and-staff-access")
      body = [richText(staffPlans[locale]), ...body]
    body.push(richText(billingSummary[locale]))
  }
  body = body.map(deduplicateSections)
  if (addition) {
    const fragment = richText(addition)
    const headingText = nodeText(fragment.body[0])
    const existing = body.findIndex(
      (c) =>
        c.__component === "content.rich-text" &&
        nodeText(c.body?.[0]) === headingText
    )
    if (existing !== -1) body[existing] = fragment
    else body.push(fragment)
  }

  return body
}

export function newGuideData(locale, section) {
  const copy = newGuides[locale]

  return {
    title: copy.title,
    slug: "library-conversations",
    summary: copy.summary,
    body: [richText(copy.body)],
    section,
    author: "Libraries Global",
    articleStatus: "stable",
  }
}
