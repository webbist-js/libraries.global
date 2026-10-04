"use client"

import { useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import { PublicStrapiClient } from "@/lib/strapi-api"

const CARD = "rounded-[20px] border p-5"

/** "The monthly dispatch": the Journal newsletter sign-up. */
export function MonthlyDispatchCard() {
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
    <section
      aria-labelledby="journal-dispatch"
      className={CARD}
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <h2
        className="m-0 text-[21px]"
        id="journal-dispatch"
        style={{ fontFamily: T.font.serif, fontWeight: 500, color: T.ink.base }}
      >
        The monthly dispatch
      </h2>
      <p
        className="mt-1.5 mb-4 text-[14px] leading-[1.5]"
        style={{ color: T.ink.dim }}
      >
        New Journal articles in your inbox, at most once a month.
      </p>

      {status === "done" ? (
        <p
          className="m-0 text-[15px] font-semibold"
          role="status"
          style={{ color: T.accent.ok }}
        >
          You&rsquo;re on the list — thank you.
        </p>
      ) : (
        <form onSubmit={subscribe}>
          <label
            className="mb-1.5 block text-[14px] font-medium"
            htmlFor="journal-subscribe"
            style={{ color: T.ink.base }}
          >
            Email address
          </label>
          <input
            aria-describedby="journal-subscribe-note"
            autoComplete="email"
            className="w-full rounded-[14px] border px-3.5 py-2.5 text-[15px]"
            id="journal-subscribe"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.org"
            required
            style={{
              background: T.bg.deep,
              borderColor: T.border.hi,
              color: T.ink.base,
            }}
            type="email"
            value={email}
          />
          <button
            className="mt-3 w-full rounded-full px-4 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:opacity-60"
            disabled={status === "saving"}
            style={{ background: T.accent.primary }}
            type="submit"
          >
            {status === "saving" ? "Subscribing…" : "Subscribe"}
          </button>
          {status === "error" ? (
            <p
              className="m-0 mt-2 text-[14px] font-semibold"
              role="alert"
              style={{ color: T.accent.danger }}
            >
              Couldn&rsquo;t subscribe — please try again.
            </p>
          ) : null}
        </form>
      )}

      <p
        className="m-0 mt-3 text-[13px] leading-[1.5]"
        id="journal-subscribe-note"
        style={{ color: T.ink.dim }}
      >
        Monthly at most. We only use your email to send new Journal articles.
        Unsubscribe at any time by replying to an email or writing to
        legal@libraries.global. See our{" "}
        <GlobalLink
          className="underline underline-offset-[3px]"
          href="/legal/privacy"
          style={{ color: T.accent.primary }}
        >
          privacy notice
        </GlobalLink>
        .
      </p>
    </section>
  )
}
