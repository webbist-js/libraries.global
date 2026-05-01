import GlobalLink from "@/components/global/GlobalLink"
import { DotHeroCanvas } from "@/components/ui/DotHeroCanvas"
import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"

function getInitials(p: UserProfile): string {
  const first = p.firstName?.[0] ?? ""
  const last = p.lastName?.[0] ?? ""

  return (first + last).toUpperCase() || p.username.slice(0, 2).toUpperCase()
}

export function ProfileHero({
  profile,
  isOwnProfile,
}: {
  profile: UserProfile
  isOwnProfile: boolean
}) {
  const initials = getInitials(profile)
  const displayName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    profile.username
  const [first, ...lastParts] = displayName.split(" ")
  const last = lastParts.join(" ")

  const joinedYear = new Date(profile.createdAt)
    .toLocaleDateString("en-US", { month: "short", year: "numeric" })
    .toUpperCase()

  return (
    <section
      data-transparent-header=""
      className="relative -mt-14 overflow-hidden"
      style={{
        background: T.bg.void,
        borderBottom: `1px solid ${T.border.line}`,
        minHeight: "320px",
      }}
    >
      {/* Dot canvas background */}
      <DotHeroCanvas />

      {/* Radial depth overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 90% at 70% 40%, var(--t-aurora-soft) 0%, transparent 60%), linear-gradient(to bottom, transparent 0%, var(--t-bg-space) 100%)",
        }}
      />

      {/* Hero content */}
      <div className="relative z-10 mx-auto w-full max-w-[1296px] px-6 pt-24 pb-10 md:px-10">
        {/* Breadcrumb */}
        <div
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: T.ink.low,
            display: "flex",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          <GlobalLink
            href="/"
            style={{ color: T.ink.low, textDecoration: "none" }}
          >
            Atlas
          </GlobalLink>
          <span>/</span>
          <span>Contributors</span>
          <span>/</span>
          <span style={{ color: T.ink.base }}>{displayName}</span>
        </div>

        {/* Location / verified chip */}
        {(profile.city || profile.country || profile.isVerifiedLibrarian) && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 12px",
              borderRadius: "999px",
              border: `1px solid ${T.border.line}`,
              background: T.bg.surface,
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.dim,
              marginBottom: "18px",
            }}
          >
            {profile.city && <span>{profile.city}</span>}
            {profile.country && (
              <>
                <span>·</span>
                <span>{profile.country}</span>
              </>
            )}
            {profile.isVerifiedLibrarian && (
              <>
                <span>·</span>
                <span style={{ color: T.accent.aurora }}>
                  Verified Librarian
                </span>
              </>
            )}
          </div>
        )}

        <div className="flex items-start gap-8">
          {/* Avatar */}
          <div className="shrink-0">
            {/* Conic-gradient ring wrapper */}
            <div
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "50%",
                padding: "3px",
                background: `conic-gradient(from 180deg at 50% 50%, ${T.accent.aurora}, ${T.accent.violet}, ${T.accent.gold}, ${T.accent.aurora})`,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, rgba(20,28,64,0.97), rgba(8,12,36,0.99))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: T.font.serif,
                  fontSize: "42px",
                  fontWeight: 400,
                  color: T.ink.base,
                  letterSpacing: "-0.02em",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {profile.avatar?.url ? (
                  <img
                    src={profile.avatar.url}
                    alt={displayName}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  initials
                )}
              </div>
            </div>
            {profile.isVerifiedLibrarian && (
              <div
                style={{
                  marginTop: "-22px",
                  marginLeft: "86px",
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  background: T.accent.aurora,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `3px solid ${T.bg.void}`,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--t-bg-void)"
                  strokeWidth="2.5"
                >
                  <path
                    d="m5 13 4 4L19 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Main content */}
          <div className="min-w-0 flex-1">
            {/* Name */}
            <h1
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(2.5rem, 5.5vw, 4.25rem)",
                fontWeight: 400,
                lineHeight: 0.92,
                letterSpacing: "-0.035em",
                color: T.ink.base,
                margin: "0 0 10px",
              }}
            >
              {first}{" "}
              {last && (
                <em
                  style={{
                    fontStyle: "italic",
                    fontWeight: 400,
                    color: "rgba(244,247,255,0.62)",
                  }}
                >
                  {last}.
                </em>
              )}
            </h1>

            {/* Meta row */}
            <div
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: T.ink.low,
                display: "flex",
                gap: "10px",
                marginBottom: "14px",
                flexWrap: "wrap",
              }}
            >
              <span>@{profile.username}</span>
              {profile.contributorNumber && (
                <>
                  <span>·</span>
                  <span>
                    Contributor #
                    {String(profile.contributorNumber).padStart(6, "0")}
                  </span>
                </>
              )}
              <span>·</span>
              <span>Joined {joinedYear}</span>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "17px",
                  lineHeight: "1.5",
                  color: T.ink.dim,
                  maxWidth: "60ch",
                  margin: "0 0 14px",
                  fontWeight: 300,
                  letterSpacing: "-0.005em",
                }}
              >
                {profile.bio}
              </p>
            )}

            {/* Affiliation + website */}
            <div
              style={{
                display: "flex",
                gap: "20px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {profile.affiliation && (
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    letterSpacing: ".08em",
                    color: T.ink.base,
                    fontWeight: 500,
                  }}
                >
                  {profile.affiliation}
                </span>
              )}
              {profile.jobTitle && (
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    letterSpacing: ".08em",
                    color: T.ink.dim,
                  }}
                >
                  {profile.jobTitle}
                </span>
              )}
              {profile.website && (
                <a
                  href={
                    profile.website.startsWith("http")
                      ? profile.website
                      : `https://${profile.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    letterSpacing: ".06em",
                    color: T.accent.aurora,
                    textDecoration: "none",
                  }}
                >
                  {profile.website.replace(/^https?:\/\//, "")} ↗
                </a>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {!isOwnProfile && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 18px",
                  borderRadius: "10px",
                  border: "none",
                  background: T.ink.base,
                  color: T.bg.void,
                  fontFamily: T.font.sans,
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "not-allowed",
                  opacity: 0.5,
                }}
                disabled
                title="Following — coming soon"
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
              </button>
            </div>
          )}

          {isOwnProfile && (
            <GlobalLink
              href="/profile/settings"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 18px",
                borderRadius: "10px",
                border: `1px solid ${T.border.hi}`,
                background: T.bg.surface,
                color: T.ink.dim,
                fontFamily: T.font.sans,
                fontSize: "13px",
                fontWeight: 400,
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Edit profile
            </GlobalLink>
          )}
        </div>
      </div>
    </section>
  )
}
