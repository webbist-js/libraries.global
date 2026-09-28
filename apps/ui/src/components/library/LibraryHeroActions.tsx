"use client"

import { useEffect, useState } from "react"

import { hubHref } from "@/components/contribute/wizard.logic"
import { announceFollow } from "@/components/library/follow-events"
import { useCorrectionDrawer } from "@/components/library/LibraryCorrection"
import { LIB_ICONS, LibIcon } from "@/components/library/LibrarySectionCard"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

const pillBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  borderRadius: "999px",
  padding: "9px 16px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
}

/**
 * Hero action row: Follow, Add photos (the photo form on the Contribute
 * hub, with this library chosen) and Suggest a correction (opens the
 * correction drawer, see LibraryCorrection).
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
  const { open } = useCorrectionDrawer()

  return (
    <div className="flex flex-wrap gap-2">
      <FollowPill
        libraryDocumentId={libraryDocumentId}
        libraryName={libraryName}
      />
      <Link
        href={hubHref("photo", { slug: librarySlug, name: libraryName })}
        style={{
          ...pillBase,
          padding: "8px 16px",
          border: `1px solid ${T.border.hi}`,
          background: T.bg.deep,
          color: T.ink.base,
          textDecoration: "none",
        }}
        className="transition-colors hover:!bg-(--t-bg-surface)"
      >
        <LibIcon d={LIB_ICONS.camera} />
        Add photos
      </Link>
      <button
        type="button"
        onClick={() => open()}
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
    </div>
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
        if (json.following !== following)
          announceFollow({ libraryDocumentId, following: json.following })
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
