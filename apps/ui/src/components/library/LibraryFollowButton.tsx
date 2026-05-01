"use client"

import { Icon } from "@iconify/react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"

export function LibraryFollowButton({
  libraryDocumentId,
  libraryName,
}: {
  libraryDocumentId: string
  libraryName: string
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
    if (!session?.user || following === null) return
    const action = following ? "unfollow" : "follow"
    setLoading(true)
    try {
      const res = await fetch("/api/profile/me/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryDocumentId, action }),
      })
      if (!res.ok) throw new Error("Follow request failed")
      const json = (await res.json()) as { following: boolean }
      setFollowing(json.following)
      toast.success(
        json.following
          ? `Following ${libraryName}`
          : `Unfollowed ${libraryName}`
      )
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (isPending) return null

  if (!session?.user) {
    return (
      <Link
        href={`/auth/signin?callbackUrl=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "9px 16px",
          borderRadius: "10px",
          border: `1px solid rgba(255,255,255,.14)`,
          background: `rgba(255,255,255,.07)`,
          color: "rgba(255,255,255,.40)",
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".1em",
          textTransform: "uppercase",
          textDecoration: "none",
          transition: "border-color 200ms, color 200ms",
        }}
      >
        <Icon icon="mdi:heart-outline" width={13} height={13} />
        Sign in to follow
      </Link>
    )
  }

  const isFollowing = following === true

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading || following === null}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "9px 16px",
        borderRadius: "10px",
        border: isFollowing
          ? `1px solid rgba(255,100,100,0.4)`
          : `1px solid rgba(255,255,255,.22)`,
        background: isFollowing
          ? "rgba(255,100,100,0.08)"
          : "rgba(255,255,255,.07)",
        color: isFollowing ? "#ff8a8a" : "rgba(255,255,255,.80)",
        fontFamily: T.font.mono,
        fontSize: "10px",
        letterSpacing: ".1em",
        textTransform: "uppercase",
        cursor: loading || following === null ? "default" : "pointer",
        opacity: loading || following === null ? 0.6 : 1,
        transition: "all 150ms",
      }}
    >
      <Icon
        icon={isFollowing ? "mdi:heart" : "mdi:heart-outline"}
        width={13}
        height={13}
      />
      {following === null ? "…" : isFollowing ? "Following" : "Follow"}
    </button>
  )
}
