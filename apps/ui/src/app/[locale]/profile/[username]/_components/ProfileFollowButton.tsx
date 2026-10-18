"use client"

import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import { useHydratedSession } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"

/** Public follow actions never reuse another viewer's relationship state. */
export function ProfileFollowButton({
  targetUsername,
  isSignedIn,
  compact = false,
}: {
  targetUsername: string
  isSignedIn: boolean
  compact?: boolean
}) {
  const session = useHydratedSession()
  const viewerId =
    isSignedIn && !session.isPending && !session.error
      ? session.data?.user?.id
      : null

  return (
    <FollowPanel
      key={`${viewerId ?? "guest"}:${targetUsername}`}
      targetUsername={targetUsername}
      signedIn={Boolean(viewerId)}
      ready={!session.isPending && !session.error}
      compact={compact}
    />
  )
}

function FollowPanel({
  targetUsername,
  signedIn,
  ready,
  compact,
}: {
  targetUsername: string
  signedIn: boolean
  ready: boolean
  compact: boolean
}) {
  const tUi = useTranslations("ui")
  const t = useTranslations("publishingFollow")
  const router = useRouter()
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(signedIn)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<"lookup" | "update" | null>(null)
  const [retry, setRetry] = useState(0)
  const alive = useRef(true)
  const mutation = useRef<AbortController | null>(null)
  useEffect(() => {
    alive.current = true

    return () => {
      alive.current = false
      mutation.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (!signedIn || !ready) return
    const controller = new AbortController()
    setFollowing(false)
    setLoading(true)
    setError(null)
    fetch(
      `/api/profile/me/follow-user?targetUsername=${encodeURIComponent(targetUsername)}`,
      { cache: "no-store", signal: controller.signal }
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Follow status unavailable")
        const json = (await response.json()) as { following?: boolean }
        if (typeof json.following !== "boolean")
          throw new Error("Invalid follow status")
        if (!controller.signal.aborted) setFollowing(json.following)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("lookup")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [targetUsername, signedIn, ready, retry])

  async function toggle() {
    if (!signedIn || !ready || busy || loading || error === "lookup") return
    const action = following ? "unfollow" : "follow"
    const controller = new AbortController()
    mutation.current = controller
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/profile/me/follow-user", {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: targetUsername, action }),
      })
      if (!response.ok) throw new Error("Follow update unavailable")
      if (alive.current && !controller.signal.aborted) {
        setFollowing(action === "follow")
        router.refresh()
      }
    } catch {
      if (alive.current && !controller.signal.aborted) setError("update")
    } finally {
      if (alive.current && !controller.signal.aborted) setBusy(false)
    }
  }
  const style = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: compact ? "7px 12px" : "10px 20px",
    borderRadius: "999px",
    border: `1px solid ${following ? T.ink.base : T.accent.primary}`,
    background: following ? T.ink.base : T.bg.deep,
    color: following ? "#fff" : T.ink.base,
    fontFamily: T.font.sans,
    fontSize: compact ? "13px" : "15px",
    fontWeight: 600,
    textDecoration: "none",
    cursor: busy || loading || !ready ? "default" : "pointer",
    opacity: busy || loading || !ready ? 0.6 : 1,
    transition: "opacity 150ms, background 150ms",
  }
  if (ready && !signedIn)
    return (
      <Link
        href={`/auth/signin?callbackUrl=${encodeURIComponent(`/profile/${targetUsername}`)}`}
        style={style}
      >
        {tUi("follow")}
      </Link>
    )

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy || loading || !ready || error === "lookup"}
        aria-pressed={following}
        aria-busy={busy || loading || !ready}
        style={style}
      >
        {loading || !ready
          ? t("checking")
          : following
            ? tUi("following")
            : tUi("follow")}
      </button>
      {error && (
        <div
          role="alert"
          className="max-w-xs text-sm"
          style={{ color: T.ink.dim }}
        >
          <p className="m-0">
            {t(error === "lookup" ? "lookupError" : "updateError")}
          </p>
          {error === "lookup" && (
            <button
              type="button"
              className="mt-1 underline"
              onClick={() => setRetry((value) => value + 1)}
            >
              {tUi("retry")}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
