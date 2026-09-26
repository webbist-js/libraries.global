import { Icon } from "@iconify/react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import GlobalLink from "@/components/global/GlobalLink"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { privateMetadata } from "@/lib/seo/metadata"

import { ContributeSectionHeader } from "../_components/ContributeSectionHeader"
import { EventFeedForm } from "./_components/EventFeedForm"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

export const metadata = privateMetadata("Connect an event feed")

const ASIDE_STEPS = [
  {
    icon: "mdi:library-outline",
    title: "Pick your library",
    body: "Choose the library you're affiliated with. It needs an entity reference in the index.",
  },
  {
    icon: "mdi:calendar-sync-outline",
    title: "Choose a platform",
    body: "Eventbrite, iCal, Meetup, TicketSource, WeGotTickets, Spydus or BiblioCommons.",
  },
  {
    icon: "mdi:lock-outline",
    title: "Add credentials",
    body: "Credentials are encrypted at rest and only used to sync events.",
  },
  {
    icon: "mdi:shield-check-outline",
    title: "We review and activate",
    body: "Our team checks the connection, usually within 48 hours. Events then appear automatically.",
  },
]

async function fetchIsVerifiedLibrarian(baUserId: string): Promise<boolean> {
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  try {
    const res = await fetch(
      `${STRAPI}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}&fields[0]=isVerifiedLibrarian`,
      {
        cache: "no-store",
        headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      }
    )
    if (!res.ok) return false
    const json = (await res.json()) as {
      data?: { isVerifiedLibrarian?: boolean }[]
    }

    return json.data?.[0]?.isVerifiedLibrarian ?? false
  } catch {
    return false
  }
}

export default async function ContributeEventsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await params // locale unused on this page
  const hdrs = await headers()
  const session = await getSessionSSR(hdrs)

  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/contribute/events")
  }

  const isVerifiedLibrarian = await fetchIsVerifiedLibrarian(session.user.id)

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        compact
        section="Connect an event feed"
        title="Connect your library's *event feed.*"
        lead="Verified librarians can connect their library's Eventbrite, iCal, Meetup, or other event platform. Submitted credentials are reviewed by our team before activation."
      />

      <div className="mx-auto w-full max-w-[1360px] px-4 pt-10 pb-20 sm:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          <div className="max-w-[760px] min-w-0">
            {isVerifiedLibrarian ? (
              <EventFeedForm
                sessionUser={{
                  id: session.user.id,
                  name: session.user.name ?? null,
                  email: session.user.email,
                }}
              />
            ) : (
              <section
                aria-labelledby="verified-required-heading"
                className="px-6 py-10 sm:px-10"
                style={{
                  border: `1px solid ${T.border.line}`,
                  borderRadius: "20px",
                  background: T.bg.deep,
                }}
              >
                <p
                  className="inline-flex items-center gap-2"
                  style={{
                    fontFamily: T.font.sans,
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--tint-special-fg)",
                    background: "var(--tint-special-bg)",
                    borderRadius: "999px",
                    padding: "6px 12px",
                    margin: "0 0 20px",
                  }}
                >
                  <Icon
                    icon="mdi:shield-account-outline"
                    className="size-4"
                    aria-hidden="true"
                  />
                  Verified librarian required
                </p>
                <h2
                  id="verified-required-heading"
                  style={{
                    fontFamily: T.font.serif,
                    fontSize: "clamp(26px, 3vw, 32px)",
                    fontWeight: 500,
                    lineHeight: 1.2,
                    letterSpacing: "-0.01em",
                    color: T.ink.base,
                    margin: "0 0 12px",
                  }}
                >
                  This page is for verified librarians only.
                </h2>
                <p
                  style={{
                    fontFamily: T.font.sans,
                    fontSize: "16px",
                    lineHeight: 1.6,
                    color: T.ink.dim,
                    maxWidth: "52ch",
                    margin: "0 0 28px",
                  }}
                >
                  To connect an event feed you must be a verified librarian
                  affiliated with that library. Claim your library first to get
                  verified.
                </p>
                <GlobalLink
                  href="/contribute/claim"
                  className="inline-flex items-center gap-2 rounded-full bg-(--t-accent-primary) px-6 py-3 font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
                  style={{ fontFamily: T.font.sans, fontSize: "15px" }}
                >
                  Claim your library
                  <Icon
                    icon="mdi:arrow-right"
                    className="size-4"
                    aria-hidden="true"
                  />
                </GlobalLink>
              </section>
            )}
          </div>

          <aside aria-labelledby="event-feed-aside-heading" className="min-w-0">
            <div
              className="flex flex-col gap-5 p-6 lg:sticky lg:top-32"
              style={{
                border: `1px solid ${T.border.line}`,
                borderRadius: "20px",
                background: T.bg.deep,
              }}
            >
              <h2
                id="event-feed-aside-heading"
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "22px",
                  fontWeight: 500,
                  lineHeight: 1.25,
                  color: T.ink.base,
                  margin: 0,
                }}
              >
                How feed connections work
              </h2>
              <ol className="m-0 flex list-none flex-col gap-4 p-0">
                {ASIDE_STEPS.map((step) => (
                  <li key={step.title} className="flex gap-3">
                    <Icon
                      icon={step.icon}
                      className="mt-0.5 size-5 shrink-0"
                      style={{ color: T.accent.primary }}
                      aria-hidden="true"
                    />
                    <div>
                      <p
                        style={{
                          fontFamily: T.font.sans,
                          fontSize: "15px",
                          fontWeight: 600,
                          color: T.ink.base,
                          margin: "0 0 2px",
                        }}
                      >
                        {step.title}
                      </p>
                      <p
                        style={{
                          fontFamily: T.font.sans,
                          fontSize: "14px",
                          lineHeight: 1.55,
                          color: T.ink.dim,
                          margin: 0,
                        }}
                      >
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
