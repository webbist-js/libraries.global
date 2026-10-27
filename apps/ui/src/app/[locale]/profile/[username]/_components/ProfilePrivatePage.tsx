import { T } from "@/lib/design-tokens"

export function ProfilePrivatePage({ username }: { username: string }) {
  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col items-center justify-center"
      style={{ background: T.bg.void }}
    >
      <div
        style={{
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
          padding: "48px 32px",
        }}
      >
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "var(--type-caption-size)",
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: T.ink.faint,
            marginBottom: "20px",
          }}
        >
          Profile · Private
        </p>
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          style={{ color: T.ink.faint, margin: "0 auto 24px" }}
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h1
          className="type-h1"
          style={{
            color: T.ink.base,
            marginBottom: "16px",
          }}
        >
          This profile is{" "}
          <em style={{ fontStyle: "italic", color: T.ink.dim }}>private.</em>
        </h1>
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "var(--type-body-small-size)",
            lineHeight: 1.6,
            color: T.ink.low,
          }}
        >
          <strong style={{ color: T.ink.dim, fontWeight: 500 }}>
            @{username}
          </strong>{" "}
          has set their profile to private and it is not visible to the public.
        </p>
      </div>
    </div>
  )
}
