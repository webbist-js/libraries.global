"use client"

import { Icon } from "@iconify/react"
import { useEffect, useRef, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"

type Suggestion = {
  documentId: string
  name: string
  optionKey: "accessibility" | "amenities" | "services"
  requests: number
  votes: number
  voted?: boolean
  libraryCount: number
  libraries: string[]
}

const LIST: Record<
  Suggestion["optionKey"],
  { label: string; bg: string; fg: string; icon: string }
> = {
  accessibility: {
    label: "Accessibility",
    bg: "var(--tint-academic-bg)",
    fg: "var(--tint-academic-fg)",
    icon: "mdi:wheelchair-accessibility",
  },
  services: {
    label: "Service",
    bg: "var(--tint-public-bg)",
    fg: "var(--tint-public-fg)",
    icon: "mdi:star-four-points-outline",
  },
  amenities: {
    label: "Amenity",
    bg: "var(--tint-national-bg)",
    fg: "var(--tint-national-fg)",
    icon: "mdi:sofa-outline",
  },
}

const PAGE = 4

const CARD =
  "flex h-full flex-col rounded-[20px] border border-(--t-border-line) bg-white"

/**
 * Options contributors asked for that aren't in the lists yet. Signed-in
 * contributors vote; the editorial board sees the tally in the moderation
 * plugin and considers new additions monthly. As a card (the Contribute hub,
 * the Noticeboard) it shows the top four and links to the full list at
 * /community/suggestions; as a page it shows them all.
 */
export function SuggestedAdditions({
  variant = "card",
  signInReturnTo,
}: {
  readonly variant?: "card" | "page"
  /** Where "Sign in to vote" comes back to. */
  readonly signInReturnTo: string
}) {
  const { data: session, isPending } = authClient.useSession()
  const signedIn = Boolean(session?.user)
  const [items, setItems] = useState<Suggestion[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped on every vote, so a list requested before it can't undo it.
  const votesCast = useRef(0)

  useEffect(() => {
    // Wait for the session, so the list carries the viewer's own votes.
    if (isPending) return
    let live = true
    const cast = votesCast.current
    fetch("/api/option-suggestions", { cache: "no-store" })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status)))
      )
      .then((json: { data?: Suggestion[] }) => {
        if (live && cast === votesCast.current) setItems(json.data ?? [])
      })
      .catch(() => live && setFailed(true))

    return () => {
      live = false
    }
  }, [isPending, signedIn])

  const vote = async (s: Suggestion) => {
    votesCast.current += 1
    setBusy(s.documentId)
    setError(null)
    try {
      const res = await fetch(`/api/option-suggestions/${s.documentId}/vote`, {
        method: "POST",
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { voted: boolean; votes: number }
        error?: string | { message?: string }
      }
      if (!res.ok || !json.data) {
        const message =
          typeof json.error === "string" ? json.error : json.error?.message
        setError(message ?? "Your vote didn’t save. Please try again.")

        return
      }
      const { voted, votes } = json.data
      setItems((list) =>
        (list ?? []).map((x) =>
          x.documentId === s.documentId ? { ...x, voted, votes } : x
        )
      )
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  const shown =
    variant === "page" ? (items ?? []) : (items ?? []).slice(0, PAGE)
  const hidden = (items?.length ?? 0) - shown.length
  const signIn = `/auth/signin?callbackUrl=${encodeURIComponent(signInReturnTo)}`

  return (
    <section aria-labelledby="suggested-additions" className={CARD}>
      <div
        className="border-b px-5 py-5"
        style={{ borderColor: T.border.divider }}
      >
        <h2
          id="suggested-additions"
          className="m-0"
          style={{
            fontFamily: T.font.serif,
            fontSize: "24px",
            fontWeight: 500,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            color: T.ink.base,
          }}
        >
          Vote on additions
        </h2>
        <p className="m-0 mt-0.5 text-[14px]" style={{ color: T.ink.dim }}>
          Features and services contributors want added to the lists
        </p>
      </div>

      {error ? (
        <p
          className="m-0 px-5 pt-4 text-[14px] font-semibold"
          role="alert"
          style={{ color: T.accent.danger }}
        >
          {error}
        </p>
      ) : null}

      {failed ? (
        <p
          className="m-0 flex-1 px-5 py-6 text-[14px]"
          style={{ color: T.ink.dim }}
        >
          Suggestions couldn’t load right now.
        </p>
      ) : items === null ? (
        <p
          className="m-0 flex-1 px-5 py-6 text-[14px]"
          style={{ color: T.ink.dim }}
        >
          Loading suggestions…
        </p>
      ) : items.length === 0 ? (
        <p
          className="m-0 flex-1 px-5 py-6 text-[14px] leading-[1.55]"
          style={{ color: T.ink.dim }}
        >
          Nothing to vote on yet. When you correct a library’s accessibility or
          services, you can suggest an option that’s missing.
        </p>
      ) : (
        <ul className="m-0 flex-1 list-none p-0">
          {shown.map((s, index) => {
            const list = LIST[s.optionKey]
            const where =
              s.libraryCount === 1
                ? (s.libraries[0] ?? "1 library")
                : `${s.libraryCount} libraries`

            return (
              <li
                key={s.documentId}
                className="flex items-center gap-3 px-5 py-3.5"
                style={
                  index > 0
                    ? { borderTop: `1px solid ${T.border.divider}` }
                    : undefined
                }
              >
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: list.bg, color: list.fg }}
                >
                  <Icon height={16} icon={list.icon} width={16} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className="truncate text-[15px] font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    {s.name}
                  </span>
                  <span
                    className="truncate text-[13px]"
                    style={{ color: T.ink.dim }}
                  >
                    {list.label} · {where}
                  </span>
                </span>
                {signedIn ? (
                  <button
                    type="button"
                    aria-pressed={Boolean(s.voted)}
                    aria-label={`${s.voted ? "Remove your vote for" : "Vote for"} ${s.name}, ${s.votes} ${s.votes === 1 ? "vote" : "votes"}`}
                    disabled={busy === s.documentId}
                    onClick={() => void vote(s)}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[14px] font-semibold transition-colors disabled:opacity-60"
                    style={
                      s.voted
                        ? {
                            background: T.accent.primary,
                            borderColor: T.accent.primary,
                            color: "#fff",
                          }
                        : {
                            background: T.bg.deep,
                            borderColor: T.border.hi,
                            color: T.ink.base,
                          }
                    }
                  >
                    <Icon
                      aria-hidden="true"
                      height={16}
                      icon={s.voted ? "mdi:thumb-up" : "mdi:thumb-up-outline"}
                      width={16}
                    />
                    {s.votes}
                  </button>
                ) : (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 text-[14px] font-semibold"
                    style={{ color: T.ink.dim }}
                  >
                    <Icon
                      aria-hidden="true"
                      height={16}
                      icon="mdi:thumb-up-outline"
                      width={16}
                    />
                    {s.votes}
                    <span className="sr-only">
                      {s.votes === 1 ? " vote" : " votes"}
                    </span>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div
        className="flex flex-col gap-2 border-t px-5 py-4"
        style={{ borderColor: T.border.divider }}
      >
        {hidden > 0 ? (
          <GlobalLink
            href="/community/suggestions"
            className="self-start text-[14px] font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            See all {items?.length ?? 0} suggestions
          </GlobalLink>
        ) : null}
        {signedIn ? null : (
          <GlobalLink
            href={signIn}
            className="self-start text-[14px] font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            Sign in to vote
          </GlobalLink>
        )}
        <p
          className="m-0 text-[13px] leading-[1.5]"
          style={{ color: T.ink.low }}
        >
          Our editorial board considers new additions monthly. Votes help decide
          what comes first.
        </p>
      </div>
    </section>
  )
}
