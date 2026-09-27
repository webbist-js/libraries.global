"use client"

import { useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import { PublicStrapiClient } from "@/lib/strapi-api"

function CardIcon({
  bg,
  children,
}: {
  readonly bg: string
  readonly children: React.ReactNode
}) {
  return (
    <span
      aria-hidden="true"
      className="mb-4 flex size-10 items-center justify-center rounded-full"
      style={{ background: bg, color: T.ink.base }}
    >
      {children}
    </span>
  )
}

function CardTitle({ children }: { readonly children: React.ReactNode }) {
  return (
    <h3
      className="m-0 mb-2 text-[20px] leading-[1.2]"
      style={{ fontFamily: T.font.serif, fontWeight: 500, color: T.ink.base }}
    >
      {children}
    </h3>
  )
}

function SubscribeCard() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle"
  )

  async function subscribe(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || status === "saving") return
    setStatus("saving")
    try {
      const path = PublicStrapiClient.getStrapiApiPathByUId(
        "api::subscriber.subscriber"
      )
      await PublicStrapiClient.fetchAPI(
        path,
        undefined,
        {
          method: "POST",
          // `message` plus the entry's createdAt is the consent record: what
          // the person agreed to, and when.
          body: JSON.stringify({
            data: {
              email: email.trim(),
              message:
                "Journal newsletter: agreed to receive new Journal articles by email, at most monthly",
            },
          }),
        },
        { useProxy: true }
      )
      setStatus("done")
    } catch {
      setStatus("error")
    }
  }

  return (
    <div
      className="flex flex-col rounded-[20px] border p-6"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <CardIcon bg="var(--tint-national-bg)">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      </CardIcon>
      <CardTitle>Get new articles</CardTitle>

      {status === "done" ? (
        <p
          role="status"
          className="m-0 text-[15px] font-semibold"
          style={{ color: T.accent.ok }}
        >
          You&rsquo;re on the list — thank you.
        </p>
      ) : (
        <form onSubmit={subscribe}>
          <label
            htmlFor="journal-subscribe"
            className="mb-1.5 block text-[14px] font-medium"
            style={{ color: T.ink.base }}
          >
            Email address
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="journal-subscribe"
              type="email"
              required
              aria-describedby="journal-subscribe-note"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-0 flex-1 rounded-[10px] border px-3 py-2 text-[15px]"
              style={{
                background: T.bg.deep,
                borderColor: T.border.hi,
                color: T.ink.base,
              }}
            />
            <button
              type="submit"
              disabled={status === "saving"}
              className="rounded-full px-4 py-2 text-[14px] font-semibold text-white transition-colors disabled:opacity-60"
              style={{ background: T.accent.primary }}
            >
              {status === "saving" ? "Subscribing…" : "Subscribe"}
            </button>
          </div>
          {status === "error" ? (
            <p
              role="alert"
              className="m-0 mt-2 text-[14px] font-semibold"
              style={{ color: T.accent.danger }}
            >
              Couldn&rsquo;t subscribe — please try again.
            </p>
          ) : null}
        </form>
      )}

      <p
        id="journal-subscribe-note"
        className="m-0 mt-3 text-[13px]"
        style={{ color: T.ink.dim }}
      >
        Monthly at most. We only use your email to send new Journal articles.
        Unsubscribe at any time by replying to an email or writing to
        legal@libraries.global. See our{" "}
        <GlobalLink
          href="/legal/privacy"
          className="underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
        >
          privacy notice
        </GlobalLink>
        .
      </p>
    </div>
  )
}

/** Shown while the journal is young: invites contributions instead of padding
 * the page with a one-item "grid". */
export function MoreToCome({
  articleCount,
}: {
  readonly articleCount: number
}) {
  return (
    <section className="mx-auto w-full max-w-[1360px] px-4 pt-14 pb-20 sm:px-8">
      <h2
        className="m-0 text-[clamp(28px,3.2vw,40px)] leading-[1.05]"
        style={{
          fontFamily: T.font.serif,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: T.ink.base,
        }}
      >
        More to come
      </h2>
      <p className="mt-2 mb-8 text-[16px]" style={{ color: T.ink.dim }}>
        {articleCount === 1
          ? "This is the journal's first article. Help us write the next one."
          : "The journal is just getting started. Help us write the next piece."}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Write for the journal */}
        <div
          className="flex flex-col rounded-[20px] p-6"
          style={{ background: "#F8EEDC" }}
        >
          <CardIcon bg="#fff">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          </CardIcon>
          <CardTitle>Write for the journal</CardTitle>
          <p
            className="m-0 mb-4 flex-1 text-[15px] leading-[1.55]"
            style={{ color: T.ink.dim }}
          >
            Library staff, researchers and visitors are all welcome. Pieces are
            edited and credited to you.
          </p>
          <GlobalLink
            href="/contribute"
            className="text-[15px] font-semibold underline underline-offset-[3px]"
            style={{ color: T.ink.base }}
          >
            Pitch a story
          </GlobalLink>
        </div>

        {/* Stories we'd love to publish */}
        <div
          className="flex flex-col rounded-[20px] p-6"
          style={{ background: "var(--tint-public-bg)" }}
        >
          <CardIcon bg="#fff">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
            </svg>
          </CardIcon>
          <CardTitle>Stories we&rsquo;d love to publish</CardTitle>
          <ul
            className="m-0 flex list-none flex-col gap-1.5 p-0 text-[15px] leading-[1.55]"
            style={{ color: T.ink.dim }}
          >
            {[
              "A library outside Europe",
              "A collection few people know about",
              "Life behind the reference desk",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" style={{ color: T.ink.low }}>
                  •
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <SubscribeCard />
      </div>
    </section>
  )
}

export default MoreToCome
