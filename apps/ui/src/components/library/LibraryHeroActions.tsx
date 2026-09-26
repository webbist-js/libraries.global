"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { LIB_ICONS, LibIcon } from "@/components/library/LibrarySectionCard"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"

const CATEGORIES = [
  "Opening hours",
  "Address or location",
  "Accessibility",
  "Collections",
  "Name or other names",
  "Something else",
]

const pillBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  borderRadius: "999px",
  padding: "12px 18px",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
}

/**
 * Hero action row (Follow · Suggest a correction · Add photos) plus the
 * inline correction form (POC pattern). Corrections post to /api/submissions.
 */
export function LibraryHeroActions({
  librarySlug,
  libraryName,
  libraryDocumentId,
}: {
  readonly librarySlug: string
  readonly libraryName: string
  readonly libraryDocumentId: string
}) {
  const { data: session } = authClient.useSession()
  const [formOpen, setFormOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [category, setCategory] = useState(CATEGORIES[0])
  const [fix, setFix] = useState("")
  const [source, setSource] = useState("")
  const [err, setErr] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    if (!fix.trim()) {
      setErr("Please describe the correct information.")

      return
    }
    setPending(true)
    setErr(null)
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionType: "correction",
          targetEntityType: "library",
          targetSlug: librarySlug,
          fields: {
            category,
            libraryName,
            ...(source.trim() ? { sourceUrl: source.trim() } : {}),
          },
          note: fix.trim(),
        }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setErr(data.error ?? "Failed to submit. Please try again.")
      } else {
        setSent(true)
        setFix("")
        setSource("")
      }
    } catch {
      setErr("Network error. Please try again.")
    } finally {
      setPending(false)
    }
  }

  const close = () => {
    setFormOpen(false)
    setSent(false)
    setErr(null)
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <FollowPill
          libraryDocumentId={libraryDocumentId}
          libraryName={libraryName}
        />
        {session?.user ? (
          <button
            type="button"
            onClick={() => {
              setFormOpen(true)
              setSent(false)
            }}
            style={{
              ...pillBase,
              border: 0,
              background: T.accent.primary,
              color: "#fff",
            }}
            className="transition-colors hover:!bg-(--t-accent-primary-hover)"
          >
            <LibIcon d={LIB_ICONS.pencil} />
            Suggest a correction
          </button>
        ) : (
          <Link
            href={`/auth/signin?callbackUrl=${encodeURIComponent(`/contribute/correct/${librarySlug}`)}`}
            style={{
              ...pillBase,
              border: 0,
              background: T.accent.primary,
              color: "#fff",
              textDecoration: "none",
            }}
            className="transition-colors hover:!bg-(--t-accent-primary-hover)"
          >
            <LibIcon d={LIB_ICONS.pencil} />
            Suggest a correction
          </Link>
        )}
        <a
          href="#photos"
          style={{
            ...pillBase,
            padding: "11px 18px",
            border: `1px solid ${T.border.hi}`,
            background: T.bg.deep,
            color: T.ink.base,
            textDecoration: "none",
          }}
          className="transition-colors hover:!bg-(--t-bg-surface)"
        >
          <LibIcon d={LIB_ICONS.camera} />
          Add photos
        </a>
      </div>

      {formOpen ? (
        <section
          aria-labelledby="fix-h"
          className="mt-5 max-w-[760px] rounded-[20px] p-6"
          style={{
            background: T.bg.deep,
            border: `2px solid ${T.accent.primary}`,
          }}
        >
          {sent ? (
            <div role="status" className="flex flex-col gap-2">
              <strong
                id="fix-h"
                className="text-[20px]"
                style={{ color: T.accent.ok }}
              >
                ✓ Thanks, your suggestion is in review
              </strong>
              <span
                className="text-[16px] leading-normal"
                style={{ color: T.ink.dim }}
              >
                A trusted contributor will check it against your source, usually
                within a few days. You can follow its status in your
                contributions.
              </span>
              <button
                type="button"
                onClick={close}
                className="mt-1.5 self-start rounded-full px-4 py-2.5 text-[15px] font-semibold"
                style={{
                  border: `1px solid ${T.border.hi}`,
                  background: T.bg.deep,
                  color: T.ink.base,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="fix-h"
                  className="m-0 text-[20px] font-bold"
                  style={{ color: T.ink.base }}
                >
                  Suggest a correction
                </h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="size-9 rounded-full border-0 text-[18px]"
                  style={{
                    background: T.border.divider,
                    color: T.ink.base,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>
              <div className="mt-4 grid gap-4">
                <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
                  What needs changing?
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="rounded-[10px] px-3 py-2.5 text-[16px] font-medium"
                    style={{
                      border: `1px solid ${T.border.hi}`,
                      background: T.bg.deep,
                      color: T.ink.base,
                    }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
                  <span>
                    What&rsquo;s correct?{" "}
                    <span className="font-normal" style={{ color: T.ink.dim }}>
                      Required
                    </span>
                  </span>
                  <textarea
                    value={fix}
                    onChange={(e) => {
                      setFix(e.target.value)
                      setErr(null)
                    }}
                    aria-invalid={Boolean(err)}
                    aria-describedby="fix-err"
                    rows={3}
                    className="resize-y rounded-[10px] px-3 py-2.5 text-[16px] font-medium"
                    style={{
                      border: `1px solid ${err ? T.accent.danger : T.border.hi}`,
                      color: T.ink.base,
                    }}
                  />
                  {err ? (
                    <span
                      id="fix-err"
                      role="alert"
                      className="font-semibold"
                      style={{ color: T.accent.danger }}
                    >
                      {err}
                    </span>
                  ) : null}
                </label>
                <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
                  <span>
                    Source{" "}
                    <span className="font-normal" style={{ color: T.ink.dim }}>
                      A link or reference helps reviewers accept changes faster
                    </span>
                  </span>
                  <input
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="https://"
                    className="rounded-[10px] px-3 py-2.5 text-[16px] font-medium"
                    style={{
                      border: `1px solid ${T.border.hi}`,
                      color: T.ink.base,
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending}
                  className="justify-self-start rounded-full border-0 px-5 py-3 text-[16px] font-semibold"
                  style={{
                    background: T.ink.base,
                    color: "#fff",
                    cursor: pending ? "default" : "pointer",
                    opacity: pending ? 0.7 : 1,
                  }}
                >
                  {pending ? "Sending…" : "Send for review"}
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}
    </>
  )
}

/** v2 pill Follow button (same API wiring as before). */
function FollowPill({
  libraryDocumentId,
  libraryName,
}: {
  readonly libraryDocumentId: string
  readonly libraryName: string
}) {
  const { data: session, isPending } = authClient.useSession()
  const [following, setFollowing] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!session?.user || !libraryDocumentId) return
    fetch(
      `/api/profile/me/follow?libraryDocumentId=${encodeURIComponent(libraryDocumentId)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) setFollowing(json.following as boolean)
      })
      .catch(() => setFollowing(false))
  }, [session?.user, libraryDocumentId])

  const toggle = async () => {
    if (!session?.user || following === null || loading) return
    setLoading(true)
    try {
      const res = await fetch("/api/profile/me/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryDocumentId,
          action: following ? "unfollow" : "follow",
        }),
      })
      if (res.ok) {
        const json = (await res.json()) as { following: boolean }
        setFollowing(json.following)
      }
    } finally {
      setLoading(false)
    }
  }

  if (isPending) return null

  if (!session?.user) {
    return (
      <Link
        href="/auth/signin"
        style={{
          ...pillBase,
          border: `1px solid ${T.border.hi}`,
          background: T.bg.deep,
          color: T.ink.base,
          textDecoration: "none",
        }}
        className="transition-colors hover:!bg-(--t-bg-surface)"
      >
        <LibIcon d={LIB_ICONS.bookmark} />
        Follow
      </Link>
    )
  }

  const isFollowing = following === true

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isFollowing}
      disabled={loading || following === null}
      style={{
        ...pillBase,
        border: `1px solid ${isFollowing ? T.ink.base : T.border.hi}`,
        background: isFollowing ? T.ink.base : T.bg.deep,
        color: isFollowing ? "#fff" : T.ink.base,
        opacity: loading || following === null ? 0.7 : 1,
      }}
    >
      <LibIcon d={LIB_ICONS.bookmark} />
      {following === null ? "Follow" : isFollowing ? "Following" : "Follow"}
    </button>
  )
}
