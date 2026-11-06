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
  const {
    data,
    prospect,
    accountName,
    scope,
    signedIn,
    unavailable,
    conflict,
    showUsageWarning,
  } = access
  const controls =
    section === "overview" || section === "keys" || section === "usage"
  const actionable = controls || section === "playground"

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
        {controls && data ? (
          <TeamApiDashboard
            key={data.teamId}
            section={section}
            initial={data}
            confirming={query.payment === "confirming"}
            setupRequested={query.setup === "1"}
          />
        ) : null}
        {section === "overview" && !data?.active && !conflict ? (
          <ApiOfferOverview
            limits={API_OFFER_LIMITS}
            buy={
              !signedIn
                ? {
                    href: featureSignInHref("api", locale, "/developers"),
                    label: "signIn",
                  }
                : prospect
                  ? { href: "#api-checkout", label: "buy" }
                  : null
            }
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
        {conflict && actionable ? <TeamMembershipConflict /> : null}
        {unavailable && actionable ? (
          <StaffLoadError what="your Team’s API controls" status={503} />
        ) : null}
        {section === "reference" ? <ApiGuidePanel /> : null}
        {section === "playground" && data?.active ? (
          <ApiPlayground
            key={data.teamId}
            teamName={data.teamName}
            showUsageWarning={showUsageWarning}
          />
        ) : null}
        {prospect && controls ? (
          <ApiIndividualCheckout
            prospect={prospect}
            accountName={accountName}
          />
        ) : null}
        {section !== "overview" &&
        !data &&
        !(prospect && controls) &&
        !unavailable &&
        !conflict ? (
          <ApiAccessCta
            signedIn={signedIn}
            signInHref={featureSignInHref(
              "api",
              locale,
              apiSectionHref(section)
            )}
          />
        ) : null}
        {data && !data.active && !controls ? (
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
