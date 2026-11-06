import { Check, ShieldCheck } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"

import { WorkspaceHero } from "@/components/dashboard/WorkspaceHero"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { buttonVariants } from "@/components/ui/button"
import { featureSignInHref, type AccessFeature } from "@/lib/feature-access"
import { safeRedirectPath } from "@/lib/safe-redirect"
import { cn } from "@/lib/styles"

const PUBLIC_DESTINATIONS: Record<AccessFeature, string> = {
  networks: "/library-networks",
  teams: "/library-networks",
  widgets: "/libraries",
  api: "/developers/reference",
  claim: "/libraries",
  index: "/libraries",
  add: "/libraries",
  writing: "/journal",
  roles: "/knowledge",
}

function requirementKey(feature: AccessFeature, teamFeature: boolean) {
  if (feature === "api") return "apiRequired"

  return teamFeature ? "teamRequired" : "freeAccount"
}

/** Only explanatory product copy reaches this view; no workspace data is loaded. */
export async function FeatureAccessLanding({
  feature,
  signedIn = false,
  returnTo,
  signInHref,
}: {
  readonly feature: AccessFeature
  readonly signedIn?: boolean
  readonly returnTo?: string
  readonly signInHref?: string
}) {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("featureAccess"),
  ])
  const memberTitleKey =
    feature === "teams" || feature === "widgets" || feature === "api"
      ? (`${feature}.memberTitle` as const)
      : null
  const needsTeam = signedIn && memberTitleKey !== null
  const signIn = safeRedirectPath(
    signInHref,
    featureSignInHref(feature, locale, returnTo)
  )
  // Workspaces are free: a signed-in member without one is offered to
  // create one or claim a library, never a plan. API access lives on /developers.
  const primary = !needsTeam
    ? { href: signIn, label: t(`${feature}.action`) }
    : feature === "api"
      ? { href: "/developers", label: t("openDevelopers") }
      : { href: "/staff/teams/new", label: t("setUpTeam") }
  const secondary = !needsTeam
    ? { href: "/auth/register", label: t("createAccount") }
    : feature === "api"
      ? null
      : { href: "/staff/claim", label: t("claimLibrary") }

  return (
    <>
      <WorkspaceHero
        variant="card"
        compact
        plainTitle
        title={
          needsTeam && memberTitleKey
            ? t(memberTitleKey)
            : t(`${feature}.title`)
        }
        eyebrow={t("eyebrow")}
        lead={t(`${feature}.lead`)}
      />
      <Container className="grid items-start gap-6 py-8 sm:py-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <section
          aria-labelledby="feature-benefits"
          className="min-w-0 rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-7"
        >
          <h2 id="feature-benefits" className="type-h2 m-0">
            {t("benefitsTitle")}
          </h2>
          <ul className="m-0 mt-6 grid list-none gap-5 p-0">
            {(["one", "two", "three"] as const).map((key) => (
              <li
                key={key}
                className="flex items-start gap-3 text-base leading-relaxed text-(--t-ink-dim)"
              >
                <Check
                  size={21}
                  className="mt-0.5 shrink-0 text-(--t-accent-primary)"
                  aria-hidden
                />
                {t(`${feature}.benefits.${key}`)}
              </li>
            ))}
          </ul>
          <div className="mt-7 border-t border-(--t-border-line) pt-6">
            <h3 className="type-h3 m-0 flex items-center gap-2">
              <ShieldCheck size={21} aria-hidden />
              {t("accessTitle")}
            </h3>
            <p className="mt-3 mb-0 text-base leading-relaxed text-(--t-ink-dim)">
              {t(`${feature}.requirement`)}
            </p>
          </div>
        </section>
        <aside
          className="order-first min-w-0 rounded-3xl bg-(--t-accent-chip) p-5 sm:p-7 lg:order-last"
          aria-labelledby="feature-next-step"
        >
          <p className="m-0 mb-4 inline-flex rounded-full bg-(--t-bg-deep) px-3 py-1 text-sm font-semibold text-(--t-accent-primary)">
            {t(requirementKey(feature, memberTitleKey !== null))}
          </p>
          <h2 id="feature-next-step" className="type-h2 m-0">
            {t(needsTeam ? "teamTitle" : "accountTitle")}
          </h2>
          <p className="mt-3 mb-6 text-base leading-relaxed text-(--t-ink-dim)">
            {t(needsTeam ? "teamNote" : "accountNote")}
          </p>
          <div className="flex flex-col items-start gap-3">
            <GlobalLink
              href={primary.href}
              className={cn(
                buttonVariants({ variant: "primary", size: "pill" }),
                "h-auto max-w-full text-center whitespace-normal"
              )}
            >
              {primary.label}
            </GlobalLink>
            {secondary ? (
              <GlobalLink
                href={secondary.href}
                className={cn(
                  buttonVariants({ variant: "surface", size: "pill" }),
                  "h-auto max-w-full text-center whitespace-normal"
                )}
              >
                {secondary.label}
              </GlobalLink>
            ) : null}
          </div>
          <GlobalLink
            href={PUBLIC_DESTINATIONS[feature]}
            className="mt-6 inline-block font-semibold text-(--t-accent-primary) underline underline-offset-4"
          >
            {t(`${feature}.publicAction`)}
          </GlobalLink>
        </aside>
      </Container>
    </>
  )
}
