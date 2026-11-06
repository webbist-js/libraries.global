import { getLocale } from "next-intl/server"

import { AccountGuard } from "@/components/auth/AccountGuard"
import { ApiIndividualCheckout } from "@/components/developers/ApiIndividualCheckout"
import { ApiOfferOverview } from "@/components/developers/ApiOfferOverview"
import { ApiPlayground } from "@/components/developers/ApiPlayground"
import {
  ApiWorkspace,
  apiSectionHref,
  type ApiSection,
} from "@/components/developers/ApiWorkspace"
import { Notice } from "@/components/ds/Notice"
import { StaffLoadError } from "@/components/staff/StaffLoadError"
import { TeamApiDashboard } from "@/components/staff/TeamApiDashboard"
import { ApiGuidePanel } from "@/components/staff/TeamApiPanels"
import { TeamMembershipConflict } from "@/components/staff/TeamMembershipConflict"
import { Button } from "@/components/ui/button"
import { featureSignInHref } from "@/lib/feature-access"
import { Link } from "@/lib/navigation"
import { API_OFFER_LIMITS } from "@/lib/team-api/config"
import { apiWorkspaceAccess } from "@/lib/team-api/workspace"

export type ApiWorkspaceQuery = { payment?: string; setup?: string }

function ApiAccessCta({
  signedIn,
  signInHref,
}: {
  readonly signedIn: boolean
  readonly signInHref: string
}) {
  return (
    <section
      className="rounded-3xl border border-(--t-border-line) bg-(--t-accent-chip) p-5 sm:p-7"
      aria-labelledby="api-access-title"
    >
      <p className="hero-eyebrow">API access</p>
      <h2 id="api-access-title" className="type-h2 m-0">
        Ready to connect your application?
      </h2>
      <p className="mt-3 max-w-[75ch] text-base leading-relaxed text-(--t-ink-dim)">
        Documentation is open to everyone. Running requests in the playground or
        your applications needs an API subscription, bought by an individual or
        an organisation’s Organisers. Organisers manage billing and keys;
        members can view usage.
      </p>
      {!signedIn ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild variant="primary" size="pill">
            <Link href={signInHref}>Log in to buy API access</Link>
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function overviewLinks(team: boolean) {
  return [
    {
      section: team ? "keys" : "reference",
      title: team ? "Manage API keys" : "Read the request reference",
      body: team
        ? "Create and manage credentials for your organisation’s applications."
        : "Authentication, endpoints, pagination, source credits and error responses.",
    },
    {
      section: "playground",
      title: "Try the API playground",
      body: "Make real requests and inspect the responses. They count towards your API allowance.",
    },
  ] as const
}

/** Where the offer's buy button goes, or null with nothing to buy yet. */
function offerBuy(
  signedIn: boolean,
  prospect: boolean,
  locale: string
): { href: string; label: "buy" | "signIn" } | null {
  if (!signedIn)
    return {
      href: featureSignInHref("api", locale, "/developers"),
      label: "signIn",
    }

  return prospect ? { href: "#api-checkout", label: "buy" } : null
}

const isControlSection = (
  section: ApiSection
): section is "overview" | "keys" | "usage" =>
  section === "overview" || section === "keys" || section === "usage"

/** Which workspace panels a section shows for this viewer's access. */
function workspaceView(
  section: ApiSection,
  access: Awaited<ReturnType<typeof apiWorkspaceAccess>>
) {
  const { data, prospect, unavailable, conflict } = access
  const controls = isControlSection(section)
  const actionable = controls || section === "playground"

  return {
    dashboard: controls && data ? { data, section } : null,
    offer: section === "overview" && !data?.active && !conflict,
    conflict: conflict && actionable,
    unavailable: unavailable && actionable,
    playground: section === "playground" && data?.active ? data : null,
    checkout: controls && prospect ? prospect : null,
    accessCta:
      section !== "overview" &&
      !data &&
      !(prospect && controls) &&
      !unavailable &&
      !conflict,
    inactiveNotice: Boolean(data && !data.active && !controls),
  }
}

export async function ApiWorkspacePage({
  section,
  query = {},
}: {
  readonly section: ApiSection
  readonly query?: ApiWorkspaceQuery
}) {
  const [access, locale] = await Promise.all([
    apiWorkspaceAccess(),
    getLocale(),
  ])
  const { data, prospect, accountName, scope, signedIn, showUsageWarning } =
    access
  const view = workspaceView(section, access)

  return (
    <AccountGuard
      expectedScope={scope}
      publicGuestPaths={[
        "/developers",
        "/developers/keys",
        "/developers/usage",
        "/developers/reference",
        "/developers/playground",
      ]}
    >
      <ApiWorkspace
        section={section}
        team={Boolean(data)}
        teamName={data?.teamName}
      >
        {view.dashboard ? (
          <TeamApiDashboard
            key={view.dashboard.data.teamId}
            section={view.dashboard.section}
            initial={view.dashboard.data}
            confirming={query.payment === "confirming"}
            setupRequested={query.setup === "1"}
          />
        ) : null}
        {view.offer ? (
          <ApiOfferOverview
            limits={API_OFFER_LIMITS}
            buy={offerBuy(signedIn, Boolean(prospect), locale)}
          />
        ) : null}
        {section === "overview" ? (
          <div className="grid gap-4 md:grid-cols-2">
            {overviewLinks(Boolean(data)).map((item) => (
              <Link
                key={item.section}
                href={apiSectionHref(item.section)}
                className="rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 text-(--t-ink-base) no-underline hover:border-(--t-accent-primary) sm:p-7"
              >
                <h2 className="type-h3 m-0">
                  {item.title} <span aria-hidden>→</span>
                </h2>
                <p className="mt-3 mb-0 text-base leading-relaxed text-(--t-ink-dim)">
                  {item.body}
                </p>
              </Link>
            ))}
          </div>
        ) : null}
        {view.conflict ? <TeamMembershipConflict /> : null}
        {view.unavailable ? (
          <StaffLoadError what="your Team’s API controls" status={503} />
        ) : null}
        {section === "reference" ? <ApiGuidePanel /> : null}
        {view.playground ? (
          <ApiPlayground
            key={view.playground.teamId}
            teamName={view.playground.teamName}
            showUsageWarning={showUsageWarning}
          />
        ) : null}
        {view.checkout ? (
          <ApiIndividualCheckout
            prospect={view.checkout}
            accountName={accountName}
          />
        ) : null}
        {view.accessCta ? (
          <ApiAccessCta
            signedIn={signedIn}
            signInHref={featureSignInHref(
              "api",
              locale,
              apiSectionHref(section)
            )}
          />
        ) : null}
        {view.inactiveNotice ? (
          <Notice
            tone="info"
            title="Active API access is required"
            icon="mdi:code-tags"
          >
            Playground requests use your organisation’s shared API allowance.{" "}
            <Link href="/developers">Review your API subscription</Link> to
            activate access and manage your API keys.
          </Notice>
        ) : null}
      </ApiWorkspace>
    </AccountGuard>
  )
}
