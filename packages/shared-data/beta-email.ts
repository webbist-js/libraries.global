import { emailTemplate } from "./email"
import { isSupportedLocale, type SupportedLocale } from "./locales"

const COPY: Record<
  SupportedLocale,
  {
    title: string
    body: string
    action: string
    codeLabel: string
    footer: string
  }
> = {
  en: {
    title: "Your Libraries Global beta invitation",
    body: "There's a place for you in the closed beta. Open your invitation and press Enter beta, or paste the invite code below into the beta entrance.\n\nYour invitation can be used once and expires in seven days. Once accepted, this browser has access for 30 days. Please keep your invitation private.\n\nThis is a developing service: features may break and test data may be reset. Creating an account is optional and separate from beta access.",
    action: "Enter beta",
    codeLabel: "Invite code",
    footer:
      "You're receiving this because you requested beta access. This does not subscribe you to a newsletter. For help or to withdraw your request, reply to this email.",
  },
  cs: {
    title: "Vaše pozvánka do bety Libraries Global",
    body: "V uzavřené betě je pro vás místo. Otevřete pozvánku a stiskněte Vstoupit do bety, nebo vložte níže uvedený kód na vstupní stránce.\n\nPozvánku lze použít jednou a platí sedm dní. Po přijetí získá tento prohlížeč přístup na 30 dní. Pozvánku nesdílejte.\n\nSlužba se vyvíjí: funkce mohou přestat fungovat a testovací data mohou být smazána. Vytvoření účtu je volitelné a nezávislé na přístupu do bety.",
    action: "Vstoupit do bety",
    codeLabel: "Kód pozvánky",
    footer:
      "Tento e-mail dostáváte, protože jste požádali o přístup do bety. Nepřihlašuje vás k newsletteru. Pro pomoc nebo odvolání žádosti odpovězte na tento e-mail.",
  },
  es: {
    title: "Su invitación a la beta de Libraries Global",
    body: "Tiene un lugar en la beta cerrada. Abra su invitación y pulse Entrar en la beta, o pegue el código de invitación de abajo en la página de entrada.\n\nLa invitación se puede usar una sola vez y caduca en siete días. Una vez aceptada, este navegador tendrá acceso durante 30 días. Mantenga su invitación en privado.\n\nEs un servicio en desarrollo: algunas funciones pueden fallar y los datos de prueba pueden restablecerse. Crear una cuenta es opcional e independiente del acceso a la beta.",
    action: "Entrar en la beta",
    codeLabel: "Código de invitación",
    footer:
      "Recibe este correo porque solicitó acceso a la beta. No le suscribe a ningún boletín. Para obtener ayuda o retirar su solicitud, responda a este correo.",
  },
  fr: {
    title: "Votre invitation à la bêta de Libraries Global",
    body: "Une place vous attend dans la bêta fermée. Ouvrez votre invitation et appuyez sur Entrer dans la bêta, ou collez le code ci-dessous sur la page d'entrée.\n\nL'invitation est utilisable une seule fois et expire dans sept jours. Après acceptation, ce navigateur aura accès pendant 30 jours. Gardez votre invitation privée.\n\nLe service est en développement : des fonctions peuvent tomber en panne et les données de test peuvent être réinitialisées. La création d'un compte est facultative et distincte de l'accès à la bêta.",
    action: "Entrer dans la bêta",
    codeLabel: "Code d'invitation",
    footer:
      "Vous recevez cet e-mail parce que vous avez demandé l'accès à la bêta. Cela ne vous abonne pas à une newsletter. Pour obtenir de l'aide ou retirer votre demande, répondez à cet e-mail.",
  },
}

export function betaInvitationEmail(input: {
  code: string
  locale?: string
  siteUrl: string
}) {
  const locale = isSupportedLocale(input.locale) ? input.locale : "en"
  const copy = COPY[locale]
  const prefix = locale === "en" ? "" : `/${locale}`

  return emailTemplate({
    ...copy,
    eyebrow: "Libraries Global · Beta",
    siteUrl: input.siteUrl,
    code: input.code,
    url: `${input.siteUrl.replace(/\/$/, "")}${prefix}/beta#invite=${encodeURIComponent(input.code)}`,
  })
}
