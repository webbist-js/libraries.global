/**
 * Czech Knowledge copy for the free-participation, verified-staff, paid-API
 * and sponsorship model. Figures come from `v` (see `accessValues` in
 * `sponsored-access-content.mjs`), so the copy follows the agreed catalogue.
 *
 * Markdown subset: `## ` and `### ` headings, blank-line paragraphs, `- ` and
 * `1. ` lists, `[label](/path)` links, `**bold**`, `inline code` and fenced
 * code blocks. This module mirrors the keys of the English copy exactly.
 */
export default (v) => ({
  articles: {
    "plans-and-pro": {
      title: "Plány a ceny",
      summary:
        "Co je zdarma, co získáte přispíváním, co dostávají ověření zaměstnanci knihoven a co pokrývá placené API a sponzorství.",
      body: `Libraries Global je bezplatná veřejná infrastruktura. Čtení záznamů knihoven, vyhledávání, používání Atlasu i přispívání jsou zdarma. Placené jsou jen dvě věci: strojový přístup přes API a sponzorství organizací, které chtějí financovat veřejnou službu. Platbou si nikdy nekoupíte důvěru, pořadí ve vyhledávání, zvláštní redakční zacházení ani pravomoci zaměstnance.

## Explorer: každý bezplatný účet

Stránky knihoven, vyhledávání a mapu můžete používat i bez účtu. S bezplatným účtem získáte status Explorer a nástroje, které byly dříve placené:

- srovnání, uložená zobrazení a uložená hledání (od každého až ${v.savedViews})
- upozornění, poznámky a podrobná historie změn na stránkách knihoven
- kontextové vrstvy Atlasu, například hustota obyvatel, srovnání Library access, sociální znevýhodnění a domácnosti bez auta, pokud jsou data k dispozici
- exporty až ${v.exportRows} řádků najednou a až ${v.exportsPerDay} exportů během libovolných 24 hodin

Explorer nezahrnuje výpočty doby cesty Reach. Jejich provoz je nákladný, proto je přispěvatelé a zákazníci API dostávají v omezeném množství.

## Contributor a Supporter: získané, nikdy koupené

Prvním přijatým příspěvkem získáte status Contributor. Contributor může během libovolných sedmi dní spustit ${v.contributorReach}× nový výpočet Reach pro jednu knihovnu. Opětovné otevření shodného uloženého výsledku se do přídělu nepočítá. Reach pro služby a sítě není zahrnut.

Po ${v.supporterThreshold} přijatých příspěvcích získáte uznání Supporter. Supporter je poděkování: nepřidává žádné nástroje, kvóty ani pravomoci. Co se započítává, vysvětluje článek [Uznání Contributor a Supporter](/knowledge/contributing/earned-recognition-and-rewards).

## Ověření zaměstnanci: zdarma pro zaměstnance knihoven

Zaměstnanci, jejichž vztah ke knihovně byl ověřen, spravují její záznam zdarma: otevírací dobu, služby, přístupnost, oznámení, zdroje akcí a zastávky mobilních knihoven. Bezplatný pracovní prostor zaměstnanců umožňuje kolegům spolupracovat, zveřejňovat vložené prvky a widgety a vidět, kdo další je zapojen. Tyto nástroje platí jen pro knihovny, ke kterým máte vlastní ověřený zaměstnanecký přístup. Samotné členství v pracovním prostoru organizace vám nedává možnost upravovat její knihovny. Přečtěte si [Ověření zaměstnanci a bezplatné pracovní prostory](/knowledge/governance/teams-for-library-services).

## Přístup k API: ${v.price} měsíčně

API je určeno pro software, který čte data knihoven, navrhuje změny nebo spouští analýzy pravidelně či ve velkém rozsahu. Stojí ${v.price} měsíčně včetně daně při základní ceně v GBP; konečnou částku včetně případné místní daně vám Stripe ukáže před platbou. Každé zúčtovací období zahrnuje ${v.requests} úspěšných požadavků, ${v.mib} dat v odpovědích a ${v.credits} analytických kreditů. Využití nad tento rámec je odmítnuto, pokud nezapnete nadlimitní využití se stropem.

API účet patří organizaci. Pokud nakupujete jako jednotlivec, při placení se pro vás vytvoří organizace s jediným členem. Nepotřebujete předem pracovní prostor zaměstnanců ani žádný jiný nákup. Začněte články [API Libraries Global](/knowledge/data-api/the-public-api) a [Limity API, nadlimitní využití a fakturace](/knowledge/data-api/team-api-access).

## Sponzorství

Organizace mohou financovat veřejnou službu na základě roční smlouvy. Se souhlasem sponzora jej veřejně uvedeme a budeme informovat o práci, kterou jeho prostředky podporují. Sponzorství nezahrnuje přístup k API a nedává žádný vliv na záznamy, pořadí ve vyhledávání, ověřování ani redakční rozhodnutí. Přečtěte si [Sponzorství Libraries Global](/knowledge/governance/sponsoring-libraries-global).

## Co platba nikdy nezmění

Body, odznaky, uznání, role, moderace ani ověření zaměstnanců se nikdy neprodávají. Placený klíč API ověřuje software; neidentifikuje osobu a nenese pravomoci zaměstnance. Údaje o knihovnách zůstávají ke čtení zdarma a data zůstávají pod svými zveřejněnými licencemi.

## Během uzavřené bety

Dokud trvá uzavřená beta, platba za API probíhá v testovacím režimu Stripe (Test mode) a žádné skutečné peníze se nestrhávají. Některé funkce API zavádíme postupně; stránky pro vývojáře ukazují, co je pro váš účet zapnuto.`,
    },

    "earned-recognition-and-rewards": {
      title: "Uznání Contributor a Supporter",
      summary:
        "Jak vám přijaté příspěvky přinesou status Contributor a po 100 příspěvcích uznání Supporter, co vám každý status dává a co nikdy nedá.",
      body: `Uznání je poděkováním za práci, která zlepšuje společné záznamy. Získáváte je přijatými příspěvky a nelze je koupit.

## Contributor

Prvním přijatým příspěvkem získáte status Contributor. Contributor může v Atlasu během libovolných sedmi dní spustit ${v.contributorReach}× nový výpočet Reach pro jednu knihovnu. Otevření shodného uloženého výsledku je zdarma a do přídělu se nepočítá. Reach pro služby a sítě není zahrnut.

## Supporter

Po ${v.supporterThreshold} přijatých příspěvcích získáte uznání Supporter. Zůstává u vašeho účtu a nepropadá, když si dáte pauzu. Váš profil zvlášť ukazuje, zda jste přispěli v posledních ${v.activityDays} dnech. Supporter nepřidává žádné nástroje, další kvóty ani pravomoci. Kde web Supportery veřejně uvádí, platí vaše nastavení soukromí profilu.

## Co se započítává

Počítáme přijaté příspěvky, jeden za každý přijatý návrh nebo podnět, nikoli váš součet bodů. Započítávají se přijaté nové knihovny, úpravy a opravy záznamů, ověřená otevírací doba nebo kontroly stavu, fotografie s vhodnou licencí, zdroje, texty, úpravy a překlady pro Knowledge a Journal, úkoly a návrhy kampaní, zkontrolovaná diskusní vlákna, odpovědi a úpravy, připojení zdrojů akcí a přijaté návrhy možností kontrolních seznamů.

Nikdy se nezapočítávají: administrativní úpravy bodů, denní série, automatické bonusy, například odměny za dokončení kampaně, hlasy, reakce, koncepty a příspěvky, které stále čekají na kontrolu. Každý přijatý příspěvek se počítá jen jednou, i když je znovu zkontrolován nebo doručen později.

## Body a odznaky

Body, úrovně a odznaky zůstávají pro žebříček a váš profil. Úrovně dál upravují limity příspěvků, například kolik příspěvků může současně čekat na kontrolu. Body a úrovně nikdy neodemykají placené nástroje a odznak není status uznání.

## Odebrání

Moderátoři mohou uznání odebrat, pokud byly příspěvky podvodné nebo duplicitní, například když byla stejná změna opakovaně odesílána kvůli navýšení počtu. Odebráním zaniká status Contributor i Supporter. Zveřejněná veřejná fakta se tím neodstraňují, a pokud si myslíte, že jde o omyl, můžete nás kontaktovat.

## Co uznání nikdy nedává

Uznání nikdy neuděluje práva k úpravám, ověření zaměstnance, moderaci, komunitní roli ani strojový přístup k API. Role vyplývají z udělených rolí (Role Grants) a schválených žádostí o správu knihovny. Přečtěte si [Jak funguje kontrola](/knowledge/governance/how-review-works) a [Body, série a úrovně](/knowledge/contributing/points-streaks-and-tiers).`,
    },

    "teams-for-library-services": {
      title: "Ověření zaměstnanci a bezplatné pracovní prostory",
      summary:
        "Bezplatné nástroje pro ověřené zaměstnance knihoven, jak fungují pracovní prostory zaměstnanců a proč samotné členství v organizaci nikdy nedává oprávnění k úpravám.",
      body: `Zaměstnanci a dobrovolníci, kteří se starají o záznam knihovny, používají Libraries Global zdarma. Platba v přístupu zaměstnanců nehraje žádnou roli.

## Jak se stát ověřeným zaměstnancem

O správu své knihovny požádejte z její stránky nebo přes [Požádat o správu knihovny](/staff/claim). Žádost posoudí moderátor. Po schválení máte k této knihovně zaměstnanecký přístup jako vlastník nebo editor. Organizátor vás také může přiřadit ke knihovně, kterou pokrývá jeho ověřený pracovní prostor. V obou případech je váš přístup zaznamenán u konkrétních knihoven.

## Co mohou ověření zaměstnanci dělat

U knihoven, ke kterým máte zaměstnanecký přístup, můžete upravovat otevírací dobu, služby a informace o přístupnosti, zveřejňovat oznámení, připojovat zdroje akcí a spravovat trasy a zastávky mobilních knihoven. Většina úprav se zveřejní přímo; citlivé změny, například přesun knihovny nebo její trvalé uzavření, dál posuzuje moderátor. Můžete také posuzovat návrhy ostatních, které se týkají vaší knihovny.

## Bezplatné pracovní prostory zaměstnanců

Pracovní prostor zaměstnanců je sdílený prostor organizace: její název, členové, jeden nebo více organizátorů a knihovny, které pokrývá. Založit jej může zdarma každý účet s ověřenou e-mailovou adresou. Pokrytí knihovny ale stále vyžaduje ověřené vlastnické oprávnění k této knihovně.

Pracovní prostory umožňují kolegům vidět, kdo je zapojen, sdílet vložené prvky a widgety, jako jsou vyhledávače knihoven a srovnávací grafy, používat hromadné nahrávání a tam, kde jsou k dispozici, zobrazovat přehledy návštěvnosti. Všechny tyto nástroje fungují jen pro knihovny, ke kterým má daný člověk vlastní ověřený zaměstnanecký přístup.

## Organizátoři a členové

Organizátoři spravují pracovní prostor: jeho název, členy, pozvánky a pokryté knihovny. Členové pracovní prostor vidí a používají zaměstnanecké nástroje, které jim umožňuje jejich vlastní přístup. Role organizátora ani člena sama o sobě nedává oprávnění upravovat žádnou knihovnu. Než poslední organizátor smaže svůj účet, musí roli předat jinému členovi.

## Pracovní prostory a API

Stejná organizace může mít i API účet, ale obojí je oddělené. Pracovní prostor nezahrnuje přístup k API a nákup přístupu k API nikdy neověřuje zaměstnance ani neuděluje práva k úpravám. Přečtěte si [Plány a ceny](/knowledge/governance/plans-and-pro) a [API Libraries Global](/knowledge/data-api/the-public-api).

## Žádné poplatky za místa

Pracovní prostory už nemají poplatky za místa, limity míst ani roční fakturaci. Zaměstnanecké nástroje nezávisí na žádné platbě.`,
    },

    "the-public-api": {
      title: "API Libraries Global",
      summary:
        "Co placené API nabízí, komu je určeno, jak jsou uspořádány API účty a které funkce se zavádějí postupně.",
      body: `API poskytuje softwaru verzovaný přístup ke zveřejněným informacím o knihovnách. Stránky knihoven, vyhledávání a Atlas zůstávají lidem k dispozici zdarma; API je určeno aplikacím, které potřebují data pravidelně nebo ve velkém rozsahu.

## Co můžete dělat

- vyhledávat zveřejněné knihovny a procházet seznamy záznamů se stabilním stránkováním
- číst jednotlivé záznamy knihoven a procházet knihovny podle místa
- číst zveřejněné knihovní služby a sítě a jejich členské knihovny
- posílat návrhy nových knihoven a opravy do fronty moderace
- spouštět ohraničené analýzy, včetně Reach pro knihovnu nebo službu

Každý požadavek používá klíč s odpovídajícím rozsahem. Některé funkce se zavádějí postupně a ještě nemusí být zapnuté; [reference API](/developers/reference) a váš ovládací panel ukazují, co může váš účet volat.

## Cena a zahrnutý objem

Přístup k API stojí ${v.price} měsíčně včetně daně při základní ceně v GBP. Každé zúčtovací období zahrnuje ${v.requests} úspěšných požadavků, ${v.mib} dat v odpovědích a ${v.credits} analytických kreditů, sdílených mezi všemi vašimi klíči. Když se příděl vyčerpá, další požadavky jsou odmítnuty, pokud nemáte zapnuté nadlimitní využití se stropem. Přečtěte si [Limity API, nadlimitní využití a fakturace](/knowledge/data-api/team-api-access).

## API účty a organizace

API účet patří organizaci. Pokud nakupujete jako jednotlivec, při placení se pro vás vytvoří organizace s jediným členem. Organizátoři spravují fakturaci, klíče a nastavení nadlimitního využití; členové vidí využití. Organizace může mít jedno aktivní předplatné API. Pracovní prostor zaměstnanců nepotřebujete a pracovní prostor zaměstnanců přístup k API nezahrnuje.

## Co klíč nedělá

Klíč ověřuje váš software. Není to uživatelská relace a neidentifikuje osobu. Nedává žádné pravomoci zaměstnance, přístup k účtům ani k soukromým datům a neumožňuje přímo zveřejňovat změny. Návrhy odeslané přes API se posuzují stejně jako návrhy kohokoli jiného.

## Licence a uvedení zdroje

Odpovědi obsahují uvedení autorství a záznamy o zdrojích, včetně licence a podmínek dalšího šíření každé datové sady. Uchovávejte je spolu s daty. Placené předplatné nenahrazuje licenci zdroje. Přečtěte si [licenci dat](/legal/data-licence).

## Začínáme

[Vytvořte první klíč a odešlete požadavek](/knowledge/data-api/team-api-quickstart), potom si přečtěte průvodce [reference, rozsahy a řešení potíží](/knowledge/data-api/team-api-reference). Během uzavřené bety probíhá platba v testovacím režimu Stripe (Test mode) a žádné skutečné peníze se nestrhávají.`,
    },

    "team-api-quickstart": {
      title: "API: první klíč a požadavek",
      summary:
        "Kupte si přístup k API, vytvořte klíč se správnými rozsahy a odešlete první ověřený požadavek.",
      body: `Tento návod vás provede cestou od bezplatného účtu k fungujícímu požadavku na API.

## 1. Vytvořte a ověřte účet

Vytvořte si účet na stránce [Registrace](/auth/register) a postupujte podle ověřovacího e-mailu. Během uzavřené bety potřebujete k otevření webu také pozvánku do bety. Pozvánka do bety, účet a klíč API jsou tři různé věci.

## 2. Kupte si přístup k API

Otevřete stránku [Vývojáři](/developers) a zvolte předplatné. Pokud už jste organizátorem nějaké organizace, můžete nakoupit pro ni; jinak se pro vás vytvoří organizace s jediným členem. Zkontrolujte cenu ${v.price} měsíčně, zahrnutý objem a [podmínky nákupu API](/legal/membership), potvrďte svůj souhlas a pokračujte do Stripe Checkout.

Přístup začne až po dokončení platby. Samotná návratová stránka z pokladny jej neaktivuje. Pokud potvrzení chvíli trvá, obnovte stránku s využitím a neplaťte znovu. Během uzavřené bety používejte pouze testovací platební údaje Stripe; žádné skutečné peníze se nestrhávají.

## 3. Vytvořte klíč

Otevřete [Klíče API](/developers/keys), pojmenujte klíč podle aplikace, která ho bude používat, a zvolte jeho rozsahy. Nové klíče mají ve výchozím stavu rozsahy pro čtení: \`search:read\`, \`libraries:read\` a \`services:read\`. Analýzu (\`analysis:run\`) a návrhy (\`submissions:write\`) je nutné potvrdit zvlášť, protože spotřebovávají kredity nebo vytvářejí návrhy.

Jakmile se klíč zobrazí, zkopírujte jej celý. Zobrazí se jen jednou; uchováváme pouze jeho otisk a krátkou předponu. Uložte jej do úložiště tajných údajů na svém serveru. Nikdy jej nevkládejte do kódu v prohlížeči, do veřejného repozitáře, do URL adresy ani do zprávy podpoře.

## 4. Odešlete požadavek

Tento příklad načte jeden zveřejněný záznam knihovny. Potřebuje klíč s rozsahem \`libraries:read\`.

\`\`\`bash
read -r -s -p 'Libraries Global API key: ' LIBRARIES_API_KEY
export LIBRARIES_API_KEY
printf '\\n'
curl --fail-with-body --include 'https://libraries.global/api/v1/libraries?locale=en&limit=1' \\
  -H "Authorization: Bearer $LIBRARIES_API_KEY"
\`\`\`

Vyhledávání potřebuje rozsah \`search:read\`. Prázdné pole \`data\` znamená úspěšné vyhledávání bez výsledků.

\`\`\`bash
curl --fail-with-body 'https://libraries.global/api/v1/search/libraries' \\
  -H "Authorization: Bearer $LIBRARIES_API_KEY" \\
  -H 'Content-Type: application/json' \\
  --data '{"q":"Bristol","locale":"en","limit":2}'
\`\`\`

## 5. Zkontrolujte využití

Otevřete [Využití](/developers/usage). Úspěšné požadavky a bajty odpovědí se započítávají do přídělu daného období. Neúspěšné požadavky příděl nečerpají, ale každý pokus se počítá do limitu frekvence požadavků.

## Další kroky

Přečtěte si [Limity API, nadlimitní využití a fakturace](/knowledge/data-api/team-api-access), průvodce [reference, rozsahy a řešení potíží](/knowledge/data-api/team-api-reference) a [Jak používat API playground](/knowledge/data-api/api-playground).`,
    },

    "team-api-access": {
      title: "Limity API, nadlimitní využití a fakturace",
      summary:
        "Zahrnutý objem, limity frekvence, zúčtovací období, volitelné nadlimitní využití se stropem a co se nikdy neúčtuje.",
      body: `Jeden API účet má jeden společný příděl pro všechny své klíče a aplikace. Přidáním nebo obnovením klíčů se příděl nikdy nezvyšuje ani nenuluje.

## Zahrnuto v každém zúčtovacím období

- ${v.requests} úspěšných požadavků
- ${v.mib} (${v.bytes} bajtů) nekomprimovaných dat JSON v odpovědích
- ${v.credits} analytických kreditů

Zúčtovací období je uhrazené období vašeho předplatného, od jeho počátečního okamžiku až do koncového okamžiku (ten už do období nepatří), v čase UTC. Řídí se datem vaší platby, ne kalendářním měsícem. První, neúplné období dostává plný příděl. Příděl nového období začíná až po dokončení jeho platby; neúspěšná platba neotevírá bezplatné využití. Nevyužitý příděl se do dalšího období nepřevádí.

## Limity frekvence a velikosti

Váš účet může provést až ${v.attemptsPerMinute} pokusů o požadavek za minutu; limit souběžných požadavků je ${v.concurrent}. Odpověď může mít nejvýše ${v.maxResponse} a stránka obsahuje nejvýše ${v.pageSize} záznamů. Pokud by odpověď byla příliš velká, vyžádejte si menší stránku.

## Co se započítává

Každá úspěšná odpověď se počítá jako jeden požadavek a její nekomprimovaná velikost JSON se započítává do dat v odpovědích, a to i u opakovaných požadavků a odpovědí z mezipaměti. Analytické kredity se spotřebují jen po dokončení nové úlohy. Neúspěšné, odmítnuté a časově vypršelé požadavky se do přídělu nezapočítávají, ale každý pokus se počítá do limitu frekvence.

## Když se příděl vyčerpá

Bez nadlimitního využití je další požadavek, který by příděl překročil, odmítnut s HTTP 429 a kódem, který daný příděl označuje. Ovládací panel ukazuje, kolik zbývá a kdy se období obnoví. Upozornění se zobrazí při 50 %, 80 % a 100 % každého přídělu.

## Nadlimitní využití se stropem

Nadlimitní využití je vypnuté, dokud jej organizátor nezapne a nepřijme podmínky nadlimitního využití. Nad rámec zahrnutého objemu stojí ${v.requestRate} za požadavek, ${v.mibRate} za MiB dat v odpovědích a ${v.creditRate} za analytický kredit, bez daně. Nadlimitní data se počítají podle přesného počtu bajtů navíc a nezaokrouhlují se nahoru po jednotlivých požadavcích.

Musíte zvolit měsíční strop mezi ${v.capMin} a ${v.capMax}, v krocích po ${v.capStep}. Doporučená hodnota je ${v.capDefault}, ale nic se nezapne, dokud volbu nepotvrdíte. Strop zahrnuje celkové nadlimitní využití za požadavky, data a kredity bez daně. Pokud by vás další požadavek nebo úloha mohly dostat nad strop, jsou místo toho odmítnuty. Upozornění se zobrazí při 50 %, 80 % a 100 % stropu. Strop můžete kdykoli snížit nebo nadlimitní využití vypnout; tím zastavíte další placené využití, ale nezrušíte již vzniklé poplatky. Ovládací panel ukazuje dosavadní nadlimitní využití a odhad příští faktury.

## Co se nikdy neúčtuje

Neúčtujeme neúspěšnou, odmítnutou, časově vypršelou ani interně opakovanou práci a nikdy nedochází k přečerpání bez stropu. Pokud se potvrzení fakturace zpozdí, aplikace vaše limity dál uplatňuje.

## Platby a faktury

Přístup k API stojí ${v.price} měsíčně včetně daně při základní ceně v GBP; konečnou částku vám Stripe ukáže před platbou. Nadlimitní využití, je-li zapnuté, se objeví na příští faktuře. Organizátoři spravují platební údaje, faktury a zrušení na stránce [Vývojáři](/developers). Přečtěte si [Zrušení přístupu k API a vrácení peněz](/knowledge/data-api/api-cancellation-and-refunds) a [podmínky nákupu API](/legal/membership).

## Reach v prohlížeči pro organizátory API

Dokud má váš API účet uhrazené pokrytí, dostávají jeho organizátoři v Atlasu také příděl Reach v prohlížeči: ${v.apiReachPerHour} nových výpočtů za hodinu, až ${v.serviceLibraries} způsobilých knihoven na službu, se společným stropem ${v.apiReachPerDay} nových výpočtů denně pro celý API účet. Členové jej nedědí. Je oddělený od analytických kreditů samotného API.`,
    },

    "team-api-reference": {
      title: "Reference API: rozsahy, chyby a řešení potíží",
      summary:
        "Ověřování, rozsahy klíčů, stránkování, hlavičky odpovědí, chybové kódy a co dělat, když požadavek selže.",
      body: `Používejte \`https://libraries.global\` přes HTTPS a s každým požadavkem posílejte \`Authorization: Bearer YOUR_API_KEY\`. [Reference požadavků](/developers/reference) uvádí všechny koncové body, parametry a pole odpovědí. Tento průvodce vysvětluje pravidla, která mají společná.

## Rozsahy

- \`search:read\`: vyhledávání knihoven
- \`libraries:read\`: záznamy knihoven, seznamy a místa
- \`services:read\`: zveřejněné knihovní služby a sítě
- \`analysis:run\`: analytické úlohy a úlohy Reach, které spotřebovávají analytické kredity
- \`submissions:write\`: návrhy nových knihoven a opravy k moderaci

Nové klíče mají ve výchozím stavu tři rozsahy pro čtení. Analýzu a návrhy je nutné potvrdit při vytváření klíče. Každé aplikaci dejte vlastní klíč jen s rozsahy, které potřebuje.

## Stránkování a záznamy

Seznamy vracejí nejvýše ${v.pageSize} záznamů. Hodnotu \`meta.nextCursor\` posílejte zpět jako \`after\`, dokud nebude null, a zachovejte stejný jazyk (locale) i filtry. Kurzory považujte za neprůhledné. Záznamy se během stránkování mohou měnit, proto si u každého záznamu uložte \`entityRef\` a \`updatedAt\`. Hodnotu \`entityRef\` kódujte jako jeden segment cesty, například pomocí \`encodeURIComponent\`. Přijímají se pouze aktivní jazyky obsahu.

## Hlavičky odpovědí

Úspěšné odpovědi obsahují \`X-Request-Id\` a hlavičky se zbývajícím přídělem a časem obnovení období. Odpovědi jsou soukromé pro váš klíč a nesmějí se ukládat do sdílené mezipaměti.

## Chyby

Chyby mají tvar \`{"error":{"code":"..."}}\`. Před opakováním zkontrolujte stav HTTP a kód.

- 400: požadavek je chybně utvořený nebo používá nepodporovaný jazyk, filtr či kurzor. Před opakováním jej opravte.
- 401: klíč chybí, je chybně utvořený, vypršel, byl zrušen nebo nahrazen. Neopakujte požadavky se stejným klíčem.
- 403: klíči chybí rozsah nebo API účet nemá uhrazené pokrytí. Obraťte se na organizátora.
- 404: záznam, služba, úloha nebo návrh neexistuje nebo vám nepatří.
- 413: tělo požadavku je příliš velké.
- 429: byl dosažen limit. \`rate_limit\` a \`concurrency_limit\` znamenají, že máte zpomalit. \`quota_requests\`, \`quota_bytes\` a \`quota_analysis\` znamenají vyčerpaný příděl. \`overage_cap\` znamená, že další poplatek by překročil váš strop. Pokud odpověď obsahuje \`Retry-After\`, řiďte se jím.
- 502 nebo 503: problém navazující služby nebo účtování, případně odpověď, která by překročila ${v.maxResponse}. Opakujte s postupně delší prodlevou nebo si vyžádejte menší stránku.

Neúspěšné požadavky nečerpají váš příděl ani kredity.

## Řešení potíží

- **Po zaplacení nic nefunguje:** počkejte, až ovládací panel ukáže aktivní přístup s dokončenou platbou. Samotná návratová stránka z pokladny API neaktivuje.
- **401 hned po obnovení klíče:** všechny aplikace musí přejít na nový klíč; starý přestane fungovat okamžitě.
- **403 u nové funkce:** zkontrolujte, zda má klíč potřebný rozsah a zda je funkce pro váš účet zapnutá.
- **Opakované 429:** snižte počet souběžných požadavků na ${v.concurrent}, rozložte požadavky v čase nebo zkontrolujte, zda jste nevyčerpali příděl či strop nadlimitního využití.

Když píšete na info@libraries.global, uveďte koncový bod, stav HTTP, chybový kód a \`X-Request-Id\`. Nikdy neposílejte svůj klíč, hlavičku Authorization ani platební údaje.`,
    },

    "api-playground": {
      title: "Jak používat API playground",
      summary:
        "Vyzkoušejte skutečné požadavky na API v prohlížeči s vlastním klíčem. Požadavky z playgroundu se měří stejně jako jakékoli jiné.",
      body: `[Playground](/developers/playground) posílá z vašeho prohlížeče skutečné požadavky na verzované API, takže si koncové body můžete vyzkoušet dřív, než začnete psát kód.

## Než začnete

Potřebujete API účet s uhrazeným pokrytím a existující klíč. Vložte klíč do playgroundu. Uchovává se jen v paměti stránky: neukládá se, nezaznamenává se a neposílá se nikam jinam než do API. Po opětovném načtení stránky zmizí.

## Požadavky z playgroundu se počítají

Playground nemá žádnou bezplatnou ani soukromou zkratku. Každý požadavek používá rozsahy, limity frekvence a příděl vašeho klíče přesně tak jako vaše aplikace. Úspěšné požadavky a data jejich odpovědí se počítají do přídělu; analytické úlohy spotřebovávají kredity; se zapnutým nadlimitním využitím se mohou započítat i do něj. Neúspěšné požadavky příděl nečerpají. Nic se nespustí, dokud nezvolíte Run.

## Procházení

Procházejte místa od zemí po regiony a oblasti, vyhledávejte knihovny, vypište knihovny daného místa a otevřete záznam. Každý krok je běžný požadavek. Pokud má váš účet příslušné funkce zapnuté, můžete také číst služby, kontrolovat stav návrhu nebo spustit analytickou úlohu.

## Přechod na vlastní kód

Zkopírujte požadavek, který playground zobrazí, do své aplikace. Klíč uchovávejte na svém serveru. Chyby a limity popisuje průvodce [reference, rozsahy a řešení potíží](/knowledge/data-api/team-api-reference).`,
    },

    "api-services-submissions-and-analysis": {
      title: "Data služeb, návrhy a analytické kredity",
      summary:
        "Čtěte knihovní služby, navrhujte nové knihovny a opravy ke kontrole a spouštějte ohraničené analýzy a úlohy Reach s analytickými kredity.",
      body: `Tyto funkce API se zavádějí postupně a zapínají se samostatně. Váš ovládací panel a [reference požadavků](/developers/reference) ukazují, které jsou pro váš účet dostupné.

## Knihovní služby a sítě

S rozsahem \`services:read\` můžete vypsat zveřejněné knihovní služby a sítě, načíst jednu z nich podle stálé reference a vypsat její zveřejněné členské knihovny. Ne každá síť je veřejná knihovní služba: odpověď uvádí její druh. Členství vychází z našich záznamů, ne z vašeho požadavku. Členství knihovny ve službě nepředstavuje pravomoc zaměstnance. Uvedení zdrojů uchovávejte spolu s daty.

## Návrhy

S rozsahem \`submissions:write\` můžete navrhnout novou knihovnu nebo opravu zveřejněného záznamu. Přiložte své důkazy nebo zdroj a jedinečný idempotenční klíč, aby opakovaný pokus nevytvořil druhý návrh. Chráněná a libovolná pole jsou odmítnuta.

Každý návrh vstupuje do běžné fronty moderace. Nikdy se nezveřejní přímo a posuzuje se stejně jako návrh kohokoli jiného. Klíč nemůže tvrdit, že jedná jménem zaměstnanců knihovny. Stav návrhu můžete kontrolovat, ale poznámky kontrolujících ani soukromé údaje neuvidíte. Návrhy nepřinášejí API účtu body ani uznání. Přijaté texty a data se zveřejňují pod [licencí dat](/legal/data-licence), proto posílejte jen materiály, které máte právo sdílet.

## Analýza a Reach

S rozsahem \`analysis:run\` si můžete vyžádat souhrnnou analýzu zveřejněné služby nebo oblasti a Reach pro jednu knihovnu nebo celou službu. Náročnější práce běží jako úloha: dostanete ID úlohy, zkontrolujete její stav a poté si stáhnete výsledek.

Analytické kredity se spotřebují jen po dokončení nové úlohy:

- jednoduchý souhrn: ${v.summaryCredits} kredit; podrobnější souhrn: ${v.richSummaryCredits} kreditů
- Reach pro jednu knihovnu: ${v.libraryReachCredits} kreditů
- Reach pro službu: ${v.serviceReachCredits} kreditů
- Reach pro síť, pokud bude zapnut po samostatném posouzení kapacity: ${v.networkReachCredits} kreditů

Shodný výsledek z mezipaměti nespotřebuje žádné kredity, ale jeho načtení se počítá jako požadavek a data odpovědi. Opětovné načtení dokončeného výsledku nikdy nespotřebuje další kredit. Úloha, která by se nevešla do zbývajících kreditů nebo stropu nadlimitního využití, je odmítnuta ještě před spuštěním. Neúspěšná, zrušená nebo vypršelá úloha rezervované kredity vrací.

Vstupy jsou ohraničené. API nepřijímá libovolné polygony, seznamy souřadnic, vlastní výběr členství ve službě ani neomezené dávky. Výsledky zůstávají pod ${v.maxResponse}; rozsáhlá geometrie není v základním API dostupná. Dokončené výsledky se uchovávají po omezenou dobu uvedenou ve stavu úlohy a poté se smažou.

## Čtení výsledků

Reach modeluje zeměpisnou blízkost. Neměří návštěvy, vstup ani bezbariérový přístup a částečné výsledky zůstávají částečné. Než zveřejníte jakékoli číslo, přečtěte si [Reach pěšky, na kole a pro služby](/knowledge/data-api/understanding-library-reach).`,
    },

    "exporting-from-the-atlas": {
      title: "Exporty z Atlasu a limity Reach",
      summary:
        "Exportujte filtrované výběry knihoven, stahujte výsledky Reach a zjistěte, kdo může Reach spouštět a v jakém rozsahu.",
      body: `Každý přihlášený účet může exportovat filtrovaný výběr z Atlasu jako CSV nebo GeoJSON. Stažení jednotlivých záznamů knihoven zůstává veřejné. Export záznamů a stažení výsledku Reach jsou samostatné akce.

## Export výběru knihoven

Zužte výběr filtry nebo mapou, přepněte na Seznam a zvolte Exportovat. CSV se hodí pro tabulky; GeoJSON zachovává body na mapě. Každý export může obsahovat až ${v.exportRows} knihoven a během libovolných 24 hodin můžete provést až ${v.exportsPerDay} exportů. Větší výběr nejprve zužte. Tyto limity platí pro lidi, kteří používají Atlas; pravidelné nebo větší výpisy získávejte přes API.

## Zachovejte zdroje a rozsah

Exporty obsahují identifikátory knihoven, dostupné údaje pro návštěvu a kontakt, polohy a informace o zdrojích. Záznamy o zdrojích, uvedení autorství, licence a data získání uchovávejte spolu s daty. Prázdné pole znamená, že záznam danou hodnotu nemá, nikoli že odpověď zní Ne.

## Kdo může spouštět Reach

Výpočet Reach je nákladný, proto má vlastní příděly:

- účty Explorer: žádné výpočty Reach
- Contributor: ${v.contributorReach}× nový výpočet pro jednu knihovnu během libovolných sedmi dní; bez Reach pro služby a sítě
- organizátoři API účtu s uhrazeným pokrytím: ${v.apiReachPerHour} nových výpočtů za hodinu, včetně Reach pro služby, se společným stropem ${v.apiReachPerDay} výpočtů denně pro celý API účet

Otevření shodného uloženého výsledku nový výpočet nespotřebuje. Status ověřeného zaměstnance tyto příděly nemění.

## Limity velikosti služby

Reach pro službu přijme až ${v.serviceLibraries} způsobilých knihoven. Při všech čtyřech dobách cesty se služba a její vykazovaná oblast musí vejít do ${v.area4} a rozpětí ${v.span4}. Při volbě jedné doby cesty je limit ${v.area1} a ${v.span1}. Jde o konzervativní ohraničující obdélníky, nikoli o skutečnou plochu území. Omezené jsou také doba výpočtu, počet rastrových buněk a sdílená fronta, takže požadavek v rámci těchto velikostí může být přesto nedostupný.

## Stažení výsledků Reach

V panelu Reach použijte Stažení a zvolte CSV, zobrazovací GeoJSON nebo Analysis JSON. Analysis JSON zachovává výběr, filtry, vydání zdrojů a nezaokrouhlené výsledky. Kumulativní počty se překrývají a nesmějí se sčítat. Zobrazované polygony jsou zjednodušené. U každého zveřejněného čísla uveďte rok zdroje, vykazovanou oblast, službu a způsob dopravy a ponechte u výsledku upozornění na neúplná data.`,
    },

    "api-cancellation-and-refunds": {
      title: "Zrušení přístupu k API a vrácení peněz",
      summary:
        "Jak zastavit obnovování přístupu k API, co se stane s přístupem a nadlimitním využitím a jak požádat o vrácení peněz.",
      body: `Zastavení obnovování a žádost o vrácení peněz jsou dvě různé věci. Tento návod popisuje obojí.

## Zastavení obnovování

Organizátor otevře stránku [Vývojáři](/developers), zvolí Spravovat fakturaci API a na fakturační stránce Stripe zruší obnovování. Účet mazat nemusíte. Přístup trvá do konce uhrazeného období. Po skončení pokrytí přestanou vaše klíče fungovat; zrušit je můžete kdykoli.

## Nadlimitní využití při zrušení

Nadlimitní využití z aktuálního období zůstává splatné a objeví se na konečné faktuře. Chcete-li další nadlimitní využití zastavit okamžitě, vypněte je nebo snižte strop. Vypnutím se již vzniklé poplatky nesmažou.

## Vrácení peněz a právo na odstoupení

Pokud jste spotřebitel ve Spojeném království, máte obvykle 14 dní od nákupu na odstoupení od smlouvy. Žádost o okamžité zahájení přístupu vás tohoto práva nezbavuje, ale můžete být požádáni o úhradu již poskytnuté služby. V místě vašeho bydliště mohou platit i další práva. O vrácení peněz požádejte přes podporu transakce uvedenou na účtence od Stripe, nebo nám napište na info@libraries.global. Uveďte číslo faktury a e-mail svého účtu; nikdy neposílejte údaje o kartě ani hesla.

Plné vrácení peněz za aktuální období nebo platební spor ukončí placený přístup pro toto období. Částečné vrácení peněz ani vrácení za dřívější období neruší pozdější uhrazené období.

## Problémy s platbou

Neúspěšné obnovení neotevírá nový příděl; požadavky jsou odmítány, dokud platba neproběhne. Než po nejisté platbě zaplatíte znovu, zkontrolujte fakturační stránku a účtenku od Stripe. Přečtěte si [zásady zrušení a vracení peněz](/legal/cancellation-refunds) a [podmínky nákupu API](/legal/membership).`,
    },

    "deleting-an-account-with-api-access": {
      title: "Smazání účtu, který spravuje přístup k API",
      summary:
        "Co udělat před smazáním účtu, který je organizátorem API účtu nebo pracovního prostoru zaměstnanců, a co se po smazání uchovává.",
      body: `Smazání účtu je trvalé. Pokud jste organizátorem API účtu nebo pracovního prostoru zaměstnanců, musí se nejprve stát několik věcí, aby nikdo jiný nečekaně nepřišel o přístup.

## Před smazáním

- Pokud jste jediným organizátorem API účtu, udělejte organizátorem jiného člena, nebo zrušte předplatné API a počkejte, až skončí.
- Pokud jste posledním organizátorem pracovního prostoru zaměstnanců, předejte roli organizátora jinému členovi, nebo nepoužívaný pracovní prostor odstraňte.
- Zrušte klíče API, které už nepotřebujete. Klíče patří API účtu, ne vám, takže pokud organizace pokračuje, fungují pro ni dál.

Smazání je odmítnuto, dokud jste jediným organizátorem, na kterém závisejí ostatní, nebo dokud nelze potvrdit, že fakturace byla zastavena.

## API účet s jediným členem

Pokud jste si přístup k API koupili jako jednotlivec, smazání nejprve zruší předplatné a jeho klíče. Již vzniklé nadlimitní využití zůstává splatné. Smazání automaticky nevrací peníze; pokud si myslíte, že vám vrácení náleží, požádejte o ně zvlášť.

## Co se uchovává

Zveřejněná veřejná fakta a přijaté příspěvky zůstávají, ale bez vašeho jména. Minimální fakturační odkazy uchováváme šest let pro daňové a účetní účely; nelze se jimi přihlásit ani obnovit přístup. Záznamy o využití neobsahují text požadavků, těla požadavků, IP adresy ani klíče. Stripe uchovává vlastní finanční záznamy podle svých zásad ochrany soukromí.

Přečtěte si [Smazání účtu](/knowledge/getting-started/deleting-your-account) a [zásady soukromí](/legal/privacy).`,
    },

    "sponsoring-libraries-global": {
      title: "Sponzorství Libraries Global",
      summary:
        "Jak mohou organizace financovat veřejnou službu, co sponzoři dostávají a jaká pravidla nezávislosti platí pro každé sponzorství.",
      body: `Sponzorství financuje Libraries Global jako bezplatnou veřejnou infrastrukturu. Hradí programy, jako je veřejný přístup, práce na kvalitě dat, překlady, geografické pokrytí a otevřené nástroje.

## Začněte rozhovorem

Každé sponzorství začíná rozhovorem o tom, co chcete podpořit, na jak dlouho a jak vás budeme informovat. Napište na info@libraries.global nebo použijte formulář na [stránce o sponzorství](/sponsor).

Každá smlouva se nabízí a uzavírá zvlášť, obvykle na fakturu, a její daňové zacházení se potvrdí přímo ve smlouvě.

## Co sponzoři dostávají

Se souhlasem sponzora zveřejníme v poděkování sponzorům jeho název, a pokud si to přeje, i logo, spolu s věcným popisem toho, co sponzorství podporuje. Sponzoři dostávají čtvrtletní zprávy o činnosti, výroční zprávu o dopadu a informační schůzky.

## Nezávislost

Sponzorství nikdy neovlivňuje záznamy knihoven, výsledky ani pořadí ve vyhledávání, ověřování zaměstnanců, moderaci ani redakční rozhodnutí. Sponzoři obsah před zveřejněním nekontrolují. Sponzorství, které by tuto nezávislost ohrozilo, můžeme odmítnout nebo ukončit.

## Nejde o dar

Sponzorství je obchodní smlouva. Není to charitativní dar a nemělo by se považovat za daňově odpočitatelné, dokud se náš právní status nezmění a my to neoznámíme.

## Přístup k API je samostatný

Sponzorství nezahrnuje přístup k API ani analytickou kapacitu. Sponzor, který API potřebuje, si je předplatí jako kterýkoli jiný zákazník, nebo si písemně sjedná samostatně oceněné ujednání.

## Kontakt

Pošlete dotaz přes kontaktní formulář nebo napište na info@libraries.global. Uveďte název své organizace a co byste chtěli podpořit.`,
    },
  },

  /** Short managed note added to related existing guides. */
  relatedNote: {
    heading: "Uznání a plány",
    text: "Přijaté příspěvky přinášejí status Contributor a po 100 příspěvcích uznání Supporter. Uznání nikdy neodemyká práva k úpravám ani placené nástroje.",
    links: [
      [
        "Uznání Contributor a Supporter",
        "/knowledge/contributing/earned-recognition-and-rewards",
      ],
      ["Plány a ceny", "/knowledge/governance/plans-and-pro"],
    ],
  },

  /** Link labels left by earlier rollouts, renamed when related guides are scrubbed. */
  linkLabels: {
    "Tarify a Pro": "Plány a ceny",
    "Plány a Pro": "Plány a ceny",
    "Plány & Pro": "Plány a ceny",
    "Přístup k Team API": "Limity API, nadlimitní využití a fakturace",
    "Plans and Pro": "Plány a ceny",
    "Plans & Pro": "Plány a ceny",
    "Team API access": "Limity API, nadlimitní využití a fakturace",
    "Team API access and allowances":
      "Limity API, nadlimitní využití a fakturace",
    "Signup, API keys and your first request": "API: první klíč a požadavek",
    "Team API request reference":
      "Reference API: rozsahy, chyby a řešení potíží",
  },
})
