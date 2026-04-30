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
        background: "#030511",
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
            "radial-gradient(ellipse 70% 90% at 70% 40%, rgba(127,223,255,0.05) 0%, transparent 60%), linear-gradient(to bottom, rgba(3,5,17,0) 0%, rgba(3,5,17,0.75) 100%)",
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
              background: "rgba(255,255,255,0.03)",
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
            {/* Gradient ring wrapper */}
            <div
              style={{
                width: "92px",
                height: "92px",
                borderRadius: "50%",
                padding: "2px",
                background:
                  "linear-gradient(135deg, rgba(127,223,255,0.85) 0%, rgba(163,144,255,0.85) 100%)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  background: "rgba(10,14,34,0.95)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: T.font.mono,
                  fontSize: "26px",
                  fontWeight: 600,
                  color: T.accent.aurora,
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
                  marginTop: "-18px",
                  marginLeft: "66px",
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: T.accent.aurora,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid #030511",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="#030511"
                    strokeWidth="1.8"
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
                fontSize: "clamp(2rem, 4.5vw, 3.4rem)",
                fontWeight: 700,
                lineHeight: 0.94,
                letterSpacing: "-0.03em",
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
                  fontSize: "14px",
                  lineHeight: "1.65",
                  color: T.ink.base,
                  maxWidth: "52ch",
                  margin: "0 0 14px",
                  fontWeight: 300,
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
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: `1px solid rgba(127,223,255,0.35)`,
                  background: "rgba(127,223,255,0.08)",
                  color: T.accent.aurora,
                  fontFamily: T.font.sans,
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "not-allowed",
                  opacity: 0.5,
                }}
                disabled
                title="Following — coming soon"
              >
                + Follow
              </button>
            </div>
          )}

          {isOwnProfile && (
            <GlobalLink
              href="/settings"
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: `1px solid ${T.border.hi}`,
                background: "rgba(255,255,255,0.04)",
                color: T.ink.dim,
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              Edit profile
            </GlobalLink>
          )}
        </div>
      </div>
    </section>
  )
}
