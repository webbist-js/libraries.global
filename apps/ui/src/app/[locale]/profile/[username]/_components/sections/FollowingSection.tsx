import { T } from "@/lib/design-tokens"
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
// "Libraries" tab: stewarded libraries (when any), followed libraries, people.

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

export function FollowingSection({
  username,
  followedLibraries,
  followedUsers = [],
  claimedLibraries = [],
}: {
  username: string
  followedLibraries: FollowedLibrary[]
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
          title="Following"
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
