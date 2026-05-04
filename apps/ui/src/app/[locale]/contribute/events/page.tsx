import type { Locale } from "next-intl"
import { use } from "react"

import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import { T } from "@/lib/design-tokens"
import { fetchNavbar } from "@/lib/strapi-api/content/server"

import { EventFeedForm } from "./_components/EventFeedForm"

export const metadata = {
  title: "Submit Event Feed — Libraries of the World",
  description: "Connect your library's event calendar to libraries.global.",
}

export default function ContributeEventsPage(props: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = use(props.params)
  const navbar = use(fetchNavbar(locale as Locale))?.data

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.space, color: T.ink.base }}
    >
      <GlobalHeader locale={locale as Locale} navbar={navbar} />
      <main className="relative z-10 flex-1 pt-16">
        <Container className="max-w-2xl py-16">
          {/* Header */}
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
              }}
            >
              List your library&apos;s{" "}
              <em style={{ fontStyle: "italic", color: T.ink.dim }}>events.</em>
            </h1>
            <p
              className="mt-4 leading-relaxed"
              style={{
                color: T.ink.low,
                fontSize: "0.95rem",
                maxWidth: "520px",
              }}
            >
              Connect your library&apos;s Eventbrite, Meetup, or calendar feed
              and your events will appear on libraries.global — reaching
              visitors searching for libraries worldwide.
            </p>
          </div>

          <EventFeedForm />
        </Container>
      </main>
    </div>
  )
}
