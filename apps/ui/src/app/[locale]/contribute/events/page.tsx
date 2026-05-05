import { headers } from "next/headers"
import { redirect } from "next/navigation"

import GlobalLink from "@/components/global/GlobalLink"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"

import { EventFeedForm } from "./_components/EventFeedForm"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

export const metadata = {
  title: "Connect Event Feed — Libraries of the World",
  description: "Connect your library's event calendar to libraries.global.",
}

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
    <div style={{ minHeight: "100vh", color: T.ink.base }}>
      <main className="relative z-10 pt-16">
        <div className="mx-auto max-w-2xl px-6 py-16">
          {/* Page header */}
          <div className="mb-10">
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".22em",
                textTransform: "uppercase",
                color: T.ink.faint,
                marginBottom: "12px",
              }}
            >
              Contribute · Events
            </p>
            <h1
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
                lineHeight: 1.1,
                fontWeight: 400,
                color: T.ink.base,
                marginBottom: 0,
              }}
            >
              Connect your library&apos;s{" "}
              <em style={{ fontStyle: "italic", color: T.ink.dim }}>
                event feed.
              </em>
            </h1>
            <p
              className="mt-4 leading-relaxed"
              style={{
                color: T.ink.low,
                fontSize: "0.95rem",
                maxWidth: "520px",
              }}
            >
              Verified librarians can connect their library&apos;s Eventbrite,
              iCal, Meetup, or other event platform. Submitted credentials are
              reviewed by our team before activation.
            </p>
          </div>

          {isVerifiedLibrarian ? (
            <EventFeedForm
              sessionUser={{
                id: session.user.id,
                name: session.user.name ?? null,
                email: session.user.email,
              }}
            />
          ) : (
            <div
              style={{
                padding: "40px 32px",
                border: `1px solid ${T.border.line}`,
                borderRadius: "16px",
                background: T.bg.deep,
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".18em",
                  textTransform: "uppercase",
                  color: T.accent.warn,
                  marginBottom: "16px",
                }}
              >
                Verified Librarian Required
              </p>
              <p
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "1.3rem",
                  fontWeight: 400,
                  color: T.ink.base,
                  marginBottom: "12px",
                  lineHeight: 1.3,
                }}
              >
                This page is for{" "}
                <em style={{ fontStyle: "italic" }}>verified librarians</em>{" "}
                only.
              </p>
              <p
                style={{
                  fontSize: "0.9rem",
                  color: T.ink.low,
                  marginBottom: "28px",
                  lineHeight: 1.6,
                  maxWidth: "360px",
                  margin: "0 auto 28px",
                }}
              >
                To connect an event feed you must be a verified librarian
                affiliated with that library. Claim your library first to get
                verified.
              </p>
              <GlobalLink
                href="/contribute/claim"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  borderRadius: "100px",
                  background: "rgba(127,223,255,0.1)",
                  border: "1px solid rgba(127,223,255,0.3)",
                  color: T.accent.aurora,
                  fontFamily: T.font.mono,
                  fontSize: "11px",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                }}
              >
                Claim your library →
              </GlobalLink>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
