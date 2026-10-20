"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"

import { useFollowTarget } from "@/hooks/useFollowTarget"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { driveHref } from "@/lib/drives/drive-view"
import { Link } from "@/lib/navigation"

const PILL =
  "inline-flex min-h-11 items-center gap-2 rounded-full border px-[18px] text-[15px] font-semibold no-underline transition-colors"

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
  const tUi = useUiTranslations("ui")

  const { data: session, isPending } = authClient.useSession()
  const signedIn = !!session?.user
  const tFollow = useUiTranslations("publishingFollow")
  const { following, saving, error, retry, toggle } = useFollowTarget(
    session?.user?.id,
    "driveDocumentId",
    driveDocumentId
  )
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

  const isFollowing = following === true
  const look = isFollowing
    ? {
        title: `Stop following “${driveTitle}”`,
        label: tUi("following"),
        icon: "mdi:bell",
        className: "border-(--t-accent-primary)",
        color: T.accent.primary,
        background: T.accent.chip,
      }
    : {
        title: `Follow “${driveTitle}” from your profile`,
        label: "Follow drive",
        icon: "mdi:bell-outline",
        className:
          "border-(--t-border-hi) bg-white hover:border-(--t-accent-primary)",
        color: T.ink.base,
        background: undefined,
      }
  const feedback =
    error === "read"
      ? tFollow("lookupError")
      : error === "write"
        ? tFollow("updateError")
        : ""

  return (
    <span className="inline-flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={
          error === "read"
            ? retry
            : () => {
                toggle()
              }
        }
        aria-pressed={following === null ? undefined : isFollowing}
        disabled={(following === null && error !== "read") || saving}
        title={look.title}
        className={`${PILL} cursor-pointer disabled:cursor-default ${look.className}`}
        style={{
          color: look.color,
          background: look.background,
          opacity: following === null ? 0.7 : 1,
        }}
      >
        <Icon aria-hidden="true" height={17} icon={look.icon} width={17} />
        {error === "read" ? tUi("try_again") : look.label}
      </button>
      <span
        role="status"
        aria-live="polite"
        className="text-[14px] font-semibold"
        style={{ color: T.accent.danger }}
      >
        {feedback}
      </span>
    </span>
  )
}
