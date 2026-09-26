"use client"

import { useEffect, useState } from "react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

export function ProfileFollowButton({
  targetUsername,
  isSignedIn,
}: {
  targetUsername: string
  isSignedIn: boolean
}) {
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(isSignedIn)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isSignedIn) return
    fetch(
      `/api/profile/me/follow-user?targetUsername=${encodeURIComponent(targetUsername)}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((json: { following?: boolean }) => {
        setFollowing(json.following ?? false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [targetUsername, isSignedIn])

  async function toggle() {
    if (!isSignedIn || busy || loading) return
    const action = following ? "unfollow" : "follow"
    setBusy(true)
    try {
      const res = await fetch("/api/profile/me/follow-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: targetUsername, action }),
      })
      if (res.ok) setFollowing(action === "follow")
    } catch {
      // silent
    } finally {
      setBusy(false)
    }
  }

  // Not signed in — show disabled
  if (!isSignedIn) {
    return (
      <Link
        href="/auth/signin"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "10px 20px",
          borderRadius: "999px",
          border: `1px solid ${T.accent.primary}`,
          background: T.bg.deep,
          color: T.ink.base,
          fontFamily: T.font.sans,
          fontSize: "15px",
          fontWeight: 600,
          textDecoration: "none",
          cursor: "pointer",
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        Follow
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || loading}
      aria-pressed={following}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "10px 20px",
        borderRadius: "999px",
        border: following
          ? `1px solid ${T.ink.base}`
          : `1px solid ${T.accent.primary}`,
        background: following ? T.ink.base : T.bg.deep,
        color: following ? "#fff" : T.ink.base,
        fontFamily: T.font.sans,
        fontSize: "15px",
        fontWeight: 600,
        cursor: busy || loading ? "default" : "pointer",
        opacity: busy || loading ? 0.6 : 1,
        transition: "opacity 150ms, background 150ms",
      }}
    >
      {following ? (
        <>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path
              d="m5 13 4 4L19 7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Following
        </>
      ) : (
        <>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Follow
        </>
      )}
    </button>
  )
}
