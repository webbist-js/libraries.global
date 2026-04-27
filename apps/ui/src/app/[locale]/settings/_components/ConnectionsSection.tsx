"use client"

import { T } from "@/lib/design-tokens"

// TODO: Fetch real connected accounts via BA listAccounts API when exposed.
// BA stores accounts in the `account` table linked by userId.
// Disconnect via BA revokeSession + unlinkAccount (if BA exposes it).
const PROVIDER_ICONS: Record<string, string> = {
  google: "G",
  github: "GH",
  magic_link: "✉",
}

const DEMO_ACCOUNTS = [
  // TODO: Replace with real BA account data from GET /api/auth/list-accounts or BA server API.
  { provider: "google", identifier: "your@gmail.com", connectedAt: "Connected to SSO link" },
]

export function ConnectionsSection() {
  return (
    <div>
      <h2 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 600, color: T.ink.base }}>Connected accounts</h2>
      <p style={{ margin: "0 0 24px", fontSize: "13px", color: T.ink.faint }}>
        Use these providers to sign in faster and show verified affiliations on your profile.
      </p>

      <div
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {DEMO_ACCOUNTS.map((acct, i) => (
          <div
            key={acct.provider}
            style={{
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              borderBottom: i < DEMO_ACCOUNTS.length - 1 ? `1px solid ${T.border.line}` : "none",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${T.border.line}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: T.font.mono,
                fontSize: "11px",
                fontWeight: 600,
                color: T.ink.dim,
                flexShrink: 0,
              }}
            >
              {PROVIDER_ICONS[acct.provider] ?? acct.provider[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "13px", color: T.ink.base, textTransform: "capitalize" }}>{acct.provider}</p>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: T.ink.faint, fontFamily: T.font.mono }}>{acct.identifier}</p>
            </div>
            {/* TODO: implement disconnect via BA unlinkAccount */}
            <button
              type="button"
              disabled
              style={{
                padding: "5px 12px",
                borderRadius: "6px",
                border: `1px solid ${T.border.line}`,
                background: "transparent",
                color: T.ink.faint,
                fontSize: "12px",
                fontFamily: T.font.sans,
                cursor: "not-allowed",
                opacity: 0.5,
              }}
            >
              Disconnect
            </button>
          </div>
        ))}
        <div
          style={{
            padding: "14px 20px",
            borderTop: `1px solid ${T.border.line}`,
            fontSize: "12px",
            color: T.ink.faint,
            fontFamily: T.font.mono,
            letterSpacing: ".06em",
          }}
        >
          {/* TODO: show real connected providers once BA listAccounts is wired */}
          Only providers you have authenticated with will appear here.
        </div>
      </div>
    </div>
  )
}
