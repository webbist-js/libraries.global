"use client"

import { Icon } from "@iconify/react"

import { LibraryClaimButton } from "@/components/library/LibraryClaimButton"
import { useCorrectionDrawer } from "@/components/library/LibraryCorrection"
import { useCapabilities } from "@/lib/access-client"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

const PRIMARY =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-(--t-accent-primary) px-5 text-[15px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
const SECONDARY =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-(--t-border-hi) bg-white px-5 text-[15px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"

/** One line on what the person's role means for this record, if any. */
const ROLE_NOTE: Record<string, string> = {
  wiki_editor:
    "Your editor role covers Knowledge and the Journal. Library records change through reviewed suggestions.",
  editorial_board:
    "Your editor role covers Knowledge and the Journal. Library records change through reviewed suggestions.",
  verified_librarian:
    "You’re verified for another library. If you work here too, you can ask to look after this record.",
}

function Copy({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="m-0 text-[15px] leading-[1.5]" style={{ color: T.ink.dim }}>
      {children}
    </p>
  )
}

/**
 * The "About this record" call to action, by who's looking: visitors are
 * asked to sign in; the library's stewards get an edit link; everyone else
 * can suggest a correction (the drawer) or ask to steward the record. UI
 * only: every route behind these re-checks access.
 */
export function LibraryRecordCta({
  libraryDocumentId,
  librarySlug,
  libraryName,
  libraryEntityRef,
  libraryPath,
  gaps,
}: {
  readonly libraryDocumentId: string
  readonly librarySlug: string
  readonly libraryName: string
  readonly libraryEntityRef?: string
  readonly libraryPath: string
  /** Sections of the record still to document. */
  readonly gaps: number
}) {
  const { data: session, isPending } = authClient.useSession()
  const { has, claimedLibraryIds, ready } = useCapabilities()
  const { open } = useCorrectionDrawer()

  if (isPending || !ready)
    return (
      <div
        aria-hidden="true"
        className="h-[132px] animate-pulse rounded-[18px] motion-reduce:animate-none"
        style={{ background: T.bg.muted }}
      />
    )

  const nudge =
    gaps > 0
      ? ` ${gaps} ${gaps === 1 ? "section still needs" : "sections still need"} details.`
      : ""

  if (!session?.user) {
    const callback = encodeURIComponent(libraryPath)

    return (
      <div className="flex flex-col gap-3">
        <p
          className="m-0 text-[16px] font-semibold"
          style={{ color: T.ink.base }}
        >
          Know this library?
        </p>
        <Copy>
          Sign in to suggest a correction, share a photo or follow it. A
          reviewer checks every change.{nudge}
        </Copy>
        <div className="flex flex-col gap-2">
          <Link
            className={PRIMARY}
            href={`/auth/signin?callbackUrl=${callback}`}
          >
            Sign in
          </Link>
          <Link
            className={SECONDARY}
            href={`/auth/register?callbackUrl=${callback}`}
            style={{ color: T.ink.base }}
          >
            Create an account
          </Link>
        </div>
      </div>
    )
  }

  const steward =
    has("submit.libraryEdit") && claimedLibraryIds.includes(libraryDocumentId)

  if (steward)
    return (
      <div className="flex flex-col gap-3">
        <p
          className="m-0 flex items-center gap-2 text-[16px] font-semibold"
          style={{ color: T.accent.ok }}
        >
          <Icon
            aria-hidden="true"
            height={18}
            icon="mdi:check-decagram"
            width={18}
          />
          You look after this library
        </p>
        <Copy>
          You can edit this record directly. Your edits go to a reviewer first.
          {nudge}
        </Copy>
        <div className="flex flex-col gap-2">
          <Link className={PRIMARY} href={`/contribute/edit/${librarySlug}`}>
            <Icon
              aria-hidden="true"
              height={17}
              icon="mdi:pencil-outline"
              width={17}
            />
            Edit this record
          </Link>
          {has("events.feed") ? (
            <Link
              className={SECONDARY}
              href="/contribute/events"
              style={{ color: T.ink.base }}
            >
              Connect an event feed
            </Link>
          ) : null}
        </div>
      </div>
    )

  const role = (session.user as { contributorRole?: string }).contributorRole
  const roleNote = role ? ROLE_NOTE[role] : undefined

  return (
    <div className="flex flex-col gap-3">
      <p
        className="m-0 text-[16px] font-semibold"
        style={{ color: T.ink.base }}
      >
        Spotted something out of date?
      </p>
      <Copy>
        Only this library’s verified staff edit the record directly. Suggest a
        change and a reviewer checks it against your source.{nudge}
      </Copy>
      {roleNote ? <Copy>{roleNote}</Copy> : null}
      <button className={PRIMARY} onClick={() => open()} type="button">
        <Icon
          aria-hidden="true"
          height={17}
          icon="mdi:pencil-outline"
          width={17}
        />
        Suggest a correction
      </button>
      <LibraryClaimButton
        libraryDocumentId={libraryDocumentId}
        libraryEntityRef={libraryEntityRef}
        libraryName={libraryName}
        librarySlug={librarySlug}
      />
    </div>
  )
}
