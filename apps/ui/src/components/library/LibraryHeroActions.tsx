"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { announceFollow } from "@/components/library/follow-events"
import { useCorrectionDrawer } from "@/components/library/LibraryCorrection"
import { LIB_ICONS, LibIcon } from "@/components/library/LibrarySectionCard"
import { useMounted } from "@/hooks/useMounted"
import {
  analyticsAttributes,
  captureAnalyticsEvent,
} from "@/lib/analytics-events"
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
  minHeight: "44px",
}

/**
 * Hero action row: Follow, Add photos (the photo form on the Contribute
 * hub, with this library chosen) and Suggest a correction (opens the
 * correction drawer, see LibraryCorrection).
 */
export function LibraryHeroActions({
  libraryName,
  libraryDocumentId,
  directionsUrl,
  website,
  catalogueUrl,
}: {
  readonly directionsUrl?: string | null
  readonly website?: string | null
  readonly catalogueUrl?: string | null
  readonly librarySlug: string
  readonly libraryName: string
  readonly libraryDocumentId: string
}) {
  const tUi = useUiTranslations("ui")

  const { open } = useCorrectionDrawer()

  return (
    <div className="flex flex-wrap gap-2">
      {[
        {
          href: directionsUrl,
          title: "Get directions",
          action: "directions" as const,
        },
        { href: website, title: "Website", action: "website" as const },
        {
          href: catalogueUrl,
          title: "Catalogue",
          action: "catalogue" as const,
        },
      ]
        .filter((item) => item.href)
        .slice(0, 3)
        .map((item, index) => (
          <a
            key={item.title}
            href={item.href!}
            {...analyticsAttributes("library_action", {
              action_type: item.action,
              interaction_source: "library_hero",
              library_document_id: libraryDocumentId,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold"
            style={{
              background: index === 0 ? T.accent.primary : T.bg.deep,
              color: index === 0 ? "white" : T.ink.base,
              borderColor: T.border.line,
            }}
          >
            {item.title}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ))}
      <FollowPill
        libraryDocumentId={libraryDocumentId}
        libraryName={libraryName}
      />
      <button
        type="button"
        onClick={() => open()}
        style={{
          ...pillBase,
          border: 0,
          background: T.bg.deep,
          color: T.ink.base,
        }}
        className="transition-colors hover:!bg-(--t-bg-surface)"
      >
        <LibIcon d={LIB_ICONS.pencil} />
        {tUi("suggest_a_correction")}
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
  const tUi = useUiTranslations("ui")

  const { data: session, isPending } = authClient.useSession()
  const [following, setFollowing] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  // Better Auth's store can already hold a session on the client's first
  // render while the server rendered none: wait for mount before branching.
  const mounted = useMounted()

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
    const measured = captureAnalyticsEvent("library_follow", {
      interaction_source: "library_hero",
      library_document_id: libraryDocumentId,
      action_type: following ? "unfollow" : "follow",
    })
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
        if (json.following !== following) {
          measured()
          announceFollow({ libraryDocumentId, following: json.following })
        }
        setFollowing(json.following)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!mounted || isPending) return null

  if (!session?.user) {
    return (
      <Link
        href="/auth/signin"
        style={{
          ...pillBase,
          border: "1px solid transparent",
          background: "transparent",
          color: T.ink.base,
          textDecoration: "none",
        }}
        className="transition-colors hover:!bg-(--t-bg-surface)"
      >
        <LibIcon d={LIB_ICONS.bookmark} />
        {tUi("follow")}{" "}
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
        border: "1px solid transparent",
        background: isFollowing ? T.ink.base : "transparent",
        color: isFollowing ? "#fff" : T.ink.base,
        opacity: loading || following === null ? 0.7 : 1,
      }}
    >
      <LibIcon d={LIB_ICONS.bookmark} />
      {following === null
        ? tUi("follow")
        : isFollowing
          ? tUi("following")
          : tUi("follow")}
    </button>
  )
}
