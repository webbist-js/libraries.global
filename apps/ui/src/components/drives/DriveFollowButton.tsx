"use client"

import { Icon } from "@iconify/react"
import { useEffect, useState } from "react"

import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { driveHref } from "@/lib/drives/drive-view"
import { Link } from "@/lib/navigation"

const PILL =
  "inline-flex min-h-11 items-center gap-2 rounded-full border px-[18px] text-[15px] font-semibold no-underline transition-colors"

const FAILED = "Couldn’t update your follow. Try again."

/**
 * "Follow drive" / "Following" on a drive's page: a toggle (`aria-pressed`)
 * that follows the drive at once and rolls back if the save fails. Signed
 * out, it's a link to sign in that comes back to the drive. Followed drives
 * show on the profile's Following tab.
 */
export function DriveFollowButton({
  driveDocumentId,
  driveSlug,
  driveTitle,
}: {
  readonly driveDocumentId: string
  readonly driveSlug: string
  /** The plain title, for the button's description. */
  readonly driveTitle: string
}) {
  const { data: session, isPending } = authClient.useSession()
  const signedIn = !!session?.user
  const [following, setFollowing] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!signedIn || !driveDocumentId) return
    let live = true
    fetch(
      `/api/profile/me/follow?driveDocumentId=${encodeURIComponent(driveDocumentId)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { following?: boolean } | null) => {
        if (live) setFollowing(json?.following === true)
      })
      .catch(() => {
        if (live) setFollowing(false)
      })

    return () => {
      live = false
    }
  }, [signedIn, driveDocumentId])

  if (isPending) return null

  if (!signedIn) {
    return (
      <Link
        href={`/auth/signin?callbackUrl=${encodeURIComponent(driveHref(driveSlug))}`}
        className={`${PILL} border-(--t-border-hi) bg-white hover:border-(--t-accent-primary)`}
        style={{ color: T.ink.base }}
      >
        <Icon
          aria-hidden="true"
          height={17}
          icon="mdi:bell-outline"
          width={17}
        />
        Follow drive
      </Link>
    )
  }

  const toggle = async () => {
    if (following === null || saving) return
    const next = !following
    setFollowing(next)
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/profile/me/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driveDocumentId,
          action: next ? "follow" : "unfollow",
        }),
      })
      if (!res.ok) throw new Error(`Follow failed: ${res.status}`)
      const json = (await res.json()) as { following?: boolean }
      setFollowing(json.following === true)
    } catch {
      setFollowing(!next)
      setMessage(FAILED)
    } finally {
      setSaving(false)
    }
  }

  const isFollowing = following === true

  return (
    <span className="inline-flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={isFollowing}
        disabled={following === null || saving}
        title={
          isFollowing
            ? `Stop following “${driveTitle}”`
            : `Follow “${driveTitle}” from your profile`
        }
        className={`${PILL} cursor-pointer disabled:cursor-default ${
          isFollowing
            ? "border-(--t-accent-primary)"
            : "border-(--t-border-hi) bg-white hover:border-(--t-accent-primary)"
        }`}
        style={{
          color: isFollowing ? T.accent.primary : T.ink.base,
          background: isFollowing ? T.accent.chip : undefined,
          opacity: following === null ? 0.7 : 1,
        }}
      >
        <Icon
          aria-hidden="true"
          height={17}
          icon={isFollowing ? "mdi:bell" : "mdi:bell-outline"}
          width={17}
        />
        {isFollowing ? "Following" : "Follow drive"}
      </button>
      <span
        role="status"
        aria-live="polite"
        className="text-[14px] font-semibold"
        style={{ color: T.accent.danger }}
      >
        {message}
      </span>
    </span>
  )
}
