import { DriveCard } from "@/components/drives/DriveCard"
import { T } from "@/lib/design-tokens"
import type { DriveView } from "@/lib/drives/drive-view"
import { Link } from "@/lib/navigation"
import type {
  ClaimedLibrary,
  FollowedLibrary,
  FollowedUser,
} from "@/lib/types/profile"

import { FollowedLibrariesGrid } from "../FollowedLibrariesGrid"
import { FollowedUsersGrid } from "../FollowedUsersGrid"
import { CARD, SectionTitle } from "../ProfileSectionUI"

// ── FollowingSection ──────────────────────────────────────────────────────────
//
// "Following" tab: stewarded libraries (when any), followed libraries,
// followed drives and people.

function SectionHead({
  id,
  title,
  count,
}: {
  id: string
  title: string
  count?: string
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4">
      <SectionTitle as="h2" id={id}>
        {title}
      </SectionTitle>
      {count ? (
        <span className="text-[15px]" style={{ color: T.ink.dim }}>
          {count}
        </span>
      ) : null}
    </div>
  )
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

/** The drives a profile follows, as Noticeboard cards, or an empty state. */
function FollowedDrivesGrid({ drives }: { drives: readonly DriveView[] }) {
  if (drives.length === 0) {
    return (
      <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
        Not following any drives yet. Follow one from its page to keep an eye on
        it.{" "}
        <Link
          href="/community"
          className="font-semibold underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-current"
          style={{ color: T.accent.primary }}
        >
          See the drives
        </Link>
      </p>
    )
  }

  return (
    <ul
      className="m-0 grid list-none gap-4 p-0"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
      }}
    >
      {drives.map((view) => (
        <li key={view.drive.documentId} className="flex min-w-0 flex-col">
          <DriveCard view={view} />
        </li>
      ))}
    </ul>
  )
}

export function FollowingSection({
  username,
  followedLibraries,
  followedDrives = [],
  followedUsers = [],
  claimedLibraries = [],
}: {
  username: string
  followedLibraries: FollowedLibrary[]
  /** Followed drives as cards, open and scheduled first (`loadFollowedDriveViews`). */
  followedDrives?: readonly DriveView[]
  followedUsers?: FollowedUser[]
  /** Libraries this user stewards (profile.claimedLibraries). */
  claimedLibraries?: ClaimedLibrary[]
}) {
  const cardStyle = { ...CARD, padding: "20px 24px 24px" }

  return (
    <div className="flex flex-col gap-6">
      {claimedLibraries.length > 0 ? (
        <section aria-labelledby="fl-stewards" style={cardStyle}>
          <SectionHead
            id="fl-stewards"
            title="Stewards"
            count={plural(claimedLibraries.length, "library", "libraries")}
          />
          <FollowedLibrariesGrid
            libraries={claimedLibraries}
            username={username}
            variant="grid"
            roleLabel="Steward"
          />
        </section>
      ) : null}

      <section aria-labelledby="fl-libraries" style={cardStyle}>
        <SectionHead
          id="fl-libraries"
          title="Libraries"
          count={
            followedLibraries.length > 0
              ? plural(followedLibraries.length, "library", "libraries")
              : undefined
          }
        />
        <FollowedLibrariesGrid
          libraries={followedLibraries}
          username={username}
          variant="grid"
        />
      </section>

      <section aria-labelledby="fl-drives" style={cardStyle}>
        <SectionHead
          id="fl-drives"
          title="Drives"
          count={
            followedDrives.length > 0
              ? plural(followedDrives.length, "drive", "drives")
              : undefined
          }
        />
        <FollowedDrivesGrid drives={followedDrives} />
      </section>

      <section aria-labelledby="fl-people" style={cardStyle}>
        <SectionHead
          id="fl-people"
          title="People"
          count={
            followedUsers.length > 0
              ? plural(followedUsers.length, "person", "people")
              : undefined
          }
        />
        <FollowedUsersGrid users={followedUsers} />
      </section>
    </div>
  )
}
