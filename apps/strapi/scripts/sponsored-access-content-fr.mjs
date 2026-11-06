/**
 * French Knowledge copy for the free-participation, verified-staff, paid-API
 * and sponsorship model. Figures come from `v` (see `accessValues` in
 * `sponsored-access-content.mjs`), so the copy follows the agreed catalogue.
 *
 * Markdown subset: `## ` and `### ` headings, blank-line paragraphs, `- ` and
 * `1. ` lists, `[label](/path)` links, `**bold**`, `inline code` and fenced
 * code blocks. This module mirrors the English keys exactly.
 */
export default (v) => ({
  articles: {
    "plans-and-pro": {
      title: "Formules et tarifs",
      summary:
        "Ce qui est gratuit, ce que vous obtenez en contribuant, ce que reçoit le personnel vérifié des bibliothèques, et ce que couvrent l’API payante et le parrainage.",
      body: `Libraries Global est une infrastructure publique gratuite. Consulter les fiches des bibliothèques, faire des recherches, utiliser l’Atlas et contribuer ne coûtent rien. Seules deux choses sont payantes : l’accès des logiciels via l’API, et le parrainage par des organisations qui souhaitent financer ce service public. Payer n’achète jamais la confiance, un meilleur classement dans les recherches, un traitement éditorial ni une autorité de personnel.

## Explorer : tous les comptes gratuits

Vous pouvez consulter les fiches, faire des recherches et utiliser la carte sans compte. Un compte gratuit fait de vous un Explorer et ajoute des outils auparavant payants :

- comparaison, vues enregistrées et recherches enregistrées (jusqu’à ${v.savedViews} de chaque)
- alertes, notes et historique détaillé des modifications sur les fiches des bibliothèques
- couches de contexte de l’Atlas, comme la densité de population, les comparaisons Library access, la précarité ou les ménages sans voiture, lorsque les données existent
- exports de ${v.exportRows} lignes au maximum à la fois, et jusqu’à ${v.exportsPerDay} exports sur toute période glissante de 24 heures

Explorer ne comprend pas les calculs de temps de trajet Reach. Ils coûtent cher à exécuter ; les contributeurs et les clients de l’API en reçoivent donc un nombre limité.

## Contributor et Supporter : à mériter, jamais à acheter

Votre première contribution acceptée fait de vous un Contributor. Les Contributors peuvent lancer ${v.contributorReach} nouveaux calculs Reach pour une bibliothèque sur toute période glissante de sept jours. Rouvrir un résultat enregistré identique ne consomme pas ce quota. Les calculs Reach pour un service ou un réseau ne sont pas inclus.

À partir de ${v.supporterThreshold} contributions acceptées, vous recevez la reconnaissance Supporter. Supporter est un remerciement : il n’ajoute ni outil, ni quota, ni autorité. [Reconnaissance Contributor et Supporter](/knowledge/contributing/earned-recognition-and-rewards) explique ce qui est pris en compte.

## Personnel vérifié : gratuit pour le personnel des bibliothèques

Les membres du personnel dont le lien avec une bibliothèque a été vérifié gèrent gratuitement sa fiche : horaires, services, accessibilité, avis, flux d’événements et arrêts des bibliobus. Un espace de travail gratuit permet aux collègues de travailler ensemble, de publier des intégrations et des widgets, et de voir qui d’autre participe. Ces outils ne s’appliquent qu’aux bibliothèques couvertes par votre propre accès vérifié. Rejoindre l’espace de travail d’une organisation ne vous permet pas, à lui seul, de modifier ses bibliothèques. Consultez [Personnel vérifié et espaces de travail gratuits](/knowledge/governance/teams-for-library-services).

## Accès à l’API : ${v.price} par mois

L’API s’adresse aux logiciels qui lisent les données des bibliothèques, proposent des modifications ou effectuent des analyses de façon programmée ou à grande échelle. Elle coûte ${v.price} par mois, taxes comprises, sur la base du prix en GBP ; Stripe affiche le montant final, taxes locales éventuelles comprises, avant le paiement. Chaque période de facturation comprend ${v.requests} requêtes réussies, ${v.mib} de données de réponse et ${v.credits} crédits d’analyse. Toute utilisation supplémentaire est refusée, sauf si vous activez le dépassement plafonné.

Un compte API appartient à une organisation. Si vous achetez à titre individuel, une organisation à un seul membre est créée pour vous lors du paiement. Vous n’avez besoin ni d’un espace de travail du personnel ni d’aucun autre achat préalable. Commencez par [L’API Libraries Global](/knowledge/data-api/the-public-api) et [Limites, dépassements et facturation de l’API](/knowledge/data-api/team-api-access).

## Parrainage

Les organisations peuvent financer le service public dans le cadre d’un accord annuel. Avec l’accord du sponsor, nous le remercions publiquement et rendons compte du travail que son financement soutient. Le parrainage ne comprend pas l’accès à l’API et ne donne aucune influence sur les fiches, le classement des recherches, la vérification ou les décisions éditoriales. Consultez [Parrainer Libraries Global](/knowledge/governance/sponsoring-libraries-global).

## Ce que le paiement ne change jamais

Les points, badges, reconnaissances, rôles, la modération et la vérification du personnel ne sont jamais vendus. Une clé d’API payante authentifie un logiciel ; elle n’identifie pas une personne et ne confère aucune autorité de personnel. Les informations sur les bibliothèques restent consultables gratuitement, et les données restent soumises à leurs licences publiées.

## Pendant la bêta fermée

Tant que la bêta fermée se poursuit, le paiement de l’API utilise le mode Test de Stripe et aucun paiement réel n’est prélevé. Certaines fonctions de l’API sont introduites par étapes ; les pages développeurs indiquent ce qui est activé pour votre compte. Les anciennes formules de test de la bêta pour les adhésions personnelles, les places dans les espaces de travail et l’ancienne option API ont été retirées.`,
    },

    "earned-recognition-and-rewards": {
      title: "Reconnaissance Contributor et Supporter",
      summary:
        "Comment les contributions acceptées font de vous un Contributor puis, à 100, un Supporter, ce que chaque statut vous apporte et ce qu’il ne vous apporte jamais.",
      body: `La reconnaissance remercie un travail qui améliore les données communes. Elle s’obtient par des contributions acceptées et ne s’achète pas.

## Contributor

Votre première contribution acceptée fait de vous un Contributor. Les Contributors peuvent lancer dans l’Atlas ${v.contributorReach} nouveaux calculs Reach pour une bibliothèque sur toute période glissante de sept jours. Ouvrir un résultat enregistré identique est gratuit et ne consomme pas ce quota. Les calculs Reach pour un service ou un réseau ne sont pas inclus.

## Supporter

À partir de ${v.supporterThreshold} contributions acceptées, vous recevez la reconnaissance Supporter. Elle reste attachée à votre compte et ne se perd pas si vous faites une pause. Votre profil indique séparément si vous avez contribué au cours des ${v.activityDays} derniers jours. Supporter n’ajoute ni outil, ni quota supplémentaire, ni autorité. Lorsque le site affiche publiquement les Supporters, vos choix de confidentialité de profil s’appliquent.

## Ce qui compte

Nous comptons les contributions acceptées, une par proposition ou suggestion acceptée, et non votre total de points. Comptent notamment : les nouvelles bibliothèques acceptées, les modifications et corrections de fiches, les vérifications d’horaires ou de statut, les photos sous licence adaptée, les sources, la rédaction, la révision et la traduction d’articles Knowledge et Journal, les tâches et propositions de campagne, les fils de discussion, réponses et modifications validés, les connexions de flux d’événements et les suggestions d’options de liste acceptées.

Ne comptent jamais : les ajustements administratifs de points, les séries quotidiennes, les bonus automatiques comme les récompenses de fin de campagne, les votes, les réactions, les brouillons et les contributions encore en attente de vérification. Chaque contribution acceptée n’est comptée qu’une fois, même si elle est vérifiée à nouveau ou prise en compte avec retard.

## Points et badges

Les points, niveaux et badges continuent d’exister pour le classement et votre profil. Les niveaux ajustent toujours des limites de contribution, comme le nombre de propositions pouvant être en attente de vérification. Les points et niveaux ne débloquent jamais d’outils payants, et un badge n’est pas un statut de reconnaissance.

## Retrait

Les modérateurs peuvent retirer la reconnaissance lorsque des contributions étaient frauduleuses ou en double, par exemple la même modification envoyée plusieurs fois pour gonfler un total. Le retrait supprime les statuts Contributor et Supporter. Il ne supprime pas les informations publiques déjà publiées, et vous pouvez nous contacter si vous pensez qu’il s’agit d’une erreur.

## Ce que la reconnaissance ne donne jamais

La reconnaissance ne donne jamais de droits de modification, de vérification du personnel, de pouvoir de modération, de rôle communautaire ni d’accès à l’API. Les rôles proviennent des attributions de rôle et des rattachements de bibliothèque approuvés. Consultez [Comment fonctionne la vérification](/knowledge/governance/how-review-works) et [Points, séries et niveaux](/knowledge/contributing/points-streaks-and-tiers).`,
    },

    "teams-for-library-services": {
      title: "Personnel vérifié et espaces de travail gratuits",
      summary:
        "Les outils gratuits du personnel vérifié des bibliothèques, le fonctionnement des espaces de travail, et pourquoi rejoindre une organisation ne donne jamais, à lui seul, le droit de modifier.",
      body: `Le personnel et les bénévoles qui gèrent la fiche d’une bibliothèque utilisent Libraries Global gratuitement. Le paiement ne joue aucun rôle dans l’accès du personnel.

## Devenir personnel vérifié

Demandez le rattachement de votre bibliothèque depuis sa fiche ou depuis [Rattacher une bibliothèque](/staff/claim). Un modérateur examine la demande. Une fois celle-ci approuvée, vous disposez d’un accès personnel à cette bibliothèque en tant que propriétaire ou éditeur. Un organisateur peut aussi vous affecter à une bibliothèque couverte par son espace de travail vérifié. Dans les deux cas, votre accès est enregistré pour des bibliothèques nommément désignées.

## Ce que peut faire le personnel vérifié

Pour les bibliothèques couvertes par votre accès, vous pouvez mettre à jour les horaires, les services et les informations d’accessibilité, publier des avis, connecter des flux d’événements et gérer les itinéraires et arrêts des bibliobus. La plupart des modifications sont publiées directement ; les changements sensibles, comme déplacer une bibliothèque ou la fermer définitivement, passent toujours par un modérateur. Vous pouvez aussi examiner les suggestions d’autres personnes concernant votre bibliothèque.

## Espaces de travail gratuits

Un espace de travail est l’espace partagé d’une organisation : son nom, ses membres, un ou plusieurs organisateurs et les bibliothèques qu’il couvre. Tout compte dont l’adresse e-mail est vérifiée peut en créer un gratuitement. Couvrir une bibliothèque exige toujours une autorité de propriétaire vérifiée sur cette bibliothèque.

Les espaces de travail permettent aux collègues de voir qui participe, de partager des intégrations et des widgets comme des outils de recherche de bibliothèques ou des graphiques de comparaison, d’utiliser l’import en masse et de consulter les rapports de fréquentation lorsqu’ils sont disponibles. Tous ces outils ne fonctionnent que pour les bibliothèques couvertes par l’accès vérifié de chaque personne.

## Organisateurs et membres

Les organisateurs gèrent l’espace de travail : son nom, ses membres, les invitations et les bibliothèques couvertes. Les membres voient l’espace de travail et utilisent les outils que leur propre accès autorise. Être organisateur, ou membre, ne donne pas à lui seul le droit de modifier une bibliothèque. Avant de supprimer son compte, le dernier organisateur doit transmettre ce rôle à un autre membre.

## Espaces de travail et API

Une même organisation peut aussi détenir un compte API, mais les deux sont distincts. Un espace de travail ne comprend pas l’accès à l’API, et acheter l’accès à l’API ne vérifie jamais le personnel et ne donne aucun droit de modification. Consultez [Formules et tarifs](/knowledge/governance/plans-and-pro) et [L’API Libraries Global](/knowledge/data-api/the-public-api).

## Aucun frais par place

Les espaces de travail n’ont plus de frais par place, de limite de places ni de facturation annuelle. Les outils du personnel ne dépendent d’aucun paiement.`,
    },

    "the-public-api": {
      title: "L’API Libraries Global",
      summary:
        "Ce que propose l’API payante, à qui elle s’adresse, comment les comptes API sont organisés et quelles fonctions sont introduites par étapes.",
      body: `L’API donne aux logiciels un accès versionné aux informations publiées sur les bibliothèques. Les fiches, la recherche et l’Atlas restent gratuits pour le public ; l’API s’adresse aux applications qui ont besoin des données de façon programmée ou à grande échelle.

## Ce que vous pouvez faire

- rechercher les bibliothèques publiées et lister les fiches avec une pagination stable
- lire une fiche de bibliothèque et parcourir les bibliothèques par lieu
- lire les services et réseaux de bibliothèques publiés, ainsi que leurs bibliothèques membres
- envoyer des propositions de nouvelles bibliothèques et des corrections dans la file de modération
- lancer des analyses encadrées, notamment Reach pour une bibliothèque ou un service

Chaque requête utilise une clé disposant de la portée correspondante. Certaines fonctions sont introduites par étapes et ne sont peut-être pas encore activées ; [la référence de l’API](/developers/reference) et votre tableau de bord indiquent ce que votre compte peut appeler.

## Prix et quotas

L’accès à l’API coûte ${v.price} par mois, taxes comprises, sur la base du prix en GBP. Chaque période de facturation comprend ${v.requests} requêtes réussies, ${v.mib} de données de réponse et ${v.credits} crédits d’analyse, partagés entre toutes vos clés. Lorsqu’un quota est épuisé, les requêtes suivantes sont refusées, sauf si vous avez activé le dépassement plafonné. Consultez [Limites, dépassements et facturation de l’API](/knowledge/data-api/team-api-access).

## Comptes API et organisations

Un compte API appartient à une organisation. Si vous achetez à titre individuel, une organisation à un seul membre est créée pour vous lors du paiement. Les organisateurs gèrent la facturation, les clés et les réglages de dépassement ; les membres peuvent consulter l’utilisation. Une organisation peut avoir un seul abonnement API actif. Vous n’avez pas besoin d’un espace de travail du personnel, et un espace de travail du personnel ne comprend pas l’accès à l’API.

## Ce qu’une clé ne fait pas

Une clé authentifie votre logiciel. Ce n’est pas une session utilisateur et elle n’identifie pas une personne. Elle ne donne aucune autorité de personnel, aucun accès aux comptes ni aux données privées, et aucun moyen de publier directement des modifications. Les propositions envoyées via l’API sont vérifiées comme celles de n’importe qui.

## Licences et attribution

Les réponses contiennent l’attribution et les références des sources, y compris la licence et les conditions de rediffusion de chaque jeu de données. Conservez-les avec les données. Un abonnement payant ne remplace pas la licence d’une source. Consultez la [licence des données](/legal/data-licence).

## Pour commencer

[Créez votre première clé et envoyez une requête](/knowledge/data-api/team-api-quickstart), puis consultez le guide [référence, portées et dépannage](/knowledge/data-api/team-api-reference). Pendant la bêta fermée, le paiement utilise le mode Test de Stripe et aucun paiement réel n’est prélevé.`,
    },

    "team-api-quickstart": {
      title: "API : votre première clé et votre première requête",
      summary:
        "Achetez l’accès à l’API, créez une clé avec les bonnes portées et envoyez votre première requête authentifiée.",
      body: `Ce guide vous accompagne d’un compte gratuit jusqu’à une requête API qui fonctionne.

## 1. Créez et vérifiez votre compte

Créez un compte depuis [Inscription](/auth/register) et suivez le lien de l’e-mail de vérification. Pendant la bêta fermée, vous avez aussi besoin d’une invitation à la bêta pour accéder au site. Une invitation à la bêta, un compte et une clé d’API sont trois choses distinctes.

## 2. Achetez l’accès à l’API

Ouvrez [Développeurs](/developers) et choisissez de vous abonner. Si vous êtes déjà organisateur d’une organisation, vous pouvez acheter pour elle ; sinon, une organisation à un seul membre est créée pour vous. Vérifiez le prix de ${v.price} par mois, les quotas inclus et les [conditions d’achat de l’API](/legal/membership), confirmez votre accord et poursuivez vers Stripe Checkout.

L’accès ne commence qu’une fois le paiement réglé. La page de retour après le paiement ne suffit pas à l’activer. Si la confirmation tarde, actualisez la page d’utilisation plutôt que de payer une seconde fois. Pendant la bêta fermée, utilisez uniquement les coordonnées de paiement de test de Stripe ; aucun paiement réel n’est prélevé.

## 3. Créez une clé

Ouvrez [Clés d’API](/developers/keys), nommez la clé d’après l’application qui l’utilisera et choisissez ses portées. Les nouvelles clés reçoivent par défaut les portées de lecture : \`search:read\`, \`libraries:read\` et \`services:read\`. L’analyse (\`analysis:run\`) et les propositions (\`submissions:write\`) doivent être confirmées séparément, car elles consomment des crédits ou créent des propositions.

Copiez la clé complète lorsqu’elle s’affiche. Elle n’est montrée qu’une fois ; nous ne conservons qu’une empreinte et un court préfixe. Stockez-la dans le coffre à secrets de votre serveur. Ne la placez jamais dans du code exécuté par le navigateur, un dépôt public, une URL ou un message à l’assistance.

## 4. Envoyez une requête

Cette requête lit la fiche publiée d’une bibliothèque. Elle nécessite une clé disposant de \`libraries:read\`.

\`\`\`bash
read -r -s -p 'Libraries Global API key: ' LIBRARIES_API_KEY
export LIBRARIES_API_KEY
printf '\\n'
curl --fail-with-body --include 'https://libraries.global/api/v1/libraries?locale=en&limit=1' \\
  -H "Authorization: Bearer $LIBRARIES_API_KEY"
\`\`\`

Une recherche nécessite \`search:read\`. Un tableau \`data\` vide correspond à une recherche réussie sans résultat.

\`\`\`bash
curl --fail-with-body 'https://libraries.global/api/v1/search/libraries' \\
  -H "Authorization: Bearer $LIBRARIES_API_KEY" \\
  -H 'Content-Type: application/json' \\
  --data '{"q":"Bristol","locale":"en","limit":2}'
\`\`\`

## 5. Vérifiez votre utilisation

Ouvrez [Utilisation](/developers/usage). Vos requêtes réussies et les octets de réponse sont décomptés du quota de la période. Les requêtes en échec ne consomment pas le quota, mais chaque tentative compte pour la limite de débit.

## Étapes suivantes

Consultez [Limites, dépassements et facturation de l’API](/knowledge/data-api/team-api-access), le guide [référence, portées et dépannage](/knowledge/data-api/team-api-reference) et [Utiliser le bac à sable de l’API](/knowledge/data-api/api-playground).`,
    },

    "team-api-access": {
      title: "Limites, dépassements et facturation de l’API",
      summary:
        "Quotas inclus, limites de débit, périodes de facturation, dépassement plafonné sur option et ce qui n’est jamais facturé.",
      body: `Un compte API dispose d’un quota unique, partagé entre toutes ses clés et applications. Ajouter ou régénérer des clés ne l’augmente ni ne le remet à zéro.

## Inclus dans chaque période de facturation

- ${v.requests} requêtes réussies
- ${v.mib} (${v.bytes} octets) de données de réponse JSON non compressées
- ${v.credits} crédits d’analyse

La période de facturation correspond à la période payée de votre abonnement, de son heure de début jusqu’à son heure de fin non comprise, en UTC. Elle suit votre date de paiement, et non le mois calendaire. Une première période partielle reçoit l’intégralité des quotas. Les quotas d’une nouvelle période ne commencent qu’une fois son paiement réglé ; un paiement en échec n’ouvre pas d’utilisation gratuite. Les quotas non utilisés ne sont pas reportés.

## Limites de débit et de taille

Votre compte peut effectuer jusqu’à ${v.attemptsPerMinute} tentatives de requête par minute et ${v.concurrent} requêtes simultanées. Une réponse ne peut pas dépasser ${v.maxResponse}, et une page liste au maximum ${v.pageSize} fiches. Demandez une page plus petite si une réponse risque d’être trop volumineuse.

## Ce qui est décompté

Chaque réponse réussie compte comme une requête, et sa taille JSON non compressée est décomptée des données de réponse, y compris pour les requêtes répétées et les réponses en cache. Les crédits d’analyse ne sont consommés qu’à la fin d’une nouvelle tâche. Les requêtes en échec, refusées ou expirées ne sont pas décomptées de vos quotas, mais chaque tentative compte pour la limite de débit.

## Quand un quota est épuisé

Sans dépassement, la requête qui ferait dépasser un quota est refusée avec le statut HTTP 429 et un code désignant le quota concerné. Votre tableau de bord indique ce qui reste et la date de réinitialisation de la période. Des avertissements apparaissent à 50 %, 80 % et 100 % de chaque quota.

## Dépassement plafonné

Le dépassement est désactivé tant qu’un organisateur ne l’active pas et n’accepte pas les conditions de dépassement. Au-delà des volumes inclus, il coûte ${v.requestRate} par requête, ${v.mibRate} par Mio de données de réponse et ${v.creditRate} par crédit d’analyse, hors taxes. Le dépassement de données est calculé sur le nombre exact d’octets supplémentaires, sans arrondi par requête.

Vous devez choisir un plafond mensuel entre ${v.capMin} et ${v.capMax}, par paliers de ${v.capStep}. ${v.capDefault} est suggéré, mais rien n’est activé tant que vous n’avez pas confirmé. Le plafond couvre le total des dépassements de requêtes, de données et de crédits, hors taxes. Lorsque la requête ou la tâche suivante risque de vous faire dépasser le plafond, elle est refusée. Des avertissements apparaissent à 50 %, 80 % et 100 % du plafond. Vous pouvez à tout moment abaisser le plafond ou désactiver le dépassement ; cela arrête toute nouvelle utilisation payante, sans annuler les frais déjà engagés. Le tableau de bord affiche le dépassement à ce jour et une estimation de votre prochaine facture.

## Ce qui n’est jamais facturé

Nous ne facturons pas les travaux en échec, refusés, expirés ou relancés en interne, et il n’existe jamais de découvert sans plafond. Si la confirmation de facturation tarde, l’application continue d’appliquer vos limites.

## Paiement et factures

L’accès à l’API coûte ${v.price} par mois, taxes comprises, sur la base du prix en GBP ; Stripe affiche le montant final avant le paiement. Le dépassement, lorsqu’il est activé, figure sur la facture suivante. Les organisateurs gèrent les moyens de paiement, les factures et la résiliation depuis [Développeurs](/developers). Consultez [Résilier l’accès à l’API et remboursements](/knowledge/data-api/api-cancellation-and-refunds) et les [conditions d’achat de l’API](/legal/membership).

## Reach dans le navigateur pour les organisateurs API

Tant que votre compte API dispose d’une couverture payée et confirmée, ses organisateurs reçoivent aussi un quota Reach dans l’Atlas : ${v.apiReachPerHour} nouveaux calculs par heure, jusqu’à ${v.serviceLibraries} bibliothèques éligibles par service, avec un plafond commun de ${v.apiReachPerDay} nouveaux calculs par jour pour le compte API. Les membres n’en bénéficient pas. Ce quota est distinct des crédits d’analyse de l’API.`,
    },

    "team-api-reference": {
      title: "Référence de l’API : portées, erreurs et dépannage",
      summary:
        "Authentification, portées des clés, pagination, en-têtes de réponse, codes d’erreur et que faire lorsqu’une requête échoue.",
      body: `Utilisez \`https://libraries.global\` en HTTPS et envoyez \`Authorization: Bearer YOUR_API_KEY\` avec chaque requête. La [référence des requêtes](/developers/reference) liste chaque point d’accès, paramètre et champ de réponse. Ce guide explique les règles qu’ils ont en commun.

## Portées

- \`search:read\` : recherche de bibliothèques
- \`libraries:read\` : fiches, listes et lieux des bibliothèques
- \`services:read\` : services et réseaux de bibliothèques publiés
- \`analysis:run\` : tâches d’analyse et Reach, qui consomment des crédits d’analyse
- \`submissions:write\` : propositions de nouvelles bibliothèques et corrections soumises à modération

Les nouvelles clés reçoivent par défaut les trois portées de lecture. L’analyse et les propositions doivent être confirmées lors de la création de la clé. Donnez à chaque application sa propre clé, avec uniquement les portées dont elle a besoin.

## Pagination et fiches

Les listes renvoient au maximum ${v.pageSize} fiches. Renvoyez \`meta.nextCursor\` dans \`after\` jusqu’à ce qu’il soit null, en conservant la même langue et les mêmes filtres. Traitez les curseurs comme opaques. Les fiches changent pendant que vous parcourez les pages : enregistrez donc l’\`entityRef\` et l’\`updatedAt\` de chaque fiche. Encodez un \`entityRef\` comme un seul segment de chemin, par exemple avec \`encodeURIComponent\`. Seules les langues de contenu actives sont acceptées.

## En-têtes de réponse

Les réponses réussies contiennent \`X-Request-Id\` et des en-têtes indiquant le quota restant et la date de réinitialisation de la période. Les réponses sont propres à votre clé et ne doivent pas être placées dans un cache partagé.

## Erreurs

Les erreurs ont la forme \`{"error":{"code":"..."}}\`. Vérifiez le statut HTTP et le code avant de réessayer.

- 400 : la requête est mal formée ou utilise une langue, un filtre ou un curseur non pris en charge. Corrigez-la avant de réessayer.
- 401 : la clé est absente, mal formée, expirée, révoquée ou remplacée. Ne réessayez pas indéfiniment avec la même clé.
- 403 : la clé n’a pas la portée nécessaire, ou le compte API n’a pas de couverture payée et confirmée. Adressez-vous à un organisateur.
- 404 : la fiche, le service, la tâche ou la proposition n’existe pas ou ne vous appartient pas.
- 413 : le corps de la requête est trop volumineux.
- 429 : une limite a été atteinte. \`rate_limit\` et \`concurrency_limit\` signifient qu’il faut ralentir. \`quota_requests\`, \`quota_bytes\` et \`quota_analysis\` signifient qu’un quota est épuisé. \`overage_cap\` signifie que le prochain frais dépasserait votre plafond. Respectez \`Retry-After\` lorsqu’il est indiqué.
- 502 ou 503 : un problème en amont ou de comptabilisation, ou une réponse qui dépasserait ${v.maxResponse}. Réessayez en espaçant les tentatives, ou demandez une page plus petite.

Les requêtes en échec ne consomment ni vos quotas ni vos crédits.

## Dépannage

- **Rien ne fonctionne après le paiement :** attendez que le tableau de bord indique un accès confirmé. La page de retour après le paiement ne suffit pas à activer l’API.
- **Erreur 401 juste après la régénération d’une clé :** chaque application doit passer à la nouvelle clé ; l’ancienne cesse de fonctionner immédiatement.
- **Erreur 403 sur une nouvelle fonction :** vérifiez que votre clé dispose de la portée et que la fonction est activée pour votre compte.
- **Erreurs 429 répétées :** limitez les requêtes parallèles à ${v.concurrent}, étalez vos requêtes, ou vérifiez si un quota ou votre plafond de dépassement a été atteint.

Lorsque vous écrivez à info@libraries.global, indiquez le point d’accès, le statut HTTP, le code d’erreur et le \`X-Request-Id\`. N’envoyez jamais votre clé, l’en-tête Authorization ni vos coordonnées de paiement.`,
    },

    "api-playground": {
      title: "Utiliser le bac à sable de l’API",
      summary:
        "Essayez de vraies requêtes API dans le navigateur avec votre propre clé. Les requêtes du bac à sable sont décomptées comme les autres.",
      body: `Le [bac à sable](/developers/playground) envoie de vraies requêtes à l’API versionnée depuis votre navigateur, pour essayer les points d’accès avant d’écrire du code.

## Avant de commencer

Il vous faut un compte API disposant d’une couverture payée et confirmée, ainsi qu’une clé existante. Collez la clé dans le bac à sable. Elle n’est conservée que dans la mémoire de la page : elle n’est ni enregistrée, ni journalisée, ni envoyée ailleurs qu’à l’API. Recharger la page l’efface.

## Les requêtes du bac à sable sont décomptées

Le bac à sable n’offre aucun raccourci gratuit ou privé. Chaque requête utilise les portées, les limites de débit et les quotas de votre clé, exactement comme le ferait votre application. Les requêtes réussies et leurs données de réponse sont décomptées de votre quota ; les tâches d’analyse consomment des crédits ; si le dépassement est activé, elles peuvent aussi compter dans le dépassement. Les requêtes en échec ne consomment pas le quota. Rien ne s’exécute tant que vous n’avez pas choisi Run.

## Explorer

Parcourez les lieux, des pays jusqu’aux régions et zones, recherchez des bibliothèques, listez les bibliothèques d’un lieu et ouvrez une fiche. Chaque étape est une requête ordinaire. Si les fonctions correspondantes sont activées pour votre compte, vous pouvez aussi lire les services, vérifier l’état d’une proposition ou lancer une tâche d’analyse.

## Passer à votre propre code

Copiez dans votre application la requête affichée par le bac à sable. Gardez la clé sur votre serveur. Consultez le guide [référence, portées et dépannage](/knowledge/data-api/team-api-reference) pour les erreurs et les limites.`,
    },

    "api-services-submissions-and-analysis": {
      title: "Données des services, propositions et crédits d’analyse",
      summary:
        "Lisez les services de bibliothèques, proposez de nouvelles bibliothèques et des corrections à vérifier, et lancez des analyses et calculs Reach encadrés avec des crédits d’analyse.",
      body: `Ces fonctions de l’API sont introduites par étapes et activées séparément. Votre tableau de bord et la [référence des requêtes](/developers/reference) indiquent celles qui sont disponibles pour votre compte.

## Services et réseaux de bibliothèques

Avec \`services:read\`, vous pouvez lister les services et réseaux de bibliothèques publiés, en lire un par sa référence stable et lister ses bibliothèques membres publiées. Tous les réseaux ne sont pas des services de lecture publique : la réponse précise leur nature. L’appartenance provient de nos données, et non de votre requête. L’appartenance d’une bibliothèque à un service ne constitue pas une autorité de personnel. Conservez l’attribution des sources avec les données.

## Propositions

Avec \`submissions:write\`, vous pouvez proposer une nouvelle bibliothèque ou une correction d’une fiche publiée. Joignez vos justificatifs ou votre source et une clé d’idempotence unique, afin qu’une nouvelle tentative ne crée pas une seconde proposition. Les champs protégés et les champs arbitraires sont refusés.

Chaque proposition entre dans la file de modération habituelle. Elle n’est jamais publiée directement et elle est vérifiée de la même façon que la suggestion de n’importe qui. Une clé ne peut pas prétendre agir au nom du personnel d’une bibliothèque. Vous pouvez suivre l’état d’une proposition, mais vous ne verrez ni les notes des vérificateurs ni les informations privées. Les propositions ne rapportent ni points ni reconnaissance au compte API. Les textes et données acceptés sont publiés sous la [licence des données](/legal/data-licence) : n’envoyez donc que des contenus que vous avez le droit de partager.

## Analyse et Reach

Avec \`analysis:run\`, vous pouvez demander une analyse synthétique d’un service ou d’une zone publiés, ainsi qu’un calcul Reach pour une bibliothèque ou un service entier. Les travaux plus coûteux s’exécutent sous forme de tâche : vous recevez un identifiant de tâche, vous suivez son état, puis vous récupérez le résultat.

Les crédits d’analyse ne sont consommés qu’à la fin d’une nouvelle tâche :

- synthèse simple : ${v.summaryCredits} crédit ; synthèse détaillée : ${v.richSummaryCredits} crédits
- Reach pour une bibliothèque : ${v.libraryReachCredits} crédits
- Reach pour un service : ${v.serviceReachCredits} crédits
- Reach pour un réseau, lorsqu’il est activé après un examen distinct de la capacité : ${v.networkReachCredits} crédits

Un résultat identique en cache ne consomme aucun crédit, mais sa récupération compte comme une requête et ses données de réponse sont décomptées. Récupérer à nouveau un résultat terminé ne consomme jamais de crédit supplémentaire. Une tâche qui dépasserait vos crédits restants ou votre plafond de dépassement est refusée avant de commencer. Une tâche en échec, annulée ou expirée restitue ses crédits réservés.

Les paramètres d’entrée sont encadrés. L’API n’accepte ni polygones arbitraires, ni listes de coordonnées, ni appartenances à un service choisies par vous, ni lots illimités. Les résultats restent sous ${v.maxResponse} ; les géométries volumineuses ne sont pas disponibles via l’API de base. Les résultats terminés sont conservés pendant une durée limitée, indiquée dans l’état de la tâche, puis supprimés.

## Lire les résultats

Reach modélise la proximité géographique. Il ne mesure ni la fréquentation, ni les conditions d’admission, ni l’accès de plain-pied, et les résultats partiels restent partiels. Consultez [Reach à pied, à vélo et par service](/knowledge/data-api/understanding-library-reach) avant de publier un chiffre.`,
    },

    "exporting-from-the-atlas": {
      title: "Exports de l’Atlas et limites de Reach",
      summary:
        "Exportez des sélections filtrées de bibliothèques, téléchargez les résultats Reach et découvrez qui peut lancer Reach et dans quelles quantités.",
      body: `Tout compte connecté peut exporter une sélection filtrée de l’Atlas au format CSV ou GeoJSON. Le téléchargement d’une fiche de bibliothèque individuelle reste public. Exporter des fiches et télécharger un résultat Reach sont deux actions distinctes.

## Exporter la sélection de bibliothèques

Affinez la sélection avec les filtres ou la carte, passez en mode Liste et choisissez Exporter. Le CSV convient aux tableurs ; le GeoJSON conserve les points sur la carte. Chaque export peut contenir jusqu’à ${v.exportRows} bibliothèques, et vous pouvez effectuer jusqu’à ${v.exportsPerDay} exports sur toute période glissante de 24 heures. Affinez d’abord une sélection plus large. Ces limites concernent les personnes qui utilisent l’Atlas ; pour des extractions régulières ou plus importantes, utilisez l’API.

## Conserver les sources et le périmètre

Les exports contiennent les identifiants des bibliothèques, les informations de visite et de contact disponibles, les positions et les informations sur les sources. Conservez avec les données les références des sources, l’attribution, les licences et les dates de collecte. Un champ vide signifie que la fiche n’a pas cette valeur, et non que la réponse est Non.

## Qui peut lancer Reach

Reach coûte cher à calculer ; il dispose donc de ses propres quotas :

- comptes Explorer : aucun calcul Reach
- Contributors : ${v.contributorReach} nouveaux calculs pour une bibliothèque sur toute période glissante de sept jours ; pas de Reach pour un service ou un réseau
- organisateurs d’un compte API disposant d’une couverture payée et confirmée : ${v.apiReachPerHour} nouveaux calculs par heure, Reach pour un service compris, avec un plafond commun de ${v.apiReachPerDay} par jour pour le compte API

Ouvrir un résultat enregistré identique ne consomme pas de nouveau calcul. Le statut de personnel vérifié ne modifie pas ces quotas.

## Limites de taille des services

Reach pour un service accepte jusqu’à ${v.serviceLibraries} bibliothèques éligibles. Avec les quatre temps de trajet, le service et sa zone de référence doivent tenir dans ${v.area4} et une étendue de ${v.span4}. Choisir un seul temps de trajet permet d’aller jusqu’à ${v.area1} et ${v.span1}. Il s’agit de rectangles englobants prudents, et non de superficies terrestres. Le temps de calcul, le nombre de cellules raster et la file d’attente partagée sont aussi limités : une demande respectant ces tailles peut donc rester indisponible.

## Télécharger les résultats Reach

Utilisez Téléchargements dans le panneau Reach pour obtenir un CSV, un GeoJSON d’affichage ou un JSON d’analyse. Le JSON d’analyse conserve la sélection, les filtres, les éditions des sources et les résultats non arrondis. Les totaux cumulés se recoupent et ne doivent pas être additionnés. Les polygones d’affichage sont simplifiés. Publiez l’année des sources, la zone de référence, le service et le mode de déplacement avec tout chiffre, et conservez les avertissements sur les données partielles avec le résultat.`,
    },

    "api-cancellation-and-refunds": {
      title: "Résilier l’accès à l’API et remboursements",
      summary:
        "Comment arrêter le renouvellement de l’API, ce qu’il advient de l’accès et du dépassement, et comment demander un remboursement.",
      body: `Arrêter le renouvellement et demander un remboursement sont deux démarches distinctes. Ce guide couvre les deux.

## Arrêter le renouvellement

Un organisateur ouvre [Développeurs](/developers), choisit Gérer la facturation de l’API, puis annule le renouvellement sur la page de facturation de Stripe. Vous n’avez pas besoin de supprimer votre compte. L’accès se poursuit jusqu’à la fin de la période payée. Vos clés cessent de fonctionner à la fin de la couverture, et vous pouvez les révoquer à tout moment.

## Le dépassement en cas de résiliation

Le dépassement déjà utilisé pendant la période en cours reste dû et figure sur la dernière facture. Pour arrêter immédiatement tout nouveau dépassement, désactivez-le ou abaissez le plafond. Le désactiver n’efface pas les frais déjà engagés.

## Remboursements et droit de rétractation

Si vous êtes un consommateur au Royaume-Uni, vous disposez normalement de 14 jours à compter de l’achat pour vous rétracter. Demander que l’accès commence immédiatement ne supprime pas ce droit, mais il peut vous être demandé de payer le service déjà fourni. D’autres droits peuvent s’appliquer selon votre lieu de résidence. Demandez un remboursement via le lien d’assistance indiqué sur votre reçu Stripe, ou écrivez-nous à info@libraries.global. Indiquez la référence de la facture et l’adresse e-mail de votre compte ; n’envoyez jamais de données de carte ni de mot de passe.

Un remboursement intégral de la période en cours, ou une contestation de paiement, met fin à l’accès payant pour cette période. Les remboursements partiels et ceux de périodes antérieures ne suppriment pas une période payée ultérieure.

## Problèmes de paiement

Un renouvellement en échec n’ouvre pas de nouveau quota ; les requêtes sont refusées jusqu’au règlement du paiement. Avant de payer à nouveau après un paiement incertain, vérifiez votre page de facturation et votre reçu Stripe. Consultez la [politique d’annulation et de remboursement](/legal/cancellation-refunds) et les [conditions d’achat de l’API](/legal/membership).`,
    },

    "deleting-an-account-with-api-access": {
      title: "Supprimer un compte qui gère un accès à l’API",
      summary:
        "Ce qu’il faut faire avant de supprimer un compte qui organise un compte API ou un espace de travail du personnel, et ce qui est conservé ensuite.",
      body: `La suppression de votre compte est définitive. Si vous êtes organisateur d’un compte API ou d’un espace de travail du personnel, quelques étapes sont nécessaires au préalable pour que personne d’autre ne perde son accès par surprise.

## Avant de supprimer votre compte

- Si vous êtes le seul organisateur d’un compte API, nommez un autre membre organisateur, ou résiliez l’abonnement API et attendez qu’il prenne fin.
- Si vous êtes le dernier organisateur d’un espace de travail du personnel, transmettez ce rôle à un autre membre, ou supprimez un espace de travail inutilisé.
- Révoquez les clés d’API dont vous n’avez plus besoin. Les clés appartiennent au compte API, et non à vous : elles continuent donc de fonctionner pour l’organisation si celle-ci poursuit son activité.

La suppression est refusée tant que vous êtes le seul organisateur sur lequel d’autres personnes comptent, ou tant que l’arrêt de la facturation ne peut pas être confirmé.

## Un compte API à un seul membre

Si vous avez acheté l’accès à l’API à titre individuel, la suppression résilie d’abord l’abonnement et révoque ses clés. Tout dépassement déjà engagé reste dû. La suppression ne déclenche pas de remboursement automatique ; demandez-en un séparément si vous estimez y avoir droit.

## Ce qui est conservé

Les informations publiques publiées et les contributions acceptées restent en ligne, sans votre nom. Des références de facturation minimales sont conservées pendant six ans à des fins fiscales et comptables ; elles ne permettent ni de vous connecter ni de rétablir un accès. Les relevés d’utilisation ne contiennent ni le texte des requêtes, ni leur corps, ni les adresses IP, ni les clés. Stripe conserve ses propres données financières selon ses conditions de confidentialité.

Consultez [Supprimer votre compte](/knowledge/getting-started/deleting-your-account) et la [politique de confidentialité](/legal/privacy).`,
    },

    "sponsoring-libraries-global": {
      title: "Parrainer Libraries Global",
      summary:
        "Comment les organisations peuvent financer le service public, ce que reçoivent les sponsors et les règles d’indépendance qui s’appliquent à chaque parrainage.",
      body: `Le parrainage finance Libraries Global en tant qu’infrastructure publique gratuite. Il soutient des programmes comme l’accès public, la qualité des données, la traduction, la couverture géographique et les outils ouverts.

## Niveaux suggérés

Nous étudions chaque parrainage au cas par cas. À titre indicatif :

- Sponsor Communauté : ${v.sponsorCommunity} par an
- Sponsor Service : ${v.sponsorService} par an
- Sponsor Fondateur : ${v.sponsorFounding} par an

Ce sont des points de départ pour la discussion, et non des formules assorties d’avantages automatiques. Chaque accord fait l’objet d’un devis et d’un contrat distincts, généralement réglés sur facture, et son traitement fiscal est précisé dans l’accord.

## Ce que reçoivent les sponsors

Avec l’accord du sponsor, nous publions son nom, et son logo s’il le souhaite, dans nos remerciements aux sponsors, avec une description factuelle de ce que le parrainage soutient. Les sponsors reçoivent un point d’activité trimestriel, un rapport d’impact annuel et des réunions d’information.

## Indépendance

Le parrainage n’a jamais d’effet sur les fiches des bibliothèques, les résultats ou le classement des recherches, la vérification du personnel, la modération ou les décisions éditoriales. Les sponsors ne relisent pas les contenus avant publication. Nous pouvons refuser ou mettre fin à un parrainage qui compromettrait cette indépendance.

## Pas un don

Le parrainage est un accord commercial. Ce n’est pas un don à une œuvre caritative et il ne doit pas être considéré comme déductible des impôts, sauf si notre statut juridique change et que nous l’annonçons.

## L’accès à l’API est distinct

Le parrainage ne comprend ni l’accès à l’API ni de capacité d’analyse. Un sponsor qui a besoin de l’API s’y abonne comme n’importe quel autre client, ou convient par écrit d’un arrangement tarifé séparément.

## Nous contacter

Envoyez votre demande via le formulaire de contact ou écrivez à info@libraries.global en indiquant le nom de votre organisation et ce que vous souhaitez soutenir.`,
    },
  },

  /** Short managed note added to related existing guides. */
  relatedNote: {
    heading: "Reconnaissance et formules",
    text: "Les contributions acceptées donnent le statut Contributor et, à partir de 100, la reconnaissance Supporter. La reconnaissance ne débloque jamais de droits de modification ni d’outils payants.",
    links: [
      [
        "Reconnaissance Contributor et Supporter",
        "/knowledge/contributing/earned-recognition-and-rewards",
      ],
      ["Formules et tarifs", "/knowledge/governance/plans-and-pro"],
    ],
  },

  /** Link labels left by earlier rollouts, renamed when related guides are scrubbed. */
  linkLabels: {
    "Formules et Pro": "Formules et tarifs",
    "Formules & Pro": "Formules et tarifs",
    "Accès à l’API Team": "Limites, dépassements et facturation de l’API",
    "Accès à l’API Team et quotas":
      "Limites, dépassements et facturation de l’API",
    "Inscription, clés d’API et première requête":
      "API : votre première clé et votre première requête",
    "Référence des requêtes de l’API Team":
      "Référence de l’API : portées, erreurs et dépannage",
  },
})
