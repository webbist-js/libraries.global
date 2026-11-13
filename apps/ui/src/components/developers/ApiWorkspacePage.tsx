import { useTranslations } from "next-intl"
import { getLocale, getTranslations } from "next-intl/server"

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
import { apiConfig, API_OFFER_LIMITS } from "@/lib/team-api/config"
import { apiWorkspaceAccess } from "@/lib/team-api/workspace"

export type ApiWorkspaceQuery = { payment?: string; setup?: string }

function ApiAccessCta({
  signedIn,
  signInHref,
}: {
  readonly signedIn: boolean
  readonly signInHref: string
}) {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  return (
    <section
      className="rounded-3xl border border-(--t-border-line) bg-(--t-accent-chip) p-5 sm:p-7"
      aria-labelledby="api-access-title"
    >
      <p className="hero-eyebrow">{tExisting("staffWorkspace.apiAccess")}</p>
      <h2 id="api-access-title" className="type-h2 m-0">
        {tStatic("frontendExtra.unlock_live_api_requests")}
      </h2>
      <p className="mt-3 max-w-[75ch] text-base leading-relaxed text-(--t-ink-dim)">
        {tStatic(
          "frontendExtra.explore_the_request_reference_for_free_to_use_the_playground_or_connect_an_application_subscribe_to_"
        )}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild variant="primary" size="pill">
          <Link href={signedIn ? "/developers" : signInHref}>
            {signedIn ? "Review API access" : "Sign in to get API access"}
          </Link>
        </Button>
        <Button asChild variant="surface" size="pill">
          <Link href="/developers/reference">
            {tStatic("frontendExtra.explore_the_reference")}
          </Link>
        </Button>
      </div>
    </section>
  )
}

function overviewLinks(team: boolean, active: boolean) {
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
      title: active ? "Open the API playground" : "Explore the playground",
      body: active
        ? "Make a request with your key and inspect the response. Usage counts towards your allowance."
        : "Live requests need an active API subscription. See how to get access and connect your application.",
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
      section !== "reference" &&
      !data &&
      !(prospect && controls) &&
      !unavailable &&
      !conflict,
    inactiveNotice: Boolean(data && !data.active && section === "playground"),
  }
}

export async function ApiWorkspacePage({
  section,
  query = {},
}: {
  readonly section: ApiSection
  readonly query?: ApiWorkspaceQuery
}) {
  const tStatic = await getTranslations("staticUi")

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
        playgroundAvailable={Boolean(view.playground)}
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
            showPricing={!view.checkout?.verified}
            limits={API_OFFER_LIMITS}
            overageAvailable={apiConfig().overage}
            buy={offerBuy(signedIn, Boolean(prospect), locale)}
          />
        ) : null}
        {view.checkout ? (
          <ApiIndividualCheckout
            prospect={view.checkout}
            accountName={accountName}
          />
        ) : null}
        {section === "overview" ? (
          <div className="grid gap-4 md:grid-cols-2">
            {overviewLinks(Boolean(data?.organiser), Boolean(data?.active)).map(
              (item) => (
                <Link
                  key={item.section}
                  href={apiSectionHref(item.section)}
                  className="rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 text-(--t-ink-base) no-underline transition-colors hover:border-(--t-accent-primary) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--t-accent-primary) sm:p-7"
                >
                  <h2 className="type-h3 m-0">
                    {item.title} <span aria-hidden>→</span>
                  </h2>
                  <p className="mt-3 mb-0 text-base leading-relaxed text-(--t-ink-dim)">
                    {item.body}
                  </p>
                </Link>
              )
            )}
          </div>
        ) : null}
        {view.conflict ? <TeamMembershipConflict /> : null}
        {view.unavailable ? (
          <StaffLoadError what="your API account controls" status={503} />
        ) : null}
        {section === "reference" ? <ApiGuidePanel /> : null}
        {view.playground ? (
          <ApiPlayground
            key={view.playground.teamId}
            teamName={view.playground.teamName}
            showUsageWarning={showUsageWarning}
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
            title={tStatic("frontendExtra.active_api_access_is_required")}
            icon="mdi:code-tags"
          >
            {tStatic(
              "frontendExtra.playground_requests_use_your_organisation_s_shared_api_allowance"
            )}{" "}
            <Link href="/developers">
              {tStatic("frontendExtra.review_your_api_subscription")}
            </Link>{" "}
            to activate access and manage your API keys.
          </Notice>
        ) : null}
      </ApiWorkspace>
    </AccountGuard>
  )
}
