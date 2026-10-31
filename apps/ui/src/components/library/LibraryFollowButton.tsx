"use client"

import { Icon } from "@iconify/react"
import Link from "next/link"
import { useTranslations as useUiTranslations } from "next-intl"
import { toast } from "sonner"

import { useFollowTarget } from "@/hooks/useFollowTarget"
import { useMounted } from "@/hooks/useMounted"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"

function followStyle(
  isFollowing: boolean,
  disabled: boolean
): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "9px 16px",
    minHeight: 44,
    borderRadius: "10px",
    border: `1px solid ${isFollowing ? T.accent.primary : T.border.control}`,
    background: isFollowing ? T.accent.chip : T.bg.deep,
    color: isFollowing ? T.accent.primary : T.ink.base,
    fontFamily: T.font.mono,
    fontSize: "var(--type-caption-size)",
    letterSpacing: ".1em",
    textTransform: "uppercase",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition: "all 150ms",
  }
}

export function LibraryFollowButton({
  libraryDocumentId,
  libraryName,
}: {
  libraryDocumentId: string
  libraryName: string
}) {
  const tUi = useUiTranslations("ui")

  const { data: session, isPending } = authClient.useSession()
  const tFollow = useUiTranslations("publishingFollow")
  const {
    following,
    saving: loading,
    error,
    retry,
    toggle: toggleFollow,
  } = useFollowTarget(session?.user?.id, "libraryDocumentId", libraryDocumentId)
  // Better Auth's store can already hold a session on the client's first
  // render while the server rendered none, so every session-dependent
  // branch waits for mount; a same-height placeholder keeps the layout.
  const mounted = useMounted()

  const toggle = async () => {
    if (!session?.user || following === null) return
    const next = await toggleFollow()
    if (next !== null)
      toast.success(
        next ? `Following ${libraryName}` : `Unfollowed ${libraryName}`
      )
  }

  if (!mounted || isPending)
    return (
      <span
        aria-hidden="true"
        className="inline-block rounded-[10px]"
        style={{ height: 44, width: 120, background: T.bg.muted }}
      />
    )

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
          minHeight: 44,
          border: `1px solid ${T.border.control}`,
          background: T.bg.deep,
          color: T.ink.dim,
          fontFamily: T.font.mono,
          fontSize: "var(--type-caption-size)",
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
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={error === "read" ? retry : toggle}
        aria-pressed={isFollowing}
        disabled={loading || (following === null && error !== "read")}
        style={followStyle(
          isFollowing,
          loading || (following === null && error !== "read")
        )}
      >
        <Icon
          icon={isFollowing ? "mdi:heart" : "mdi:heart-outline"}
          width={13}
          height={13}
        />
        {error === "read"
          ? tUi("try_again")
          : following === null
            ? "…"
            : isFollowing
              ? tUi("following")
              : tUi("follow")}
      </button>
      {error && (
        <span
          role="status"
          className="text-xs"
          style={{ color: T.accent.danger }}
        >
          {tFollow(error === "read" ? "lookupError" : "updateError")}
        </span>
      )}
    </span>
  )
}
